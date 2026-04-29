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

function main() {
  const month = process.argv[2];
  const year = process.argv[3];

  if (!month || !year) {
    console.error('Uso: npx tsx scripts/run-daily-sii-pipeline-to-app.ts <month> <year>');
    process.exit(1);
  }

  run('python3', ['run_sii_to_pipeline.py', '--month', month, '--year', year, '--dry-run'], siiProjectDir);

  const runDir = latestRunDir();
  const summaryPath = path.join(runDir, 'summary.json');
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

  console.log('\nResumen wrapper:');
  console.log(JSON.stringify(summary, null, 2));

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
