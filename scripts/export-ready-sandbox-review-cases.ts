import fs from 'node:fs/promises';
import path from 'node:path';
import { listReadyForSandbox } from '@/lib/db/queries';

async function main() {
  const limitArg = Number(process.argv[2] || '100');
  const limit = Number.isFinite(limitArg) ? Math.max(1, Math.min(limitArg, 500)) : 100;
  const items = await listReadyForSandbox(limit);

  const outDir = path.resolve(process.cwd(), 'exports');
  await fs.mkdir(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `ready-sandbox-review-cases-${timestamp}.json`);

  await fs.writeFile(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        total: items.length,
        items,
      },
      null,
      2,
    ),
    'utf-8',
  );

  console.log(outPath);
  console.log(`${items.length} cases exported`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
