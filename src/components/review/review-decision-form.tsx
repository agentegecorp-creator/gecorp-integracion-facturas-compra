'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { accountOptions, documentTypeOptions, vendorOptions } from '@/lib/review/catalogs';

type DecisionType = 'approve' | 'correct_and_approve' | 'exception' | 'reject_for_learning';
type CorrectionField = 'account_id' | 'vendor_name' | 'accounting_date' | 'document_type';

type ReviewDecisionFormProps = {
  caseId: string;
  currentValues: {
    vendorName?: string | null;
    documentType?: string | null;
    issueDate?: string | null;
  };
  nextCaseId?: string | null;
};

export function ReviewDecisionForm({ caseId, currentValues, nextCaseId }: ReviewDecisionFormProps) {
  const router = useRouter();
  const [decisionType, setDecisionType] = useState<DecisionType>('approve');
  const [notes, setNotes] = useState('');
  const [correctionField, setCorrectionField] = useState<CorrectionField>('account_id');
  const [correctionValue, setCorrectionValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const correctionPayload = useMemo(() => {
    if (decisionType !== 'correct_and_approve' || !correctionField || !correctionValue) {
      return {};
    }

    return {
      [correctionField]: correctionValue,
    };
  }, [decisionType, correctionField, correctionValue]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (decisionType === 'correct_and_approve' && !correctionValue) {
      setError('Debes seleccionar un nuevo valor para la corrección.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/review-decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, decisionType, notes, corrections: correctionPayload }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'No se pudo guardar la decisión.');
        return;
      }

      setMessage('Decisión guardada correctamente.');
      setNotes('');
      setCorrectionValue('');
      router.refresh();
    } catch (err) {
      setError('Ocurrió un error de red al guardar la decisión.');
    } finally {
      setLoading(false);
    }
  }

  function renderCorrectionInput() {
    if (decisionType !== 'correct_and_approve') return null;

    if (correctionField === 'account_id') {
      return (
        <select
          value={correctionValue}
          onChange={(e) => setCorrectionValue(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
        >
          <option value="">Selecciona cuenta contable</option>
          {accountOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (correctionField === 'document_type') {
      return (
        <select
          value={correctionValue}
          onChange={(e) => setCorrectionValue(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
        >
          <option value="">Selecciona tipo documental</option>
          {documentTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (correctionField === 'accounting_date') {
      return (
        <input
          type="date"
          value={correctionValue}
          onChange={(e) => setCorrectionValue(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
        />
      );
    }

    if (correctionField === 'vendor_name') {
      return (
        <select
          value={correctionValue}
          onChange={(e) => setCorrectionValue(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
        >
          <option value="">Selecciona proveedor</option>
          {vendorOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        type="text"
        value={correctionValue}
        onChange={(e) => setCorrectionValue(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
        placeholder={currentValues.vendorName || 'Nuevo valor'}
      />
    );
  }

  async function goToNextPending() {
    try {
      const response = await fetch(`/api/review-cases/${caseId}/next`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'No se pudo obtener el siguiente caso.');
        return;
      }

      if (data.nextCaseId) {
        router.push(`/caso/${data.nextCaseId}`);
        router.refresh();
      } else {
        setMessage('No quedan casos pendientes por revisar.');
      }
    } catch (_err) {
      setError('Ocurrió un error al buscar el siguiente caso.');
    }
  }

  async function handleSaveAndNext() {
    setLoading(true);
    setError(null);
    setMessage(null);

    if (decisionType === 'correct_and_approve' && !correctionValue) {
      setError('Debes seleccionar un nuevo valor para la corrección.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/review-decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, decisionType, notes, corrections: correctionPayload }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'No se pudo guardar la decisión.');
        return;
      }

      if (nextCaseId) {
        router.push(`/caso/${nextCaseId}`);
        router.refresh();
      } else {
        setMessage('Decisión guardada. No quedan más casos pendientes.');
        router.refresh();
      }
    } catch (_err) {
      setError('Ocurrió un error de red al guardar y avanzar.');
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

      {decisionType === 'correct_and_approve' ? (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Campo a corregir</label>
            <select
              value={correctionField}
              onChange={(e) => {
                setCorrectionField(e.target.value as CorrectionField);
                setCorrectionValue('');
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            >
              <option value="account_id">Cuenta contable</option>
              <option value="vendor_name">Proveedor</option>
              <option value="accounting_date">Fecha contable</option>
              <option value="document_type">Tipo documental</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nuevo valor</label>
            {renderCorrectionInput()}
            <p className="mt-1 text-xs text-slate-500">
              Valor actual referencial: {correctionField === 'vendor_name'
                ? currentValues.vendorName || '-'
                : correctionField === 'document_type'
                  ? currentValues.documentType || '-'
                  : correctionField === 'accounting_date'
                    ? currentValues.issueDate || '-'
                    : 'según cuenta propuesta'}
            </p>
          </div>
        </>
      ) : null}

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

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? 'Guardando...' : 'Guardar decisión'}
        </button>
        <button
          type="button"
          onClick={handleSaveAndNext}
          disabled={loading}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-500 disabled:opacity-60"
        >
          Guardar y siguiente
        </button>
        <button
          type="button"
          onClick={goToNextPending}
          disabled={loading}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-60"
        >
          Siguiente pendiente
        </button>
      </div>
    </form>
  );
}
