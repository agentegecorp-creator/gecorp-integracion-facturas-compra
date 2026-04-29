import fs from 'node:fs';
import { db } from '../src/lib/db/client';

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

function readDelimited(path: string) {
  const raw = fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
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

function buildRowMap() {
  const rows = readDelimited('/Users/agentegecorp/.openclaw/workspace/proyectos/sii-netsuite/salida_revision_gonzalo_feb2026_enriquecida.csv');
  const map = new Map<string, Record<string, string>>();

  for (const row of rows) {
    const key = `${String(row.rut_proveedor || '').trim()}::${String(row.folio || '').trim()}::${String(row.tipo_doc || '').trim()}`;
    if (!map.has(key)) map.set(key, row);
  }

  return map;
}

async function main() {
  const rowMap = buildRowMap();
  const cases = await db.query(`
    select id, vendor_rut, folio, document_type, payload_json
    from review_cases
    where bucket in ('revision_oc', 'error_real', 'rejected_sii')
    order by created_at desc
  `);

  let updated = 0;

  for (const item of cases.rows) {
    const key = `${item.vendor_rut || ''}::${item.folio || ''}::${item.document_type || ''}`;
    const row = rowMap.get(key);
    if (!row) continue;

    const issueDate = parseDate(String(row.fecha_docto || ''));
    const receptionDate = parseDate(String(row.fecha_recepcion || ''));
    const amountTotal = parseNumber(String(row.monto_total || ''));
    const payload = item.payload_json || {};
    const nextPayload = {
      ...payload,
      source: 'pipeline enriched csv',
      enrichedFrom: 'salida_revision_gonzalo_feb2026_enriquecida.csv',
      context: {
        ...(payload.context || {}),
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
    };

    await db.query(
      `update review_cases
       set issue_date = coalesce($2, issue_date),
           reception_date = coalesce($3, reception_date),
           amount_total = coalesce($4, amount_total),
           payload_json = $5::jsonb,
           updated_at = now()
       where id = $1`,
      [item.id, issueDate, receptionDate, amountTotal, JSON.stringify(nextPayload)],
    );

    updated += 1;
  }

  const sample = await db.query(`
    select vendor_name, vendor_rut, folio, document_type, issue_date, reception_date, amount_total
    from review_cases
    where bucket in ('revision_oc', 'error_real', 'rejected_sii')
    order by created_at desc
    limit 12
  `);

  console.log(JSON.stringify({ updated, sample: sample.rows }, null, 2));
  await db.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.end();
  process.exit(1);
});
