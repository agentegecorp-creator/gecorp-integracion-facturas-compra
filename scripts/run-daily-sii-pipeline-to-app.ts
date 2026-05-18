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

function run(command: string, args: string[], cwd: string) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
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
  run('npx', ['tsx', 'scripts/generate-rcv-sii-summary.ts'], appProjectDir);
  run('npx', ['tsx', 'scripts/import-review-cases-from-builder-json.ts'], appProjectDir);

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
