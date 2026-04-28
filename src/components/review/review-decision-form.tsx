'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type DecisionType = 'approve' | 'correct_and_approve' | 'exception' | 'reject_for_learning';
type CorrectionField = 'account_id' | 'vendor_name' | 'accounting_date' | 'document_type';

type ReviewDecisionFormProps = {
  caseId: string;
  currentValues: {
    vendorName?: string | null;
    documentType?: string | null;
    issueDate?: string | null;
  };
};

const ACCOUNT_OPTIONS = [
  { value: '112', label: '112 · 212013 COMPRAS ACUMULADAS' },
  { value: '694', label: '694 · 450205 ALMACENAJE' },
  { value: '699', label: '699 · 460104 ASESORIA CONTABLE' },
  { value: '704', label: '704 · 460109 GASTOS GENERALES' },
  { value: '1048', label: '1048 · 212008 FACTURAS POR RECIBIR' },
];

const DOCUMENT_TYPE_OPTIONS = [
  { value: '33', label: '33 · Factura afecta' },
  { value: '34', label: '34 · Factura exenta' },
  { value: '61', label: '61 · Nota de crédito' },
];

export function ReviewDecisionForm({ caseId, currentValues }: ReviewDecisionFormProps) {
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
          {ACCOUNT_OPTIONS.map((option) => (
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
          {DOCUMENT_TYPE_OPTIONS.map((option) => (
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
