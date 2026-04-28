import { db } from '../src/lib/db/client';

const cases = [
  {
    sourceRunId: 'run_2026_04_28_120000',
    sourceDocumentId: 'doc_bermann_162451',
    vendorName: 'COMUNICACIONES BERMANN SPA',
    vendorRut: '76123456-7',
    folio: '162451',
    documentType: '33',
    issueDate: '2026-02-02',
    receptionDate: '2026-02-03',
    amountNet: 100000,
    amountTax: 19000,
    amountTotal: 119000,
    bucket: 'pending_review',
    status: 'new',
    summaryText: 'Caso validado en sandbox, queda cargado como muestra operativa inicial.',
    payloadJson: {
      vendor: { name: 'COMUNICACIONES BERMANN SPA', rut: '76123456-7' },
      document: {
        folio: '162451', documentType: '33', issueDate: '2026-02-02', receptionDate: '2026-02-03',
        currency: 'CLP', amountNet: 100000, amountTax: 19000, amountTotal: 119000,
      },
      classification: {
        bucket: 'pending_review', status: 'new', summary: 'Proveedor con datos válidos, requiere revisión manual inicial.', reasonCode: 'manual_review_required',
      },
      context: {
        purchaseOrderReference: null, purchaseOrderMatchType: 'none', xmlAvailable: true, sandboxReady: true,
        postingPeriodCandidate: '2026-02', suggestedEntity: 'COMUNICACIONES BERMANN SPA', suggestedAccount: 'Por confirmar',
      },
      pipeline: { stage: 'review_queue', runMode: 'sandbox', origin: 'sii_csv', generatedAt: '2026-04-28T12:00:00Z' },
    },
  },
  {
    sourceRunId: 'run_2026_04_28_120000',
    sourceDocumentId: 'doc_claro_2429571',
    vendorName: 'CLARO COMUNICACIONES SA',
    vendorRut: '96799250-0',
    folio: '2429571',
    documentType: '33',
    issueDate: '2026-02-10',
    receptionDate: '2026-02-10',
    amountNet: 85000,
    amountTax: 16150,
    amountTotal: 101150,
    bucket: 'pending_review',
    status: 'new',
    summaryText: 'Documento exitoso en sandbox, útil como caso base de telecomunicaciones.',
    payloadJson: {
      vendor: { name: 'CLARO COMUNICACIONES SA', rut: '96799250-0' },
      document: {
        folio: '2429571', documentType: '33', issueDate: '2026-02-10', receptionDate: '2026-02-10',
        currency: 'CLP', amountNet: 85000, amountTax: 16150, amountTotal: 101150,
      },
      classification: {
        bucket: 'pending_review', status: 'new', summary: 'Caso limpio para revisión operativa inicial.', reasonCode: 'manual_review_required',
      },
      context: {
        purchaseOrderReference: null, purchaseOrderMatchType: 'none', xmlAvailable: true, sandboxReady: true,
        postingPeriodCandidate: '2026-02', suggestedEntity: 'CLARO COMUNICACIONES SA', suggestedAccount: 'Por confirmar',
      },
      pipeline: { stage: 'review_queue', runMode: 'sandbox', origin: 'sii_csv', generatedAt: '2026-04-28T12:00:00Z' },
    },
  },
  {
    sourceRunId: 'run_2026_04_28_120000',
    sourceDocumentId: 'doc_recuperos_2764',
    vendorName: 'RECUPEROS SA',
    vendorRut: '76000000-1',
    folio: '2764',
    documentType: '33',
    issueDate: '2026-02-11',
    receptionDate: '2026-02-11',
    amountNet: 45000,
    amountTax: 8550,
    amountTotal: 53550,
    bucket: 'pending_review',
    status: 'new',
    summaryText: 'Caso corto y simple para validar navegación en la cola.',
    payloadJson: {
      vendor: { name: 'RECUPEROS SA', rut: '76000000-1' },
      document: {
        folio: '2764', documentType: '33', issueDate: '2026-02-11', receptionDate: '2026-02-11',
        currency: 'CLP', amountNet: 45000, amountTax: 8550, amountTotal: 53550,
      },
      classification: {
        bucket: 'pending_review', status: 'new', summary: 'Caso simple para poblar la cola MVP.', reasonCode: 'manual_review_required',
      },
      context: {
        purchaseOrderReference: null, purchaseOrderMatchType: 'none', xmlAvailable: true, sandboxReady: true,
        postingPeriodCandidate: '2026-02', suggestedEntity: 'RECUPEROS SA', suggestedAccount: 'Por confirmar',
      },
      pipeline: { stage: 'review_queue', runMode: 'sandbox', origin: 'sii_csv', generatedAt: '2026-04-28T12:00:00Z' },
    },
  },
  {
    sourceRunId: 'run_2026_04_28_120000',
    sourceDocumentId: 'doc_macaf_216',
    vendorName: 'MACAF / SOCIEDAD DE TRANSPORTES',
    vendorRut: '76111111-1',
    folio: '216',
    documentType: '33',
    issueDate: '2026-02-15',
    receptionDate: '2026-02-16',
    amountNet: 120000,
    amountTax: 22800,
    amountTotal: 142800,
    bucket: 'revision_oc',
    status: 'new',
    summaryText: 'Caso para representar revisión con referencia operativa adicional.',
    payloadJson: {
      vendor: { name: 'MACAF / SOCIEDAD DE TRANSPORTES', rut: '76111111-1' },
      document: {
        folio: '216', documentType: '33', issueDate: '2026-02-15', receptionDate: '2026-02-16',
        currency: 'CLP', amountNet: 120000, amountTax: 22800, amountTotal: 142800,
      },
      classification: {
        bucket: 'revision_oc', status: 'new', summary: 'Proveedor con revisión referencial de OC pendiente.', reasonCode: 'missing_purchase_order',
      },
      context: {
        purchaseOrderReference: 'OC-REFERENCIAL', purchaseOrderMatchType: 'referential', xmlAvailable: true, sandboxReady: true,
        postingPeriodCandidate: '2026-02', suggestedEntity: 'MACAF / SOCIEDAD DE TRANSPORTES', suggestedAccount: '704',
      },
      pipeline: { stage: 'review_queue', runMode: 'sandbox', origin: 'sii_csv', generatedAt: '2026-04-28T12:00:00Z' },
    },
  },
  {
    sourceRunId: 'run_2026_04_28_120000',
    sourceDocumentId: 'doc_manantial_6455297',
    vendorName: 'MANANTIAL',
    vendorRut: '76222222-2',
    folio: '6455297',
    documentType: '33',
    issueDate: '2026-01-31',
    receptionDate: '2026-02-01',
    amountNet: 92000,
    amountTax: 17480,
    amountTotal: 109480,
    bucket: 'pending_review',
    status: 'new',
    summaryText: 'Caso representativo de cruce entre fecha documento y fecha recepción.',
    payloadJson: {
      vendor: { name: 'MANANTIAL', rut: '76222222-2' },
      document: {
        folio: '6455297', documentType: '33', issueDate: '2026-01-31', receptionDate: '2026-02-01',
        currency: 'CLP', amountNet: 92000, amountTax: 17480, amountTotal: 109480,
      },
      classification: {
        bucket: 'pending_review', status: 'new', summary: 'Caso validado para regla de fecha contable por recepción.', reasonCode: 'manual_review_required',
      },
      context: {
        purchaseOrderReference: null, purchaseOrderMatchType: 'none', xmlAvailable: true, sandboxReady: true,
        postingPeriodCandidate: '2026-02', suggestedEntity: 'MANANTIAL', suggestedAccount: 'Por confirmar',
      },
      pipeline: { stage: 'review_queue', runMode: 'sandbox', origin: 'sii_csv', generatedAt: '2026-04-28T12:00:00Z' },
    },
  },
];

async function main() {
  for (const item of cases) {
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
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'CLP',$12,$13,$14,$15::jsonb
      )
      on conflict do nothing`,
      [
        item.sourceRunId,
        item.sourceDocumentId,
        item.vendorName,
        item.vendorRut,
        item.folio,
        item.documentType,
        item.issueDate,
        item.receptionDate,
        item.amountNet,
        item.amountTax,
        item.amountTotal,
        item.bucket,
        item.status,
        item.summaryText,
        JSON.stringify(item.payloadJson),
      ],
    );
  }

  const result = await db.query(
    `select id, vendor_name, folio, bucket, status, amount_total
     from review_cases
     order by created_at desc`,
  );

  console.log(JSON.stringify(result.rows, null, 2));
  await db.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.end();
  process.exit(1);
});
