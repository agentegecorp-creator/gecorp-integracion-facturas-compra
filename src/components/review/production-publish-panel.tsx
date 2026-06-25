'use client';

import { useState, useTransition } from 'react';

export function ProductionPublishPanel({
  readyCount,
  configReady,
  period,
}: {
  readyCount: number;
  configReady: boolean;
  period?: { startDate: string; endDate: string };
}) {
  const [limit, setLimit] = useState(Math.min(Math.max(readyCount, 1), 3));
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function publish() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch('/api/production-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit, period, confirmProduction: confirmed }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.message || 'No se pudo publicar a Producción.');
        return;
      }
      const selectedText = payload.totalSelected < limit
        ? ` Se tomaron ${payload.totalSelected} de ${limit} porque no había más casos publicables.`
        : ` Se tomaron ${payload.totalSelected} casos.`;
      setMessage(
        `Lote ${payload.runId}:${selectedText} Resultado: ${payload.createdCount} creados, ${payload.skippedCount} duplicados, ${payload.failedCount} fallidos.`,
      );
      setConfirmed(false);
    });
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-emerald-200">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Publicar a Producción</h2>
          <p className="mt-1 text-sm text-slate-600">
            Casos listos y pendientes de Producción: <span className="font-semibold text-slate-900">{readyCount}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Este flujo usa credenciales Producción, valida duplicados en NetSuite Producción y guarda estado separado.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Límite</span>
            <input
              type="number"
              min={1}
              max={10}
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              disabled={readyCount === 0 || !configReady || isPending}
            />
          </label>
          <label className="flex max-w-xs items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={readyCount === 0 || !configReady || isPending}
              className="h-4 w-4 rounded border-emerald-300"
            />
            Confirmo publicación real en Producción
          </label>
          <button
            type="button"
            onClick={publish}
            disabled={readyCount === 0 || !configReady || !confirmed || isPending}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isPending ? 'Publicando...' : 'Publicar a Producción'}
          </button>
        </div>
      </div>

      {!configReady ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Falta configurar credenciales NetSuite Producción en el ambiente de Vercel antes de publicar desde la web.
        </p>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">{message}</p>
      ) : null}
    </section>
  );
}
