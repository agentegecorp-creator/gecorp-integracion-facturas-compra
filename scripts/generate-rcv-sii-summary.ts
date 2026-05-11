import fs from 'node:fs';
import path from 'node:path';

type SummaryRow = {
  documentType: string;
  totalDocuments: number;
  montoExento: number;
  montoNeto: number;
  ivaRecuperable: number;
  ivaUsoComun: number;
  ivaNoRecuperable: number;
  montoOtrosImpuestos: number;
  montoTotal: number;
};

const inputDir = '/Users/agentegecorp/.openclaw/workspace/proyectos/sii-netsuite/input/sii_downloads';
const outputPath = path.join(process.cwd(), 'src/lib/review/rcv-sii-summaries.json');

function parseNumber(value: string | undefined) {
  if (!value) return 0;
  return Number(value.replace(/\./g, '').replace(',', '.')) || 0;
}

function monthKeyFromFilename(filename: string) {
  const match = filename.match(/_(\d{6})\.csv$/);
  if (!match) return null;
  return `${match[1].slice(0, 4)}-${match[1].slice(4, 6)}`;
}

function parseCsvLine(line: string) {
  return line.split(';');
}

function summarizeFile(filePath: string) {
  const text = fs.readFileSync(filePath, 'utf8').trim();
  const [headerLine, ...lines] = text.split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  const indexes = new Map(headers.map((header, index) => [header, index]));
  const rows = new Map<string, SummaryRow>();

  function value(columns: string[], header: string) {
    const index = indexes.get(header);
    return index === undefined ? '' : columns[index];
  }

  for (const line of lines) {
    if (!line.trim()) continue;

    const columns = parseCsvLine(line);
    const documentType = value(columns, 'Tipo Doc') || 'Sin tipo';

    if (!rows.has(documentType)) {
      rows.set(documentType, {
        documentType,
        totalDocuments: 0,
        montoExento: 0,
        montoNeto: 0,
        ivaRecuperable: 0,
        ivaUsoComun: 0,
        ivaNoRecuperable: 0,
        montoOtrosImpuestos: 0,
        montoTotal: 0,
      });
    }

    const row = rows.get(documentType)!;
    row.totalDocuments += 1;
    row.montoExento += parseNumber(value(columns, 'Monto Exento'));
    row.montoNeto += parseNumber(value(columns, 'Monto Neto'));
    row.ivaRecuperable += parseNumber(value(columns, 'Monto IVA Recuperable'));
    row.ivaUsoComun += parseNumber(value(columns, 'IVA uso Comun'));
    row.ivaNoRecuperable += parseNumber(value(columns, 'Monto Iva No Recuperable'));
    const valorOtroImpuesto = parseNumber(value(columns, 'Valor Otro Impuesto'));
    const impuestoSinCredito = parseNumber(value(columns, 'Impto. Sin Derecho a Credito'));
    row.montoOtrosImpuestos += valorOtroImpuesto || impuestoSinCredito;
    row.montoTotal += parseNumber(value(columns, 'Monto Total'));
  }

  return Array.from(rows.values()).sort((a, b) => a.documentType.localeCompare(b.documentType, 'es'));
}

const summaries = fs
  .readdirSync(inputDir)
  .filter((filename) => /^RCV_COMPRA_REGISTRO_.*_\d{6}\.csv$/.test(filename))
  .sort()
  .reduce<Record<string, { sourceFile: string; generatedAt: string; rows: SummaryRow[] }>>((acc, filename) => {
    const key = monthKeyFromFilename(filename);
    if (!key) return acc;

    acc[key] = {
      sourceFile: filename,
      generatedAt: new Date().toISOString(),
      rows: summarizeFile(path.join(inputDir, filename)),
    };

    return acc;
  }, {});

fs.writeFileSync(outputPath, `${JSON.stringify(summaries, null, 2)}\n`);
console.log(`Wrote ${Object.keys(summaries).length} RCV SII summaries to ${outputPath}`);
