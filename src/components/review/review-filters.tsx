import { estadoLabel, etapaLabel } from '@/lib/review/labels';

type FilterProps = {
  currentBucket?: string;
  currentStatus?: string;
};

const BUCKET_OPTIONS = [
  { value: '', label: 'Todas las etapas' },
  { value: 'pending_review', label: etapaLabel('pending_review') },
  { value: 'revision_oc', label: etapaLabel('revision_oc') },
  { value: 'error_real', label: etapaLabel('error_real') },
  { value: 'rejected_sii', label: etapaLabel('rejected_sii') },
  { value: 'approved_auto', label: etapaLabel('approved_auto') },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'new', label: estadoLabel('new') },
  { value: 'in_review', label: estadoLabel('in_review') },
  { value: 'resolved', label: estadoLabel('resolved') },
  { value: 'exception', label: estadoLabel('exception') },
  { value: 'rejected_for_learning', label: estadoLabel('rejected_for_learning') },
];

export function ReviewFilters({ currentBucket = '', currentStatus = '' }: FilterProps) {
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <a href="/pendiente-revision?bucket=rejected_sii&status=new" className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 hover:bg-orange-100">
          Ver rechazos SII nuevos
        </a>
        <a href="/pendiente-revision?bucket=error_real&status=new" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 hover:bg-rose-100">
          Ver errores contables nuevos
        </a>
        <a href="/pendiente-revision?bucket=revision_oc&status=new" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 hover:bg-amber-100">
          Ver revisión de OC nueva
        </a>
        <a href="/pendiente-revision?status=in_review" className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 hover:bg-blue-100">
          Ver documentos en revisión
        </a>
        <a href="/pendiente-revision" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 hover:bg-slate-100">
          Ver toda la cola
        </a>
      </div>

      <form className="grid gap-4 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-4" method="get">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Etapa del caso</label>
        <select
          name="bucket"
          defaultValue={currentBucket}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
        >
          {BUCKET_OPTIONS.map((option) => (
            <option key={option.value || 'all-buckets'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Estado</label>
        <select
          name="status"
          defaultValue={currentStatus}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value || 'all-status'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end">
        <button type="submit" className="w-full rounded-xl bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-800">
          Aplicar filtros
        </button>
      </div>

      <div className="flex items-end">
        <a href="/pendiente-revision" className="w-full rounded-xl border border-slate-300 px-4 py-2 text-center text-sm hover:bg-slate-100">
          Limpiar
        </a>
      </div>
      </form>
    </div>
  );
}
