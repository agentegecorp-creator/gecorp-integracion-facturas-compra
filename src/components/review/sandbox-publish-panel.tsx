'use client';

import { useState, useTransition } from 'react';

const SANDBOX_PUBLISH_DISABLED = true;

export function SandboxPublishPanel({
  readyCount,
  configReady,
  period,
}: {
  readyCount: number;
  configReady: boolean;
  period?: { startDate: string; endDate: string };
}) {
  const [limit, setLimit] = useState(Math.min(Math.max(readyCount, 1), 10));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function publish() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch('/api/sandbox-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit, period }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.message || 'No se pudo publicar a Sandbox.');
        return;
      }
      const selectedText = payload.totalSelected < limit
        ? ` Se tomaron ${payload.totalSelected} de ${limit} porque no había más casos publicables.`
        : ` Se tomaron ${payload.totalSelected} casos.`;
      setMessage(
        `Lote ${payload.runId}:${selectedText} Resultado: ${payload.createdCount} creados, ${payload.skippedCount} duplicados, ${payload.failedCount} fallidos.`,
      );
    });
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Publicar a Sandbox</h2>
          <p className="mt-1 text-sm text-slate-600">
            Casos aprobados y publicables pendientes: <span className="font-semibold text-slate-900">{readyCount}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Publicación desactivada temporalmente mientras se prepara el paso controlado a Producción.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Límite</span>
            <input
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              disabled={SANDBOX_PUBLISH_DISABLED || readyCount === 0 || !configReady || isPending}
            />
          </label>
          <button
            type="button"
            onClick={publish}
            disabled={SANDBOX_PUBLISH_DISABLED || readyCount === 0 || !configReady || isPending}
            className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {SANDBOX_PUBLISH_DISABLED ? 'Sandbox desactivado' : isPending ? 'Publicando...' : 'Publicar a Sandbox'}
          </button>
        </div>
      </div>

      {SANDBOX_PUBLISH_DISABLED ? (
        <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
          La publicación a Sandbox está bloqueada para evitar confusión durante la etapa de Producción.
        </p>
      ) : null}

      {!configReady ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Falta configurar credenciales NetSuite Sandbox en el ambiente de Vercel antes de publicar desde la web.
        </p>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">{message}</p>
      ) : null}
    </section>
  );
}
