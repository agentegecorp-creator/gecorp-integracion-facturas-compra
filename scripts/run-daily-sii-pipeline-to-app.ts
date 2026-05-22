import { execFileSync } from 'node:child_process';
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

const siiProjectDir = '/Users/agentegecorp/.openclaw/workspace/proyectos/sii-netsuite';
const appProjectDir = '/Users/agentegecorp/Projects/gecorp-integracion-facturas-compra';
const pipelineRunSummariesPath = path.join(appProjectDir, 'src/lib/review/pipeline-run-summaries.json');
const automaticCreatedDocumentsPath = path.join(appProjectDir, 'src/lib/review/automatic-created-documents.json');
const unclassifiedDocumentsPath = path.join(appProjectDir, 'src/lib/review/unclassified-documents.json');
const rcvSiiSummariesPath = path.join(appProjectDir, 'src/lib/review/rcv-sii-summaries.json');
const deployDataPaths = [
  pipelineRunSummariesPath,
  automaticCreatedDocumentsPath,
  unclassifiedDocumentsPath,
  rcvSiiSummariesPath,
];

function run(command: string, args: string[], cwd: string, extraEnv?: Record<string, string>) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
}

function hasGitChanges(pathsToCheck: string[]) {
  const relativePaths = pathsToCheck.map((filePath) => path.relative(appProjectDir, filePath));

  try {
    execFileSync('git', ['diff', '--quiet', '--', ...relativePaths], {
      cwd: appProjectDir,
      stdio: 'ignore',
      env: process.env,
    });
    return false;
  } catch {
    return true;
  }
}

function hasStagedGitChanges(pathsToCheck: string[]) {
  const relativePaths = pathsToCheck.map((filePath) => path.relative(appProjectDir, filePath));

  try {
    execFileSync('git', ['diff', '--cached', '--quiet', '--', ...relativePaths], {
      cwd: appProjectDir,
      stdio: 'ignore',
      env: process.env,
    });
    return false;
  } catch {
    return true;
  }
}

function latestRunDir() {
  const base = path.join(siiProjectDir, 'runs', 'sii_to_pipeline');
  const dirs = fs.readdirSync(base)
    .map((name) => path.join(base, name))
    .filter((full) => fs.statSync(full).isDirectory())
    .sort();

  return dirs[dirs.length - 1];
}

function currentMonthYear() {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
  };
}

function monthKey(month: string, year: string) {
  return `${year}-${String(Number(month)).padStart(2, '0')}`;
}

function parseNumber(value: string | undefined) {
  if (!value) return 0;
  return Number(value.replace(/\./g, '').replace(',', '.')) || 0;
}

function parseCsvLine(line: string) {
  return line.split(';');
}

function normalizeSiiDate(value: string | undefined) {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s|$)/);
  if (!match) return raw || null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function readSiiRowsByDocument(csvPath: string) {
  const text = fs.readFileSync(csvPath, 'utf8').trim();
  const [headerLine, ...lines] = text.split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  const indexes = new Map(headers.map((header, index) => [header, index]));
  const rows = new Map<string, Record<string, string | null>>();

  function value(columns: string[], header: string) {
    const index = indexes.get(header);
    return index === undefined ? '' : columns[index];
  }

  for (const line of lines) {
    if (!line.trim()) continue;
    const columns = parseCsvLine(line);
    const documentType = value(columns, 'Tipo Doc');
    const folio = value(columns, 'Folio');
    if (!documentType || !folio) continue;

    rows.set(`${documentType}:${folio}`, {
      vendorRut: value(columns, 'RUT Proveedor'),
      vendorName: value(columns, 'Razon Social'),
      folio,
      documentType,
      issueDate: normalizeSiiDate(value(columns, 'Fecha Docto')),
      receptionDate: normalizeSiiDate(value(columns, 'Fecha Recepcion')),
      amountExempt: String(parseNumber(value(columns, 'Monto Exento'))),
      amountNet: String(parseNumber(value(columns, 'Monto Neto'))),
      amountVat: String(parseNumber(value(columns, 'Monto IVA Recuperable'))),
      amountVatNonRecoverable: String(parseNumber(value(columns, 'Monto Iva No Recuperable'))),
      amountOtherTax: String(
        parseNumber(value(columns, 'Valor Otro Impuesto')) ||
        parseNumber(value(columns, 'Impto. Sin Derecho a Credito')),
      ),
      amountTotal: String(parseNumber(value(columns, 'Monto Total'))),
    });
  }

  return rows;
}

