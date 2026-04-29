type FilterProps = {
  currentBucket?: string;
  currentStatus?: string;
};

const BUCKET_OPTIONS = [
  { value: '', label: 'Todos los buckets' },
  { value: 'pending_review', label: 'pending_review' },
  { value: 'revision_oc', label: 'revision_oc' },
  { value: 'error_real', label: 'error_real' },
  { value: 'rejected_sii', label: 'rejected_sii' },
  { value: 'approved_auto', label: 'approved_auto' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'new', label: 'new' },
  { value: 'in_review', label: 'in_review' },
  { value: 'resolved', label: 'resolved' },
  { value: 'exception', label: 'exception' },
  { value: 'rejected_for_learning', label: 'rejected_for_learning' },
];

export function ReviewFilters({ currentBucket = '', currentStatus = '' }: FilterProps) {
  return (
    <form className="mt-6 grid gap-4 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-4" method="get">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Bucket</label>
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
  );
}
