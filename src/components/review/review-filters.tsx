import { estadoLabel, etapaLabel } from '@/lib/review/labels';

type FilterProps = {
  currentBucket?: string;
  currentStatus?: string;
  currentProductionPublishStatus?: string;
  currentMonthScope?: 'active' | 'all';
  currentPeriod?: string;
  currentOperationalView?: string;
  productionPendingCount?: number;
  counts?: {
    operational: {
      automatic: number;
      posted: number;
      pending: number;
      unclassified: number;
      excluded: number;
      new_vendors: number;
      oc_managed: number;
    };
    quick: {
      rejected_sii_new: number;
      error_real_new: number;
      revision_oc_new: number;
      in_review: number;
      all: number;
    };
  };
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

const OPERATIONAL_VIEW_OPTIONS = [
  { value: '', label: 'Vista operativa: todas' },
  { value: 'automatic', label: 'Creadas automáticas' },
  { value: 'posted', label: 'Creadas manuales' },
  { value: 'pending', label: 'Por contabilizar' },
  { value: 'production_pending', label: 'Pendientes Producción' },
  { value: 'oc_managed', label: 'Control OC NetSuite' },
  { value: 'unclassified', label: 'Fuera de flujo' },
  { value: 'excluded', label: 'Excluidos' },
  { value: 'new_vendors', label: 'Facturas nuevos proveedores' },
];

const PRODUCTION_PUBLISH_OPTIONS = [
  { value: '', label: 'Producción: todos' },
  { value: 'pending', label: 'Pendientes de publicación' },
  { value: 'external_pending', label: 'Control OC NetSuite' },
  { value: 'published', label: 'Ya publicados' },
  { value: 'failed', label: 'Con fallo de publicación' },
];

function buildQuery(params: Record<string, string>) {
  return new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, value]) => value)),
  ).toString();
}

