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
    value = value.replace(/^['\"]|['\"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

import { db } from '../src/lib/db/client';

type ErrorReal = {
  folio: string;
  entity: number;
  error: string;
};

type RevisionOc = {
  folio: string;
  entity: number;
  referencia_account: number;
  categoria_oc: string;
  learning_category: string;
  motivo: string;
};

type RechazadaSii = {
  folio: string;
  rut: string;
  razon_social: string;
  motivo: string;
};

type DashboardData = {
  updatedAt: string;
  erroresReales: ErrorReal[];
  revisionOCReferencial: RevisionOc[];
  rechazadasSII: RechazadaSii[];
};

type PipelineRow = Record<string, string>;

type CaseInput = {
  sourceRunId: string;
  sourceDocumentId: string;
  vendorName: string;
  vendorRut: string | null;
  folio: string;
  documentType: string;
  bucket: string;
  status: string;
  summaryText: string;
  issueDate?: string | null;
  receptionDate?: string | null;
  amountTotal?: number | null;
  payloadJson: Record<string, unknown>;
};

const dashboardPath = '/Users/agentegecorp/Projects/mission-control/data/sii-netsuite-dashboard.json';
const enrichedCsvPath = '/Users/agentegecorp/.openclaw/workspace/proyectos/sii-netsuite/salida_revision_gonzalo_feb2026_enriquecida.csv';
const ocReferenceCsvPath = '/Users/agentegecorp/.openclaw/workspace/proyectos/sii-netsuite/provider_rules_oc_obligatoria_reference.csv';

function readDashboard(): DashboardData {
  return JSON.parse(fs.readFileSync(dashboardPath, 'utf8')) as DashboardData;
}

function buildRunId(updatedAt: string) {
  return `dashboard_${updatedAt.replace(/[^0-9]/g, '').slice(0, 14)}`;
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if ((char === ',' || char === ';') && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function readDelimited(filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cols[index] ?? '']));
  });
}

function parseDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const [datePart] = trimmed.split(' ');
  const [day, month, year] = datePart.split('/');
  if (!day || !month || !year) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseNumber(value: string) {
  const trimmed = value.trim().replace(/\./g, '').replace(',', '.');
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function buildEnrichedRowMap() {
  const rows = readDelimited(enrichedCsvPath);
  const map = new Map<string, PipelineRow>();

  for (const row of rows) {
    const rutKey = `${String(row.rut_proveedor || '').trim()}::${String(row.folio || '').trim()}::${String(row.tipo_doc || '').trim()}`;
    const entityKey = `${String(row.entity || row.entity_id || '').trim()}::${String(row.folio || '').trim()}::${String(row.tipo_doc || '').trim()}`;
    if (!map.has(rutKey)) map.set(rutKey, row);
    if (!map.has(entityKey)) map.set(entityKey, row);
  }

  return map;
}

function looksLikeEntityId(value: string) {
  return /^\d+$/.test(value.trim());
}

function buildEntityVendorMap() {
  const map = new Map<string, string>();

  const enrichedRows = readDelimited(enrichedCsvPath);
  for (const row of enrichedRows) {
    const entity = String(row.entity_id || '').trim();
    const proveedorCorrelacion = String(row.proveedor_correlacion || '').trim();
    const razonSocial = String(row.razon_social || '').trim();
    const resolved = proveedorCorrelacion && !looksLikeEntityId(proveedorCorrelacion)
      ? proveedorCorrelacion
      : razonSocial;
    if (entity && resolved && !map.has(entity)) map.set(entity, resolved);
  }

  const ocRows = readDelimited(ocReferenceCsvPath);
  for (const row of ocRows) {
    const entity = String(row.entity_id || row.entity || '').trim();
    const vendor = String(row.supplier_name_ns || row.proveedor_nombre_ns || row.supplier_name || '').trim();
    if (entity && vendor && !map.has(entity)) map.set(entity, vendor);
  }

  return map;
}

function buildStageSummary(item: CaseInput) {
  const context = (item.payloadJson?.context as Record<string, unknown> | undefined) || {};
  const amountText = typeof item.amountTotal === 'number' && Number.isFinite(item.amountTotal)
    ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(item.amountTotal)
    : null;

  if (item.bucket === 'error_real') {
    const error = typeof context.error === 'string' ? context.error : item.summaryText;
    return [item.vendorName, amountText, error].filter(Boolean).join(' · ');
  }

  if (item.bucket === 'revision_oc') {
    const motivo = typeof context.motivo === 'string' ? context.motivo : item.summaryText;
    const politicaOc = typeof context.categoriaOc === 'string' ? context.categoriaOc : null;
    return [item.vendorName, amountText, politicaOc, motivo].filter(Boolean).join(' · ');
  }

  return item.summaryText;
}

function buildHydratedCase(base: CaseInput, row?: PipelineRow) {
  if (!row) {
    return {
      ...base,
      summaryText: buildStageSummary(base),
    };
  }

  const proveedorCorrelacion = String(row.proveedor_correlacion || '').trim();
  const razonSocial = String(row.razon_social || '').trim();
  const resolvedVendorName = proveedorCorrelacion && !looksLikeEntityId(proveedorCorrelacion)
    ? proveedorCorrelacion
    : (razonSocial || base.vendorName);

  const hydrated: CaseInput = {
    ...base,
    vendorName: resolvedVendorName,
    vendorRut: String(row.rut_proveedor || base.vendorRut || '').trim() || base.vendorRut,
    issueDate: parseDate(String(row.fecha_docto || '')),
    receptionDate: parseDate(String(row.fecha_recepcion || '')),
    amountTotal: parseNumber(String(row.monto_total || '')),
    payloadJson: {
      ...base.payloadJson,
      source: 'pipeline enriched csv',
      enrichedFrom: 'salida_revision_gonzalo_feb2026_enriquecida.csv',
      context: {
        ...(base.payloadJson.context as Record<string, unknown> || {}),
        estadoActual: row.estado_actual || null,
        motivoActual: row.motivo_actual || null,
        trabajaConOc: row.trabaja_con_oc || null,
        pagoPorTef: row.pago_por_tef || null,
        terminosNs: row.terminos_ns || null,
        diasCreditoNs: row.dias_credito_ns || null,
        sourceActual: row.source_actual || null,
        categoriaActual: row.categoria_actual || null,
        accountActual: row.account_actual || null,
        accountCorrecta: row.account_correcta || null,
        classCorrecta: row.class_correcta || null,
        departmentCorrecta: row.department_correcta || null,
        locationCorrecta: row.location_correcta || null,
        comentariosGonzalo: row.comentarios_gonzalo || null,
        matchTipo: row.match_tipo || null,
        matchConfianza: row.match_confianza || null,
        fuenteCorrelacion: row.fuente_correlacion || null,
        proveedorCorrelacion: row.proveedor_correlacion || null,
        categoriasCorrelacion: row.categorias_correlacion || null,
        referenciaOcCorrelacion: row.referencia_oc_correlacion || null,
        requiereRevisionManual: row.requiere_revision_manual || null,
      },
    },
  };

  return {
    ...hydrated,
    summaryText: buildStageSummary(hydrated),
  };
}

async function upsertCase(item: CaseInput) {
  const exists = await db.query(`select id from review_cases where source_document_id = $1 limit 1`, [item.sourceDocumentId]);

  if (exists.rows[0]?.id) {
    await db.query(
      `update review_cases
       set source_run_id = $2,
           vendor_name = $3,
           vendor_rut = $4,
           folio = $5,
           document_type = $6,
           issue_date = coalesce($7, issue_date),
           reception_date = coalesce($8, reception_date),
           amount_total = coalesce($9, amount_total),
           bucket = $10,
           status = $11,
           summary_text = $12,
           payload_json = $13::jsonb,
           updated_at = now()
       where id = $1`,
      [
        exists.rows[0].id,
        item.sourceRunId,
        item.vendorName,
        item.vendorRut,
        item.folio,
        item.documentType,
        item.issueDate ?? null,
        item.receptionDate ?? null,
        item.amountTotal ?? null,
        item.bucket,
        item.status,
        item.summaryText,
        JSON.stringify(item.payloadJson),
      ],
    );
    return 'updated';
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
      payload_json
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,null,null,$9,'CLP',$10,$11,$12,$13::jsonb
    )`,
    [
      item.sourceRunId,
      item.sourceDocumentId,
      item.vendorName,
      item.vendorRut,
      item.folio,
      item.documentType,
      item.issueDate ?? null,
      item.receptionDate ?? null,
      item.amountTotal ?? null,
      item.bucket,
      item.status,
      item.summaryText,
      JSON.stringify(item.payloadJson),
    ],
  );
  return 'inserted';
}

async function demoteSeedCases() {
  const result = await db.query(`
    update review_cases
    set status = 'rejected_for_learning',
        summary_text = concat(coalesce(summary_text, ''), ' [seed relegado por sync real]'),
        updated_at = now()
    where source_run_id = 'run_2026_04_28_120000'
      and status = 'new'
    returning id
  `);

  return result.rowCount ?? 0;
}

async function main() {
  const dashboard = readDashboard();
  const sourceRunId = buildRunId(dashboard.updatedAt);
  const rowMap = buildEnrichedRowMap();
  const entityVendorMap = buildEntityVendorMap();
  let inserted = 0;
  let updated = 0;

  const cases: CaseInput[] = [];

  for (const item of dashboard.erroresReales) {
    const fallbackVendor = entityVendorMap.get(String(item.entity)) || `ENTITY ${item.entity}`;
    const base: CaseInput = {
      sourceRunId,
      sourceDocumentId: `error_real_${item.entity}_${item.folio}`,
      vendorName: fallbackVendor,
      vendorRut: null,
      folio: item.folio,
      documentType: '33',
      bucket: 'error_real',
      status: 'new',
      summaryText: item.error,
      payloadJson: {
        source: 'mission-control dashboard',
        updatedAt: dashboard.updatedAt,
        classification: {
          bucket: 'error_real',
          reasonCode: 'accounting_error',
          summary: item.error,
        },
        context: {
          entity: item.entity,
          error: item.error,
        },
      },
    };
    cases.push(base);
  }

  for (const item of dashboard.revisionOCReferencial) {
    const fallbackVendor = entityVendorMap.get(String(item.entity)) || `ENTITY ${item.entity}`;
    const base: CaseInput = {
      sourceRunId,
      sourceDocumentId: `revision_oc_${item.entity}_${item.folio}`,
      vendorName: fallbackVendor,
      vendorRut: null,
      folio: item.folio,
      documentType: '33',
      bucket: 'revision_oc',
      status: 'new',
      summaryText: item.motivo,
      payloadJson: {
        source: 'mission-control dashboard',
        updatedAt: dashboard.updatedAt,
        classification: {
          bucket: 'revision_oc',
          reasonCode: 'missing_purchase_order',
          summary: item.motivo,
        },
        context: {
          entity: item.entity,
          referenciaAccount: item.referencia_account,
          categoriaOc: item.categoria_oc,
          learningCategory: item.learning_category,
          motivo: item.motivo,
        },
      },
    };
    cases.push(base);
  }

  for (const item of dashboard.rechazadasSII) {
    const base: CaseInput = {
      sourceRunId,
      sourceDocumentId: `rechazada_sii_${item.rut}_${item.folio}`,
      vendorName: item.razon_social,
      vendorRut: item.rut,
      folio: item.folio,
      documentType: '33',
      bucket: 'revision_oc',
      status: 'new',
      summaryText: item.motivo,
      payloadJson: {
        source: 'mission-control dashboard',
        updatedAt: dashboard.updatedAt,
        classification: {
          bucket: 'revision_oc',
          reasonCode: 'missing_oc_reference',
          summary: item.motivo,
        },
        context: {
          rut: item.rut,
          razonSocial: item.razon_social,
          motivo: item.motivo,
        },
      },
    };
    cases.push(base);
  }

  for (const baseCase of cases) {
    const context = (baseCase.payloadJson?.context as Record<string, unknown> | undefined) || {};
    const hydrateKeyByRut = `${baseCase.vendorRut || ''}::${baseCase.folio}::${baseCase.documentType}`;
    const hydrateKeyByEntity = `${String(context.entity || '')}::${baseCase.folio}::${baseCase.documentType}`;
    const hydrated = buildHydratedCase(baseCase, rowMap.get(hydrateKeyByRut) || rowMap.get(hydrateKeyByEntity));
    const result = await upsertCase(hydrated);
    if (result === 'inserted') inserted += 1;
    if (result === 'updated') updated += 1;
  }

  const demotedSeed = await demoteSeedCases();

  const summary = await db.query(`
    select bucket, status, count(*)::int as total
    from review_cases
    group by bucket, status
    order by bucket, status
  `);

  const sample = await db.query(`
    select vendor_name, vendor_rut, folio, bucket, status, amount_total, issue_date, reception_date
    from review_cases
    where bucket in ('revision_oc', 'error_real', 'rejected_sii')
    order by created_at desc
    limit 15
  `);

  console.log(JSON.stringify({ sourceRunId, inserted, updated, demotedSeed, summary: summary.rows, sample: sample.rows }, null, 2));
  await db.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.end();
  process.exit(1);
});
