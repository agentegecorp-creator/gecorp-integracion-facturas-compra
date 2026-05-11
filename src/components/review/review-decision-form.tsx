'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  accountOptions,
  classOptions,
  departmentOptions,
  documentTypeOptions,
  locationOptions,
  vendorOptions,
} from '@/lib/review/catalogs';
import { correctionFieldLabel, decisionLabel } from '@/lib/review/labels';

type DecisionType = 'approve' | 'correct_and_approve' | 'exception' | 'reject_for_learning';
type CorrectionField =
  | 'account_id'
  | 'vendor_name'
  | 'issue_date'
  | 'accounting_date'
  | 'due_date'
  | 'payment_date'
  | 'document_type'
  | 'approval_group'
  | 'oc_category'
  | 'oc_policy'
  | 'class_id'
  | 'department_id'
  | 'location_id'
  | 'new_vendor_entity';

type SelectOption = {
  value: string;
  label: string;
};

type ReviewDecisionFormProps = {
  caseId: string;
  currentValues: {
    vendorName?: string | null;
    documentType?: string | null;
    issueDate?: string | Date | null;
    accountingDate?: string | Date | null;
    dueDate?: string | Date | null;
    paymentDate?: string | Date | null;
    classId?: string | number | null;
    departmentId?: string | number | null;
    locationId?: string | number | null;
  };
};

