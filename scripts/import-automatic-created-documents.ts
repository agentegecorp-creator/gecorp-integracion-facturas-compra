import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    value = value.replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

type AutomaticDocument = {
  id: string;
  sourceRun?: string | null;
  vendor_name?: string | null;
  vendor_rut?: string | null;
  folio?: string | null;
  document_type?: string | null;
  issue_date?: string | null;
  reception_date?: string | null;
  amount_total?: string | number | null;
  summary_text?: string | null;
  sandbox_publish_status?: string | null;
  payload_json?: {
    document?: Record<string, unknown>;
    context?: Record<string, unknown>;
  };
};

const automaticCreatedDocumentsPath = path.join(process.cwd(), 'src/lib/review/automatic-created-documents.json');
const siiProjectDir = '/Users/agentegecorp/.openclaw/workspace/proyectos/sii-netsuite';

function amount(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readDryRunPayloads(sourceRun?: string | null) {
  const rows = new Map<string, { recordType?: string; data: Record<string, unknown> }>();
  if (!sourceRun) return rows;

  const runDir = path.join(siiProjectDir, sourceRun);
  const pipelineOutputDir = path.join(runDir, 'pipeline_output');
  if (!fs.existsSync(pipelineOutputDir)) return rows;

  const candidates = fs.readdirSync(pipelineOutputDir)
    .map((name) => path.join(pipelineOutputDir, name, 'dry_run_create_log.jsonl'))
    .filter((candidate) => fs.existsSync(candidate));

  for (const candidate of candidates) {
    for (const line of fs.readFileSync(candidate, 'utf8').split(/\r?\n/)) {
      if (!line.trim()) continue;
      const parsed = JSON.parse(line) as { record_type?: string; data?: Record<string, unknown> };
      const data = parsed.data ?? {};
      const tranId = String(data.tranId ?? '');
      if (!tranId) continue;
      rows.set(tranId, { recordType: parsed.record_type, data });
    }
  }

  return rows;
}

function idFromRef(value: unknown) {
  return (value as { id?: string | number } | undefined)?.id ?? null;
}

function normalizeDateOnly(value: unknown) {
  const raw = String(value ?? '');
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function nextPaymentDateOnOrAfter(value: string, withTef: boolean) {
  const date = new Date(`${value}T00:00:00Z`);
  const targetDay = withTef ? 5 : 1;
  const delta = (targetDay - date.getUTCDay() + 7) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function safePaymentDate(document: Record<string, unknown>, context: Record<string, unknown>, fallbackIssueDate?: string | null) {
  const paymentDate = normalizeDateOnly(document.paymentDate ?? context.paymentDate);
  const documentDate = normalizeDateOnly(document.issueDate ?? fallbackIssueDate);
  if (!paymentDate || !documentDate || paymentDate >= documentDate) return document.paymentDate ?? context.paymentDate;

  const dueDate = normalizeDateOnly(document.dueDate ?? context.dueDate) ?? documentDate;
  const paymentRule = String(document.paymentDateRule ?? context.paymentDateRule ?? '').toLowerCase();
  return nextPaymentDateOnOrAfter(dueDate, paymentRule.includes('con tef'));
}

function publishStatus(item: AutomaticDocument) {
  const mode = String(item.payload_json?.context?.automaticCreationMode ?? '');
  if (item.sandbox_publish_status === 'published' && !mode.includes('STUB')) return 'published';
  return 'ready';
}

async function main() {
  const periodArg = process.argv[2];
  const { db } = await import('../src/lib/db/client');
  const documentsByPeriod = JSON.parse(fs.readFileSync(automaticCreatedDocumentsPath, 'utf8')) as Record<string, AutomaticDocument[]>;
  const entries = periodArg
    ? [[periodArg, documentsByPeriod[periodArg] ?? []] as const]
    : Object.entries(documentsByPeriod);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const [period, items] of entries) {
    const payloadsBySourceRun = new Map<string, Map<string, { recordType?: string; data: Record<string, unknown> }>>();

    for (const item of items) {
      const sourceDocumentId = `automatic_${item.id}`;
      const payload = item.payload_json ?? {};
      const document = payload.document ?? {};
      const context = payload.context ?? {};
      const sourceRun = item.sourceRun ?? null;
      const dryRunPayloads = sourceRun
        ? payloadsBySourceRun.get(sourceRun) ?? readDryRunPayloads(sourceRun)
        : new Map<string, { recordType?: string; data: Record<string, unknown> }>();
      if (sourceRun && !payloadsBySourceRun.has(sourceRun)) payloadsBySourceRun.set(sourceRun, dryRunPayloads);

      const dryRun = dryRunPayloads.get(String(item.folio ?? ''));
      const dryRunData = dryRun?.data ?? {};
      const expenseItems = ((dryRunData.expense as { items?: Array<Record<string, unknown>> } | undefined)?.items ?? []);
      const expense = expenseItems[0] ?? {};
      const vendorId = context.vendorIdProposed ?? context.entity ?? idFromRef(dryRunData.entity);
      const accountId = context.accountIdProposed ?? context.referenciaAccount ?? document.accountId ?? idFromRef(expense.account);
      const locationId = context.locationIdProposed ?? document.locationId ?? idFromRef(expense.location) ?? idFromRef(dryRunData.location);
      const classId = context.classIdProposed ?? document.classId ?? idFromRef(expense.class) ?? idFromRef(dryRunData.class);
      const departmentId = context.departmentIdProposed ?? document.departmentId ?? idFromRef(expense.department) ?? idFromRef(dryRunData.department);
      const requesterId = context.requesterIdProposed ?? idFromRef(dryRunData.custbody_gecorp_solicitante);
      const documentTypeNs = context.documentTypeNsProposed ?? idFromRef(dryRunData.custbody_gd_tipo_documento);
      const paymentDate = safePaymentDate(document, context, item.issue_date);

      if (!item.folio || !item.document_type) {
        skipped += 1;
        continue;
      }

      const payloadJson = {
        ...payload,
        source: 'automatic-created-documents.json',
        automaticPeriod: period,
        document: {
          ...document,
          accountId,
          locationId,
          classId,
          departmentId,
          paymentDate,
        },
        context: {
          ...context,
          vendorIdProposed: vendorId,
          accountIdProposed: accountId,
          locationIdProposed: locationId,
          classIdProposed: classId,
          departmentIdProposed: departmentId,
          requesterIdProposed: requesterId,
          documentTypeNsProposed: documentTypeNs,
          accountingDateProposed: context.accountingDateProposed ?? dryRunData.tranDate ?? item.issue_date ?? null,
          dueDate: context.dueDate ?? dryRunData.dueDate ?? item.issue_date ?? null,
          paymentDate,
        },
      };

      const exists = await db.query(`select id from review_cases where source_document_id = $1 limit 1`, [sourceDocumentId]);
      const params = [
        item.sourceRun ?? `automatic_${period}`,
        sourceDocumentId,
        item.vendor_name ?? null,
        item.vendor_rut ?? null,
        String(item.folio),
        String(item.document_type),
        item.issue_date ?? null,
        item.reception_date ?? null,
        amount(document.amountNet),
        amount(document.amountVat),
        amount(item.amount_total ?? document.amountTotal),
        'approved_auto',
        'resolved',
        item.summary_text ?? 'Aprobada automáticamente por pipeline; pendiente de publicación manual a Sandbox.',
        JSON.stringify(payloadJson),
        publishStatus(item),
      ];

      if (exists.rows[0]?.id) {
        await db.query(
          `update review_cases
           set source_run_id = $1,
               source_document_id = $2,
               vendor_name = $3,
               vendor_rut = $4,
               folio = $5,
               document_type = $6,
               issue_date = $7,
               reception_date = $8,
               amount_net = $9,
               amount_tax = $10,
               amount_total = $11,
               bucket = $12,
               status = $13,
               summary_text = $14,
               payload_json = $15::jsonb,
               sandbox_publish_status = case
                 when coalesce(sandbox_publish_status, 'not_ready') = 'published' then sandbox_publish_status
                 else $16
               end,
               updated_at = now()
           where id = $17`,
          [...params, exists.rows[0].id],
        );
        updated += 1;
        continue;
      }

      await db.query(
        `insert into review_cases (
          source_run_id,
          source_document_id,
          vendor_name,
          vendor_rut,
          folio,
          document_type,
          issue_date,
          reception_date,
          amount_net,
          amount_tax,
          amount_total,
          currency,
          bucket,
          status,
          summary_text,
          payload_json,
          sandbox_publish_status
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'CLP',$12,$13,$14,$15::jsonb,$16
        )`,
        params,
      );
      inserted += 1;
    }
  }

  console.log(JSON.stringify({ period: periodArg ?? 'all', inserted, updated, skipped }, null, 2));
  await db.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
