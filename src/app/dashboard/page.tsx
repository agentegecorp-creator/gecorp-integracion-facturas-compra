import Link from 'next/link';
import { requireSession } from '@/lib/auth/guards';
import { getDashboardSummary, listReviewCases } from '@/lib/db/queries';

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
  const recentCases = await listReviewCases(5);
  const pendingCount = summary.byStatus.find((row) => row.status === 'new')?.total ?? 0;
  const resolvedCount = summary.byStatus.find((row) => row.status === 'resolved')?.total ?? 0;
  const exceptionCount = summary.byStatus.find((row) => row.status === 'exception')?.total ?? 0;

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-8">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              Pipeline estabilizado
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-slate-900">Mesa de Revisión Contable</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Dashboard operativo del flujo SII → NetSuite. Bienvenido, {session.name}. Aquí concentramos revisión, decisiones y trazabilidad.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
              <span>Origen: Postgres + app web desplegada</span>
              <span>•</span>
              <span>Dominio: facturascompra.gecorp.cl</span>
              <span>•</span>
              <span>Total procesables hoy: {summary.totalCases}</span>
            </div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
              Cerrar sesión
            </button>
          </form>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <StatCard label="Casos en cola" value={summary.totalCases} help="Total visible en la mesa de revisión" />
          <StatCard label="Pendientes" value={pendingCount} help="Documentos nuevos listos para revisar" />
          <StatCard label="Resueltos" value={resolvedCount} help="Casos ya aprobados o corregidos" />
          <StatCard label="Excepciones" value={exceptionCount} help="Casos apartados del flujo normal" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Pendiente revisión</h2>
              <p className="mt-1 text-sm text-slate-600">Vista principal para entrar a la cola operativa.</p>
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
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Bucket</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recentCases.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{item.vendor_name || '-'}</td>
                    <td className="px-4 py-3">{item.folio || '-'}</td>
                    <td className="px-4 py-3">{item.bucket}</td>
                    <td className="px-4 py-3">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">Lectura del estado actual</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>• Buckets activos: {summary.byBucket.map((row) => `${row.bucket}: ${row.total}`).join(' · ') || 'Sin datos'}.</p>
              <p>• Estados activos: {summary.byStatus.map((row) => `${row.status}: ${row.total}`).join(' · ') || 'Sin datos'}.</p>
              <p>• El flujo ya permite revisar, decidir, auditar y corregir con apoyo guiado.</p>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">Qué requiere atención</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>• Seguir acercando la UX al dashboard MVP original.</p>
              <p>• Reemplazar opciones estáticas por catálogos reales para correcciones guiadas.</p>
              <p>• Mantener la cola limpia y con trazabilidad útil para Mónica y Gonzalo.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
            <Link href="/auditoria" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50">
              <h3 className="font-semibold text-slate-900">Auditoría</h3>
              <p className="mt-1 text-sm text-slate-600">Ver eventos reales del flujo y decisiones tomadas.</p>
            </Link>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="font-semibold text-slate-900">Siguiente bloque</h3>
              <p className="mt-1 text-sm text-slate-600">Seguir portando la estructura visual y catálogos vivos del MVP anterior.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
