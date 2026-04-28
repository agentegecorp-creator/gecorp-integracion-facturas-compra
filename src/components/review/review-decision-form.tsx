'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type DecisionType = 'approve' | 'correct_and_approve' | 'exception' | 'reject_for_learning';

export function ReviewDecisionForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [decisionType, setDecisionType] = useState<DecisionType>('approve');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/review-decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, decisionType, notes, corrections: {} }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'No se pudo guardar la decisión.');
        return;
      }

      setMessage('Decisión guardada correctamente.');
      setNotes('');
      router.refresh();
    } catch (err) {
      setError('Ocurrió un error de red al guardar la decisión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">Registrar decisión</h2>
        <p className="mt-1 text-sm text-slate-600">Primer flujo operativo para cerrar o escalar el caso.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Decisión</label>
        <select
          value={decisionType}
          onChange={(e) => setDecisionType(e.target.value as DecisionType)}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
        >
          <option value="approve">Aprobar</option>
          <option value="correct_and_approve">Corregir y aprobar</option>
          <option value="exception">Marcar excepción</option>
          <option value="reject_for_learning">Rechazar para aprendizaje</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Notas</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          placeholder="Observaciones de revisión, correcciones o motivo de excepción"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {loading ? 'Guardando...' : 'Guardar decisión'}
      </button>
    </form>
  );
}
