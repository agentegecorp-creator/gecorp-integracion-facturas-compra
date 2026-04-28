import Link from 'next/link';
import { requireSession } from '@/lib/auth/guards';
import { getDashboardSummary, listReviewCases } from '@/lib/db/queries';

export default async function DashboardPage() {
  const session = await requireSession();
  const summary = await getDashboardSummary();
  const recentCases = await listReviewCases(5);

  return (
    <main className="p-8 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard operativo</h1>
          <p className="mt-2 text-slate-600">Bienvenido, {session.name}. Este es el hub inicial del flujo SII → NetSuite.</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
            Cerrar sesión
          </button>
        </form>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Casos en cola</p>
          <p className="mt-2 text-3xl font-semibold">{summary.totalCases}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Buckets activos</p>
          <p className="mt-2 text-3xl font-semibold">{summary.byBucket.length}</p>
          <p className="mt-2 text-sm text-slate-600">{summary.byBucket.map((row) => `${row.bucket}: ${row.total}`).join(' · ') || 'Sin datos'}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Estados activos</p>
          <p className="mt-2 text-3xl font-semibold">{summary.byStatus.length}</p>
          <p className="mt-2 text-sm text-slate-600">{summary.byStatus.map((row) => `${row.status}: ${row.total}`).join(' · ') || 'Sin datos'}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/pendiente-revision" className="rounded-2xl bg-white p-6 shadow-sm transition hover:bg-slate-50">
          <h2 className="text-lg font-semibold">Pendiente revisión</h2>
          <p className="mt-2 text-sm text-slate-600">Entrar a la cola operativa y revisar documentos uno por uno.</p>
        </Link>
        <Link href="/auditoria" className="rounded-2xl bg-white p-6 shadow-sm transition hover:bg-slate-50">
          <h2 className="text-lg font-semibold">Auditoría</h2>
          <p className="mt-2 text-sm text-slate-600">Ver trazabilidad y eventos del flujo, base para decisiones y control.</p>
        </Link>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Próximo bloque</h2>
          <p className="mt-2 text-sm text-slate-600">Conectar review decisions para aprobar, corregir o marcar excepciones.</p>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Últimos casos cargados</h2>
            <p className="mt-1 text-sm text-slate-600">Muestra rápida para entrar al detalle.</p>
          </div>
          <Link href="/pendiente-revision" className="text-sm font-medium underline underline-offset-2">
            Ver toda la cola
          </Link>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Proveedor</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Folio</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Bucket</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {recentCases.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.vendor_name || '-'}</td>
                  <td className="px-4 py-3">{item.folio || '-'}</td>
                  <td className="px-4 py-3">{item.bucket}</td>
                  <td className="px-4 py-3">
                    <Link href={`/caso/${item.id}`} className="font-medium underline underline-offset-2">
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
