import { requestNetSuite } from '@/lib/netsuite/sandbox-publisher';

export type VendorRutRow = Record<string, unknown>;
export type VendorRutQueryResult = { items?: VendorRutRow[]; hasMore?: boolean };
type Query = (sql: string) => Promise<VendorRutQueryResult>;

function normalized(value: unknown) {
  return String(value ?? '').toUpperCase().replace(/[.\s-]/g, '');
}

function parseRut(value: unknown) {
  const rut = normalized(value);
  if (!/^\d{1,8}[0-9K]$/.test(rut)) return null;
  const body = rut.slice(0, -1).replace(/^0+(?=\d)/, '');
  const dv = rut.slice(-1);
  let sum = 0;
  for (let i = body.length - 1, factor = 2; i >= 0; i--, factor = factor === 7 ? 2 : factor + 1) sum += Number(body[i]) * factor;
  const check = 11 - sum % 11;
  if (dv !== (check === 11 ? '0' : check === 10 ? 'K' : String(check))) return null;
  return { body, dv, full: body + dv };
}

function matchesVendor(row: VendorRutRow, rut: NonNullable<ReturnType<typeof parseRut>>) {
  if (String(row.isinactive).toUpperCase() !== 'F' || !/^\d+$/.test(String(row.id ?? ''))) return false;
  const document = normalized(row.custentity_gd_documento);
  const dv = normalized(row.custentity_gd_digito_de_verificacion);
  // El dato fiscal es autoritativo: un nombre similar no puede contradecirlo.
  if (document) return (document === rut.body && dv === rut.dv) || (document === rut.full && (!dv || dv === rut.dv));
  // Compatibilidad con proveedores antiguos: exigir RUT completo, no un substring del cuerpo.
  const dotted = rut.body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const token = new RegExp(`(^|[^0-9])(?:${rut.body}|${dotted.replace(/\./g, '\\.')})\\s*-?\\s*${rut.dv}(?=$|[^0-9A-Z])`, 'i');
  return token.test(String(row.entityid ?? '')) || token.test(String(row.altname ?? ''));
}

async function productionQuery(sql: string): Promise<VendorRutQueryResult> {
  const result = await requestNetSuite('POST', '/services/rest/query/v1/suiteql', { q: sql }, { prefer: 'transient' }, 'production');
  if (!result.success) throw new Error(`Busqueda fiscal de proveedor incompleta: NetSuite HTTP ${result.status}`);
  return result.body as VendorRutQueryResult;
}

/** Sólo lectura. Devuelve todos los candidatos exactos; el llamador exige uno único. */
export async function findActiveVendorsByFiscalRut(value: unknown, query: Query = productionQuery): Promise<VendorRutRow[]> {
  const rut = parseRut(value);
  if (!rut) return [];
  const dotted = rut.body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const result = await query(`
    SELECT id, entityid, altname, isinactive, custentity_gd_documento, custentity_gd_digito_de_verificacion
    FROM vendor
    WHERE isinactive = 'F' AND (
      REGEXP_REPLACE(UPPER(custentity_gd_documento), '[^0-9K]', '') IN ('${rut.body}', '${rut.full}')
      OR entityid LIKE '%${rut.body}%' OR altname LIKE '%${rut.body}%'
      OR entityid LIKE '%${dotted}%' OR altname LIKE '%${dotted}%'
    )
  `);
  if (result.hasMore) throw new Error('Busqueda fiscal de proveedor incompleta: resultados paginados; no seleccionar automaticamente');
  if (!Array.isArray(result.items)) throw new Error('Busqueda fiscal de proveedor incompleta: respuesta sin items');
  return [...new Map(result.items.filter(row => matchesVendor(row, rut)).map(row => [String(row.id), row])).values()];
}