export function ReviewFilters({
  currentBucket = '',
  currentStatus = '',
  currentProductionPublishStatus = '',
  currentMonthScope = 'active',
  currentPeriod = '',
  currentOperationalView = '',
  productionPendingCount = 0,
  counts,
}: FilterProps) {
  const scopeParams: Record<string, string> = currentPeriod
    ? { period: currentPeriod }
    : currentMonthScope === 'all'
      ? { monthScope: 'all' }
      : {};
  const operationalCounts = counts?.operational;
  const quickCounts = counts?.quick;

  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <a href={`/pendiente-revision?${buildQuery({ operationalView: 'automatic', ...scopeParams })}`} className={`rounded-2xl border px-4 py-3 text-sm hover:bg-cyan-100 ${currentOperationalView === 'automatic' ? 'border-cyan-400 bg-cyan-100 text-cyan-900' : 'border-cyan-200 bg-cyan-50 text-cyan-800'}`}>
          Creadas automáticas ({operationalCounts?.automatic ?? 0})
        </a>
        <a href={`/pendiente-revision?${buildQuery({ operationalView: 'posted', ...scopeParams })}`} className={`rounded-2xl border px-4 py-3 text-sm hover:bg-emerald-100 ${currentOperationalView === 'posted' ? 'border-emerald-400 bg-emerald-100 text-emerald-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          Creadas manuales ({operationalCounts?.posted ?? 0})
        </a>
        <a href={`/pendiente-revision?${buildQuery({ operationalView: 'pending', ...scopeParams })}`} className={`rounded-2xl border px-4 py-3 text-sm hover:bg-indigo-100 ${currentOperationalView === 'pending' ? 'border-indigo-400 bg-indigo-100 text-indigo-900' : 'border-indigo-200 bg-indigo-50 text-indigo-800'}`}>
          Por contabilizar ({operationalCounts?.pending ?? 0})
        </a>
        <a href={`/pendiente-revision?${buildQuery({ productionPublishStatus: 'pending', ...scopeParams })}`} className={`rounded-2xl border px-4 py-3 text-sm hover:bg-emerald-100 ${currentProductionPublishStatus === 'pending' ? 'border-emerald-400 bg-emerald-100 text-emerald-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          Pendientes Producción ({productionPendingCount})
        </a>
        <a href={`/pendiente-revision?${buildQuery({ operationalView: 'oc_managed', ...scopeParams })}`} className={`rounded-2xl border px-4 py-3 text-sm hover:bg-sky-100 ${currentOperationalView === 'oc_managed' ? 'border-sky-400 bg-sky-100 text-sky-900' : 'border-sky-200 bg-sky-50 text-sky-800'}`}>
          Control OC NetSuite ({operationalCounts?.oc_managed ?? 0})
        </a>
        <a href={`/pendiente-revision?${buildQuery({ operationalView: 'unclassified', ...scopeParams })}`} className={`rounded-2xl border px-4 py-3 text-sm hover:bg-amber-100 ${currentOperationalView === 'unclassified' ? 'border-amber-400 bg-amber-100 text-amber-900' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          Fuera de flujo ({operationalCounts?.unclassified ?? 0})
        </a>
        <a href={`/pendiente-revision?${buildQuery({ operationalView: 'excluded', ...scopeParams })}`} className={`rounded-2xl border px-4 py-3 text-sm hover:bg-slate-100 ${currentOperationalView === 'excluded' ? 'border-slate-400 bg-slate-100 text-slate-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
          Excluidos ({operationalCounts?.excluded ?? 0})
        </a>
        <a href={`/pendiente-revision?${buildQuery({ operationalView: 'new_vendors', ...scopeParams })}`} className={`rounded-2xl border px-4 py-3 text-sm hover:bg-violet-100 ${currentOperationalView === 'new_vendors' ? 'border-violet-400 bg-violet-100 text-violet-900' : 'border-violet-200 bg-violet-50 text-violet-800'}`}>
          Facturas nuevos proveedores ({operationalCounts?.new_vendors ?? 0})
        </a>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <a href={`/pendiente-revision?${new URLSearchParams({ bucket: 'rejected_sii', status: 'new', ...scopeParams }).toString()}`} className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 hover:bg-orange-100">
          Ver revisión OC histórica ({quickCounts?.rejected_sii_new ?? 0})
        </a>
        <a href={`/pendiente-revision?${new URLSearchParams({ bucket: 'error_real', status: 'new', ...scopeParams }).toString()}`} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 hover:bg-rose-100">
          Ver errores contables nuevos ({quickCounts?.error_real_new ?? 0})
        </a>
        <a href={`/pendiente-revision?${new URLSearchParams({ bucket: 'revision_oc', status: 'new', ...scopeParams }).toString()}`} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 hover:bg-amber-100">
          Ver revisión de OC nueva ({quickCounts?.revision_oc_new ?? 0})
        </a>
        <a href={`/pendiente-revision?${new URLSearchParams({ status: 'in_review', ...scopeParams }).toString()}`} className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 hover:bg-blue-100">
          Ver documentos en revisión ({quickCounts?.in_review ?? 0})
        </a>
        <a href={`/pendiente-revision${buildQuery(scopeParams) ? `?${buildQuery(scopeParams)}` : ''}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 hover:bg-slate-100">
          Ver toda la cola ({quickCounts?.all ?? 0})
        </a>
      </div>

      <form className="grid gap-4 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-6" method="get">
      {currentPeriod ? (
        <input type="hidden" name="period" value={currentPeriod} />
      ) : (
        <input type="hidden" name="monthScope" value={currentMonthScope} />
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Vista operativa</label>
        <select
          name="operationalView"
          defaultValue={currentOperationalView}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
        >
          {OPERATIONAL_VIEW_OPTIONS.map((option) => (
            <option key={option.value || 'all-operational-views'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

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

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Publicación Producción</label>
        <select
          name="productionPublishStatus"
          defaultValue={currentProductionPublishStatus}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
        >
          {PRODUCTION_PUBLISH_OPTIONS.map((option) => (
            <option key={option.value || 'all-production-publish'} value={option.value}>
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
        <a href={`/pendiente-revision${buildQuery(scopeParams) ? `?${buildQuery(scopeParams)}` : ''}`} className="w-full rounded-xl border border-slate-300 px-4 py-2 text-center text-sm hover:bg-slate-100">
          Limpiar
        </a>
      </div>
      </form>
    </div>
  );
}
