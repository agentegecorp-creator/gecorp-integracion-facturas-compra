'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  accountOptions,
  approvalGroupOptions,
  classOptions,
  departmentOptions,
  documentTypeOptions,
  locationOptions,
  paymentTermsOptions,
} from '@/lib/review/catalogs';
import { correctionFieldLabel, decisionLabel } from '@/lib/review/labels';

type DecisionType = 'approve' | 'correct_and_approve' | 'exception' | 'reject_for_learning';
type CorrectionField =
  | 'account_id'
  | 'issue_date'
  | 'accounting_date'
  | 'due_date'
  | 'payment_date'
  | 'payment_terms_id'
  | 'document_type'
  | 'approval_group'
  | 'oc_category'
  | 'oc_policy'
  | 'class_id'
  | 'department_id'
  | 'location_id'
  | 'new_vendor_entity'
  | 'invoice_note'
  | 'invoice_detail';

type SelectOption = {
  value: string;
  label: string;
};

type ReviewDecisionFormProps = {
  caseId: string;
  currentValues: {
    accountId?: string | number | null;
    vendorName?: string | null;
    documentType?: string | null;
    issueDate?: string | Date | null;
    accountingDate?: string | Date | null;
    dueDate?: string | Date | null;
    paymentDate?: string | Date | null;
    paymentTermsId?: string | number | null;
    classId?: string | number | null;
    departmentId?: string | number | null;
    locationId?: string | number | null;
    approvalGroup?: string | null;
    ocCategory?: string | null;
    expenseCategory?: string | null;
    ocPolicy?: string | null;
    newVendorEntity?: string | number | null;
    invoiceNote?: string | null;
    invoiceDetail?: string | null;
  };
};

type CorrectionValues = Partial<Record<CorrectionField, string>>;

const editableFields: Array<{
  field: CorrectionField;
  placeholder: string;
  kind: 'select' | 'date' | 'text' | 'textarea';
  options?: SelectOption[];
}> = [
  { field: 'account_id', placeholder: 'Selecciona cuenta contable', kind: 'select', options: accountOptions },
  { field: 'issue_date', placeholder: '', kind: 'date' },
  { field: 'accounting_date', placeholder: '', kind: 'date' },
  { field: 'due_date', placeholder: '', kind: 'date' },
  { field: 'payment_date', placeholder: '', kind: 'date' },
  { field: 'payment_terms_id', placeholder: 'Selecciona término de pago', kind: 'select', options: paymentTermsOptions },
  { field: 'document_type', placeholder: 'Selecciona tipo documental', kind: 'select', options: documentTypeOptions },
  { field: 'class_id', placeholder: 'Selecciona clase', kind: 'select', options: classOptions },
  { field: 'department_id', placeholder: 'Selecciona departamento', kind: 'select', options: departmentOptions },
  { field: 'location_id', placeholder: 'Selecciona ubicación', kind: 'select', options: locationOptions },
  { field: 'approval_group', placeholder: 'Selecciona grupo de aprobación', kind: 'select', options: approvalGroupOptions },
  { field: 'oc_category', placeholder: 'Selecciona categoría gasto', kind: 'text' },
  {
    field: 'oc_policy',
    placeholder: 'Selecciona política OC',
    kind: 'select',
    options: [
      { value: 'SIN OC', label: 'SIN OC' },
      { value: 'OC OBLIGATORIA', label: 'OC OBLIGATORIA' },
    ],
  },
  { field: 'new_vendor_entity', placeholder: 'Entity NetSuite', kind: 'text' },
  { field: 'invoice_note', placeholder: 'Nota operativa para esta factura', kind: 'textarea' },
  { field: 'invoice_detail', placeholder: 'Detalle factura / glosa para contabilización', kind: 'textarea' },
];

function optionLabel(options: SelectOption[] | undefined, value: string | number | Date | null | undefined) {
  if (value === null || value === undefined || value === '' || value instanceof Date) return null;
  const normalizedValue = String(value);
  return options?.find((option) => option.value === normalizedValue)?.label ?? null;
}

function inputValue(value: string | number | Date | null | undefined) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value);
  const chileDate = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s|$)/);
  if (chileDate) {
    return `${chileDate[3]}-${chileDate[2]}-${chileDate[1]}`;
  }
  const date = new Date(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw) && !Number.isNaN(date.getTime())) {
    return raw.slice(0, 10);
  }
  return raw;
}

function isBalanceAccount(accountId: string | number | Date | null | undefined) {
  const label = optionLabel(accountOptions, accountId);
  return Boolean(label?.trim().match(/^[12]/));
}

function categoryOptions(value: string | null | undefined): SelectOption[] {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => ({ value: item, label: item }));
}