function updatePipelineRunSummary(month: string, year: string, runDir: string, reportJsonPath: string) {
  const report = JSON.parse(fs.readFileSync(reportJsonPath, 'utf8'));
  const existing = fs.existsSync(pipelineRunSummariesPath)
    ? JSON.parse(fs.readFileSync(pipelineRunSummariesPath, 'utf8'))
    : {};
  const resumen = report.resumen ?? {};
  const sourceRun = path.relative(siiProjectDir, runDir);
  const key = monthKey(month, year);

  existing[key] = {
    sourceRun,
    generatedAt: report.timestamp ?? new Date().toISOString(),
    mode: 'dry-run / Sandbox-STUB',
    createdAutomatically: Number(resumen.creadas ?? 0),
    duplicates: Number(resumen.duplicadas ?? 0),
    pendingApproval: Number(resumen.pendientes_aprobacion ?? 0),
    newVendors: Number(resumen.proveedores_nuevos ?? 0),
    rejectedSii: Number(resumen.rechazadas_sii ?? 0),
    accountingErrors: Number(resumen.errores ?? 0),
    revisionOcReferential: Number(resumen.revision_oc_referencial ?? 0),
  };

  fs.writeFileSync(pipelineRunSummariesPath, `${JSON.stringify(existing, null, 2)}\n`);
  console.log(`\nActualizado resumen pipeline para ${key}: ${pipelineRunSummariesPath}`);
}

function updateAutomaticCreatedDocuments(month: string, year: string, runDir: string, reportJsonPath: string, csvPath: string) {
  const report = JSON.parse(fs.readFileSync(reportJsonPath, 'utf8'));
  const created = Array.isArray(report.creadas) ? report.creadas : [];
  const existing = fs.existsSync(automaticCreatedDocumentsPath)
    ? JSON.parse(fs.readFileSync(automaticCreatedDocumentsPath, 'utf8'))
    : {};
  const siiRows = readSiiRowsByDocument(csvPath);
  const sourceRun = path.relative(siiProjectDir, runDir);
  const key = monthKey(month, year);

  existing[key] = created.map((item: Record<string, unknown>, index: number) => {
    const documentType = String(item.tipo_doc ?? '');
    const folio = String(item.folio ?? '');
    const siiRow = siiRows.get(`${documentType}:${folio}`) ?? {};
    const vendorName = String(siiRow.vendorName ?? item.proveedor ?? '');

    return {
      id: `auto-${key}-${documentType}-${folio}-${index}`,
      sourceRun,
      generatedAt: report.timestamp ?? new Date().toISOString(),
      vendor_name: vendorName,
      vendor_rut: siiRow.vendorRut ?? null,
      folio,
      document_type: documentType,
      issue_date: siiRow.issueDate ?? null,
      reception_date: siiRow.receptionDate ?? null,
      bucket: 'approved_auto',
      status: 'resolved',
      amount_total: String(siiRow.amountTotal ?? item.monto ?? 0),
      summary_text: `Creada automáticamente por pipeline SII → NetSuite (${report.resumen?.ambiente ?? 'Sandbox-STUB'}).`,
      sandbox_publish_status: 'published',
      payload_json: {
        document: {
          documentType,
          documentTypeLabel: documentType === '61' ? 'Nota de Crédito Electrónica (61)' : `Documento SII ${documentType}`,
          amountExempt: siiRow.amountExempt ?? 0,
          amountNet: siiRow.amountNet ?? 0,
          amountVat: siiRow.amountVat ?? 0,
          amountVatNonRecoverable: siiRow.amountVatNonRecoverable ?? 0,
          amountOtherTax: siiRow.amountOtherTax ?? 0,
          amountTotal: siiRow.amountTotal ?? item.monto ?? 0,
          purchaseOrderReference: item.po_vinculada ?? null,
          memo: `RCV F-${folio} ${vendorName}`,
        },
        context: {
          categoriaOc: item.categoria_oc ?? null,
          nsId: item.ns_id ?? null,
          sourceRun,
          automaticCreationMode: report.resumen?.ambiente ?? 'Sandbox-STUB',
        },
      },
    };
  });

  fs.writeFileSync(automaticCreatedDocumentsPath, `${JSON.stringify(existing, null, 2)}\n`);
  console.log(`Actualizados documentos automáticos para ${key}: ${automaticCreatedDocumentsPath}`);
}