function formatReferenceValue(value: string | number | Date | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

export function ReviewDecisionForm({ caseId, currentValues }: ReviewDecisionFormProps) {
  const router = useRouter();
  const [decisionType, setDecisionType] = useState<DecisionType>('approve');
  const [notes, setNotes] = useState('');
  const [correctionField, setCorrectionField] = useState<CorrectionField>('account_id');
  const [correctionValue, setCorrectionValue] = useState('');
  const [newVendorForm, setNewVendorForm] = useState({
    approvalGroup: '',
    accountId: '',
    classId: '',
    departmentId: '',
    locationId: '',
    ocCategory: '',
    ocPolicy: '',
    entity: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const correctionPayload = useMemo(() => {
    if (decisionType !== 'correct_and_approve') {
      return {};
    }

    if (correctionField === 'new_vendor_entity') {
      return Object.fromEntries(
        Object.entries({
          approval_group: newVendorForm.approvalGroup,
          account_id: newVendorForm.accountId,
          class_id: newVendorForm.classId,
          department_id: newVendorForm.departmentId,
          location_id: newVendorForm.locationId,
          oc_category: newVendorForm.ocCategory,
          oc_policy: newVendorForm.ocPolicy,
          new_vendor_entity: newVendorForm.entity,
        }).filter(([, value]) => value),
      );
    }

    if (!correctionField || !correctionValue) {
      return {};
    }

    return {
      [correctionField]: correctionValue,
    };
  }, [decisionType, correctionField, correctionValue, newVendorForm]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (decisionType === 'correct_and_approve') {
      const hasNewVendorPayload = correctionField === 'new_vendor_entity' && Object.keys(correctionPayload).length > 0;
      if (!correctionValue && !hasNewVendorPayload) {
        setError('Debes seleccionar un nuevo valor para la corrección.');
        setLoading(false);
        return;
      }
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
      setNewVendorForm({
        approvalGroup: '',
        accountId: '',
        classId: '',
        departmentId: '',
        locationId: '',
        ocCategory: '',
        ocPolicy: '',
        entity: '',
      });
      router.refresh();
    } catch (err) {
      setError('Ocurrió un error de red al guardar la decisión.');
    } finally {
      setLoading(false);
    }
  }

  function renderSelect(placeholder: string, options: SelectOption[]) {
    return (
      <select
        value={correctionValue}
        onChange={(e) => setCorrectionValue(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  function renderDateInput() {
    return (
      <input
        type="date"
        value={correctionValue}
        onChange={(e) => setCorrectionValue(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
      />
    );
  }

  function renderCorrectionInput() {
    if (decisionType !== 'correct_and_approve') return null;

    if (correctionField === 'account_id') {
      return renderSelect('Selecciona cuenta contable', accountOptions);
    }

    if (correctionField === 'document_type') {
      return renderSelect('Selecciona tipo documental', documentTypeOptions);
    }

    if (correctionField === 'issue_date' || correctionField === 'accounting_date' || correctionField === 'due_date' || correctionField === 'payment_date') {
      return renderDateInput();
    }

    if (correctionField === 'class_id') {
      return renderSelect('Selecciona clase', classOptions);
    }

    if (correctionField === 'department_id') {
      return renderSelect('Selecciona departamento', departmentOptions);
    }

    if (correctionField === 'location_id') {
      return renderSelect('Selecciona ubicación', locationOptions);
    }

    if (correctionField === 'approval_group') {
      return (
        <input
          type="text"
          value={correctionValue}
          onChange={(e) => setCorrectionValue(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          placeholder="Ej: Finanzas, Compras, Gonzalo"
        />
      );
    }

    if (correctionField === 'oc_category') {
      return (
        <input
          type="text"
          value={correctionValue}
          onChange={(e) => setCorrectionValue(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          placeholder="Ej: FLETE NACIONAL, RECHAZO_SII, INSUMOS"
        />
      );
    }

    if (correctionField === 'oc_policy') {
      return (
        <select
          value={correctionValue}
          onChange={(e) => setCorrectionValue(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
        >
          <option value="">Selecciona política OC</option>
          <option value="SIN OC">SIN OC</option>
          <option value="OC OBLIGATORIA">OC OBLIGATORIA</option>
        </select>
      );
    }

    if (correctionField === 'new_vendor_entity') {
      return (
        <div className="grid gap-3">
          <input
            type="text"
            value={newVendorForm.approvalGroup}
            onChange={(e) => setNewVendorForm((current) => ({ ...current, approvalGroup: e.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            placeholder="Grupo de aprobación"
          />
          <select
            value={newVendorForm.accountId}
            onChange={(e) => setNewVendorForm((current) => ({ ...current, accountId: e.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          >
            <option value="">Selecciona cuenta contable</option>
            {accountOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={newVendorForm.classId}
            onChange={(e) => setNewVendorForm((current) => ({ ...current, classId: e.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          >
            <option value="">Selecciona clase</option>
            {classOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={newVendorForm.departmentId}
            onChange={(e) => setNewVendorForm((current) => ({ ...current, departmentId: e.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          >
            <option value="">Selecciona departamento</option>
            {departmentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={newVendorForm.locationId}
            onChange={(e) => setNewVendorForm((current) => ({ ...current, locationId: e.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          >
            <option value="">Selecciona ubicación</option>
            {locationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newVendorForm.ocCategory}
            onChange={(e) => setNewVendorForm((current) => ({ ...current, ocCategory: e.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            placeholder="Categoría Gasto"
          />
          <select
            value={newVendorForm.ocPolicy}
            onChange={(e) => setNewVendorForm((current) => ({ ...current, ocPolicy: e.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          >
            <option value="">Selecciona política OC</option>
            <option value="SIN OC">SIN OC</option>
            <option value="OC OBLIGATORIA">OC OBLIGATORIA</option>
          </select>
          <input
            type="text"
            value={newVendorForm.entity}
            onChange={(e) => setNewVendorForm((current) => ({ ...current, entity: e.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            placeholder="Entity NetSuite"
          />
        </div>
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
          <option value="approve">{decisionLabel('approve')}</option>
          <option value="correct_and_approve">{decisionLabel('correct_and_approve')}</option>
          <option value="exception">{decisionLabel('exception')}</option>
          <option value="reject_for_learning">{decisionLabel('reject_for_learning')}</option>
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
              <option value="account_id">{correctionFieldLabel('account_id')}</option>
              <option value="vendor_name">{correctionFieldLabel('vendor_name')}</option>
              <option value="issue_date">{correctionFieldLabel('issue_date')}</option>
              <option value="accounting_date">{correctionFieldLabel('accounting_date')}</option>
              <option value="due_date">{correctionFieldLabel('due_date')}</option>
              <option value="payment_date">{correctionFieldLabel('payment_date')}</option>
              <option value="document_type">{correctionFieldLabel('document_type')}</option>
              <option value="class_id">{correctionFieldLabel('class_id')}</option>
              <option value="department_id">{correctionFieldLabel('department_id')}</option>
              <option value="location_id">{correctionFieldLabel('location_id')}</option>
              <option value="approval_group">Grupo de aprobación</option>
              <option value="oc_category">Categoría Gasto</option>
              <option value="oc_policy">Política OC</option>
              <option value="new_vendor_entity">Alta de proveedor nuevo</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nuevo valor</label>
            {renderCorrectionInput()}
            <p className="mt-1 text-xs text-slate-500">
              Valor actual referencial: {correctionField === 'vendor_name'
                ? formatReferenceValue(currentValues.vendorName)
                : correctionField === 'document_type'
                  ? formatReferenceValue(currentValues.documentType)
                  : correctionField === 'issue_date'
                    ? formatReferenceValue(currentValues.issueDate)
                    : correctionField === 'accounting_date'
                      ? formatReferenceValue(currentValues.accountingDate)
                      : correctionField === 'due_date'
                        ? formatReferenceValue(currentValues.dueDate)
                        : correctionField === 'payment_date'
                          ? formatReferenceValue(currentValues.paymentDate)
                          : correctionField === 'class_id'
                            ? formatReferenceValue(currentValues.classId)
                            : correctionField === 'department_id'
                              ? formatReferenceValue(currentValues.departmentId)
                              : correctionField === 'location_id'
                                ? formatReferenceValue(currentValues.locationId)
                                : correctionField === 'approval_group'
                                  ? 'según circuito de aprobación'
                                  : correctionField === 'oc_category'
                                    ? 'según clasificación operativa'
                                    : correctionField === 'oc_policy'
                                      ? 'según política vigente'
                                      : correctionField === 'new_vendor_entity'
                                        ? 'Completa grupo, cuenta, clase, departamento, ubicación, categoría OC, política y entity'
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
          placeholder="Observaciones de revisión, correcciones o motivo del caso especial"
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
      </div>
    </form>
  );
}