export function ReviewDecisionForm({ caseId, currentValues }: ReviewDecisionFormProps) {
  const router = useRouter();
  const [decisionType, setDecisionType] = useState<DecisionType>('approve');
  const [notes, setNotes] = useState('');
  const [correctionValues, setCorrectionValues] = useState<CorrectionValues>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const expenseCategoryOptions = useMemo(
    () => categoryOptions(currentValues.expenseCategory),
    [currentValues.expenseCategory],
  );

  const correctionPayload = useMemo(() => {
    if (decisionType !== 'correct_and_approve') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(correctionValues)
        .map(([field, value]) => [field, typeof value === 'string' ? value.trim() : value])
        .filter(([field, value]) => {
          if (!value || String(value) === inputValue(currentValueForField(field as CorrectionField))) return false;
          if (['class_id', 'department_id', 'location_id'].includes(field)) {
            const selectedAccount = correctionValues.account_id ?? currentValues.accountId;
            return !isBalanceAccount(selectedAccount);
          }
          return true;
        }),
    );
  }, [decisionType, correctionValues]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (decisionType === 'correct_and_approve') {
      if (Object.keys(correctionPayload).length === 0) {
        setError('Debes ingresar al menos una corrección.');
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
      setCorrectionValues({});
      router.refresh();
    } catch (err) {
      setError('Ocurrió un error de red al guardar la decisión.');
    } finally {
      setLoading(false);
    }
  }

  function currentValueForField(field: CorrectionField) {
    const values: Record<CorrectionField, string | number | Date | null | undefined> = {
      account_id: currentValues.accountId,
      issue_date: currentValues.issueDate,
      accounting_date: currentValues.accountingDate,
      due_date: currentValues.dueDate,
      payment_date: currentValues.paymentDate,
      payment_terms_id: currentValues.paymentTermsId,
      document_type: currentValues.documentType,
      class_id: currentValues.classId,
      department_id: currentValues.departmentId,
      location_id: currentValues.locationId,
      approval_group: currentValues.approvalGroup,
      oc_category: currentValues.ocCategory,
      oc_policy: currentValues.ocPolicy,
      new_vendor_entity: currentValues.newVendorEntity,
      invoice_note: currentValues.invoiceNote,
      invoice_detail: currentValues.invoiceDetail,
    };

    return values[field];
  }

  function updateCorrectionValue(field: CorrectionField, value: string) {
    setCorrectionValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function renderFieldInput(fieldConfig: (typeof editableFields)[number]) {
    const dynamicOptions = fieldConfig.field === 'oc_category' && expenseCategoryOptions.length > 0
      ? expenseCategoryOptions
      : fieldConfig.options;
    const dynamicKind = fieldConfig.field === 'oc_category' && expenseCategoryOptions.length > 1
      ? 'select'
      : fieldConfig.kind;
    const currentValue = inputValue(currentValueForField(fieldConfig.field));
    const value = correctionValues[fieldConfig.field]
      ?? (dynamicKind === 'select' && !dynamicOptions?.some((option) => option.value === currentValue) ? '' : currentValue);
    const className = 'w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500';

    if (dynamicKind === 'select') {
      return (
        <select
          value={value}
          onChange={(e) => updateCorrectionValue(fieldConfig.field, e.target.value)}
          className={className}
        >
          <option value="">{fieldConfig.placeholder}</option>
          {(dynamicOptions ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (fieldConfig.kind === 'textarea') {
      return (
        <textarea
          value={value}
          onChange={(e) => updateCorrectionValue(fieldConfig.field, e.target.value)}
          className={`${className} min-h-24`}
          placeholder={fieldConfig.placeholder}
        />
      );
    }

    return (
      <input
        type={fieldConfig.kind}
        value={value}
        onChange={(e) => updateCorrectionValue(fieldConfig.field, e.target.value)}
        className={className}
        placeholder={fieldConfig.placeholder}
      />
    );
  }

  const visibleEditableFields = editableFields.filter((fieldConfig) => {
    if (!['class_id', 'department_id', 'location_id'].includes(fieldConfig.field)) return true;
    const selectedAccount = correctionValues.account_id ?? currentValues.accountId;
    return !isBalanceAccount(selectedAccount);
  });

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
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Correcciones a aplicar</h3>
              <p className="mt-1 text-xs text-slate-600">
                Completa solo los campos que quieras cambiar. Se guardarán juntos en una sola decisión.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCorrectionValues({})}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-white"
            >
              Limpiar
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            {visibleEditableFields.map((fieldConfig) => (
              <div key={fieldConfig.field} className="grid gap-2 rounded-xl bg-white p-3 ring-1 ring-slate-200 md:grid-cols-[1fr_1.4fr]">
                <div>
                  <p className="text-sm font-medium text-slate-800">{correctionFieldLabel(fieldConfig.field)}</p>
                </div>
                <div>{renderFieldInput(fieldConfig)}</div>
              </div>
            ))}
            {visibleEditableFields.length < editableFields.length ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
                Cuenta de balance: clase/mercado, departamento y ubicación no aplican para esta factura.
              </p>
            ) : null}
          </div>
        </div>
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