function updateUnclassifiedDocuments(month: string, year: string, runDir: string, reportJsonPath: string, csvPath: string) {
  const report = JSON.parse(fs.readFileSync(reportJsonPath, 'utf8'));
  const existing = fs.existsSync(unclassifiedDocumentsPath)
    ? JSON.parse(fs.readFileSync(unclassifiedDocumentsPath, 'utf8'))
    : {};
  const siiRows = readSiiRowsByDocument(csvPath);
  const sourceRun = path.relative(siiProjectDir, runDir);
  const key = monthKey(month, year);
  const processedFolios = new Set<string>();

  for (const collectionName of ['creadas', 'pendientes_aprobacion', 'rechazadas_sii', 'revision_oc_referencial', 'errores']) {
    const collection = Array.isArray(report[collectionName]) ? report[collectionName] : [];
    for (const item of collection) {
      if (item?.folio !== undefined && item?.folio !== null) {
        processedFolios.add(String(item.folio));
      }
    }
  }

  existing[key] = Array.from(siiRows.values())
    .filter((row) => row.folio && !processedFolios.has(String(row.folio)))
    .map((row, index) => {
      const folio = String(row.folio ?? '');
      const documentType = String(row.documentType ?? '');
      const vendorName = String(row.vendorName ?? '');

      return {
        id: `unclassified-${key}-${documentType}-${folio}-${index}`,
        sourceRun,
        generatedAt: report.timestamp ?? new Date().toISOString(),
        vendor_name: vendorName,
        vendor_rut: row.vendorRut ?? null,
        folio,
        document_type: documentType,
        issue_date: row.issueDate ?? null,
        reception_date: row.receptionDate ?? null,
        bucket: 'unclassified_rcv',
        status: 'exception',
        amount_total: String(row.amountTotal ?? 0),
        summary_text: 'Documento del RCV sin clasificación operativa en la corrida SII → NetSuite.',
        sandbox_publish_status: 'not_ready',
        payload_json: {
          document: {
            documentType,
            documentTypeLabel: `Documento SII ${documentType}`,
            amountExempt: row.amountExempt ?? 0,
            amountNet: row.amountNet ?? 0,
            amountVat: row.amountVat ?? 0,
            amountVatNonRecoverable: row.amountVatNonRecoverable ?? 0,
            amountOtherTax: row.amountOtherTax ?? 0,
            amountTotal: row.amountTotal ?? 0,
            memo: `RCV F-${folio} ${vendorName}`,
          },
          context: {
            motivo: 'No aparece en creadas automáticas, revisión, errores, rechazos ni proveedores nuevos del reporte pipeline.',
            sourceRun,
          },
        },
      };
    });

  fs.writeFileSync(unclassifiedDocumentsPath, `${JSON.stringify(existing, null, 2)}\n`);
  console.log(`Actualizados documentos fuera de flujo para ${key}: ${unclassifiedDocumentsPath}`);
}

function deployDashboardData(month: string, year: string) {
  if (process.env.SKIP_VERCEL_DEPLOY === '1') {
    console.log('\nSKIP_VERCEL_DEPLOY=1: no se publican cambios del dashboard en Vercel.');
    return;
  }

  if (!hasGitChanges(deployDataPaths)) {
    console.log('\nSin cambios en JSON operativos; no se gatilla deploy de Vercel.');
    return;
  }

  const relativePaths = deployDataPaths.map((filePath) => path.relative(appProjectDir, filePath));
  const commitMessage = `Refresh SII dashboard data ${monthKey(month, year)}`;

  run('npm', ['run', 'build'], appProjectDir);
  run('git', ['add', ...relativePaths], appProjectDir);

  if (!hasStagedGitChanges(deployDataPaths)) {
    console.log('\nNo hay cambios staged en JSON operativos; no se crea commit.');
    return;
  }

  run('git', ['commit', '-m', commitMessage], appProjectDir);
  run('git', ['push', 'origin', 'main'], appProjectDir, { HOME: '/Users/agentegecorp' });
  console.log('\nCambios de dashboard publicados en main; Vercel tomará el deploy automáticamente.');
}

function main() {
  const monthArg = process.argv[2];
  const yearArg = process.argv[3];
  const current = currentMonthYear();
  const month = monthArg || current.month;
  const year = yearArg || current.year;

  run('python3', ['run_sii_to_pipeline.py', '--month', month, '--year', year, '--dry-run'], siiProjectDir);

  const runDir = latestRunDir();
  const summaryPath = path.join(runDir, 'summary.json');
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

  console.log('\nResumen wrapper:');
  console.log(JSON.stringify(summary, null, 2));

  updatePipelineRunSummary(month, year, runDir, summary.report_json_path);
  updateAutomaticCreatedDocuments(month, year, runDir, summary.report_json_path, summary.csv_path);
  updateUnclassifiedDocuments(month, year, runDir, summary.report_json_path, summary.csv_path);
  run('npx', ['tsx', 'scripts/generate-rcv-sii-summary.ts'], appProjectDir);
  run('npx', ['tsx', 'scripts/import-review-cases-from-builder-json.ts'], appProjectDir);
  deployDashboardData(month, year);

  console.log('\nFlujo operativo completo ejecutado:');
  console.log(JSON.stringify({
    month,
    year,
    runDir,
    csvPath: summary.csv_path,
    reportJsonPath: summary.report_json_path,
    reviewBuilderReturncode: summary.review_builder_returncode,
  }, null, 2));
}

main();
