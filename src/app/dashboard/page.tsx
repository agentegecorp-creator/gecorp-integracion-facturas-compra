import Link from 'next/link';
import { requireSession } from '@/lib/auth/guards';
import { getDashboardSummary, listReviewCases } from '@/lib/db/queries';
import { estadoLabel, etapaLabel } from '@/lib/review/labels';

function StatCard({ label, value, help }: { label: string; value: string | number; help: string }) {
  return (
    <div className="rounded-2xl bg-indigo-50 p-4 shadow-sm ring-1 ring-indigo-100">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{help}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const summary = await getDashboardSummary();
  const recentCases = await listReviewCases(8);
  const pendingCount = summary.byStatus.find((row) => row.status === 'new')?.total ?? 0;
  const resolvedCount = summary.byStatus.find((row) => row.status === 'resolved')?.total ?? 0;
  const exceptionCount = summary.byStatus.find((row) => row.status === 'exception')?.total ?? 0;
  const rejectedSiiCount = summary.byBucket.find((row) => row.bucket === 'rejected_sii')?.total ?? 0;
  const revisionOcCount = summary.byBucket.find((row) => row.bucket === 'revision_oc')?.total ?? 0;
  const errorRealCount = summary.byBucket.find((row) => row.bucket === 'error_real')?.total ?? 0;

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-8">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
              Centro operativo SII → NetSuite
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-slate-900">Mesa de Revisión Contable</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Bienvenido, {session.name}. Esta portada debe mostrar dónde está la carga operativa real y desde dónde entrar a resolverla.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
              <span>Origen: Postgres + mission-control</span>
              <span>•</span>
              <span>Dominio: facturascompra.gecorp.cl</span>
              <span>•</span>
              <span>Casos visibles hoy: {summary.totalCases}</span>
            </div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
              Cerrar sesión
            </button>
          </form>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <StatCard label="Documentos en cola" value={summary.totalCases} help="Total visible en la mesa operativa" />
          <StatCard label="Nuevos por revisar" value={pendingCount} help="Documentos esperando decisión" />
          <StatCard label="Rechazos SII" value={rejectedSiiCount} help="Documentos observados por referencia OC en SII" />
          <StatCard label="Errores contables" value={errorRealCount} help="Documentos con problema contable detectado" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Documentos nuevos de la operación</h2>
              <p className="mt-1 text-sm text-slate-600">Lo último que entró a la mesa y requiere mirada operativa.</p>
            </div>
            <Link href="/pendiente-revision" className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
              Abrir cola
            </Link>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Proveedor</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Folio</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Etapa del caso</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Estado</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Resumen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recentCases.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{item.vendor_name || '-'}</td>
                    <td className="px-4 py-3">{item.folio || '-'}</td>
                    <td className="px-4 py-3">{etapaLabel(item.bucket)}</td>
                    <td className="px-4 py-3">{estadoLabel(item.status)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{item.summary_text || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">Resumen de la corrida</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>• Etapas activas: {summary.byBucket.map((row) => `${etapaLabel(row.bucket)}: ${row.total}`).join(' · ') || 'Sin datos'}.</p>
              <p>• Estados activos: {summary.byStatus.map((row) => `${estadoLabel(row.status)}: ${row.total}`).join(' · ') || 'Sin datos'}.</p>
              <p>• Documentos con revisión de OC: {revisionOcCount}.</p>
              <p>• Documentos resueltos acumulados: {resolvedCount}. Casos especiales: {exceptionCount}.</p>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">Prioridades del día</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>• Atender primero rechazos SII y errores contables.</p>
              <p>• Luego resolver documentos en revisión de OC con mejor contexto por proveedor y cuenta sugerida.</p>
              <p>• Usar la cola como mesa diaria real de trabajo, no solo como tablero de seguimiento.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
            <Link href="/auditoria" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50">
              <h3 className="font-semibold text-slate-900">Auditoría</h3>
              <p className="mt-1 text-sm text-slate-600">Ver eventos reales del flujo y decisiones tomadas.</p>
            </Link>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="font-semibold text-slate-900">Flujo diario activo</h3>
              <p className="mt-1 text-sm text-slate-600">La corrida automática de 6 AM ya alimenta esta mesa con el mes actual y deja la operación lista para revisión.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
