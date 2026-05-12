import Link from 'next/link';
import { requireSession } from '@/lib/auth/guards';
import { getDashboardSummary, listReviewCases } from '@/lib/db/queries';
import { estadoLabel, etapaLabel } from '@/lib/review/labels';

function StatCard({ label, value, help, href }: { label: string; value: string | number; help: string; href: string }) {
  return (
    <Link href={href} className="block rounded-2xl bg-indigo-50 p-4 shadow-sm ring-1 ring-indigo-100 transition hover:bg-indigo-100">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{help}</p>
    </Link>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatPeriodLabel(date: Date) {
  return new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(date);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRcvPeriods(selectedPeriod: string | undefined) {
  const now = new Date();
  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const periods = [
    {
      key: 'current',
      label: 'Mes actual',
      detail: formatPeriodLabel(currentStart),
      startDate: toDateInputValue(currentStart),
      endDate: toDateInputValue(nextStart),
    },
    {
      key: 'previous',
      label: 'Mes anterior',
      detail: formatPeriodLabel(previousStart),
      startDate: toDateInputValue(previousStart),
      endDate: toDateInputValue(currentStart),
    },
  ];

  return {
    selected: periods.find((period) => period.key === selectedPeriod) ?? periods[0],
    periods,
  };
}

function documentTypeLabel(code: string) {
  if (code === '33') return 'Factura Electrónica (33)';
  if (code === '34') return 'Factura no Afecta o Exenta Electrónica (34)';
  if (code === '61') return 'Nota de Crédito Electrónica (61)';
  if (code === '914') return 'Declaración de Ingreso (DIN) (914)';
  return code;
}

function SiiAmountCell({ value }: { value: number }) {
  return <td className="px-4 py-3 text-right text-sm text-slate-700">{formatCurrency(value)}</td>;
}

function SiiCountCell({ value }: { value: number }) {
  return <td className="px-4 py-3 text-right text-sm text-slate-700">{value}</td>;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ rcvPeriod?: string }>;
}) {
  const session = await requireSession();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rcvPeriods = getRcvPeriods(resolvedSearchParams?.rcvPeriod);
  const summary = await getDashboardSummary({
    startDate: rcvPeriods.selected.startDate,
    endDate: rcvPeriods.selected.endDate,
  });
  const recentCases = await listReviewCases(8);
  const pendingCount = summary.byStatus.find((row) => row.status === 'new')?.total ?? 0;
  const resolvedCount = summary.byStatus.find((row) => row.status === 'resolved')?.total ?? 0;
  const exceptionCount = summary.byStatus.find((row) => row.status === 'exception')?.total ?? 0;
  const rejectedSiiCount = summary.byBucket.find((row) => row.bucket === 'rejected_sii')?.total ?? 0;
  const revisionOcCount = summary.byBucket.find((row) => row.bucket === 'revision_oc')?.total ?? 0;
  const errorRealCount = summary.byBucket.find((row) => row.bucket === 'error_real')?.total ?? 0;
  const operationalSummary = summary.operationalSummary;
  const documentTypeSummary = summary.documentTypeSummary;
  const rcvSource = summary.documentTypeSummarySource;
  const rcvTotalDocuments = documentTypeSummary.reduce((total, row) => total + row.totalDocuments, 0);
  const rcvTotalAmount = documentTypeSummary.reduce((total, row) => total + row.montoTotal, 0);

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
              Bienvenido, {session.name}. Esta portada muestra la carga operativa real y desde dónde entrar a resolverla.
            </p>
            <p className="mt-2 text-xs font-medium text-emerald-700">Última corrida SII importada: 7 casos nuevos de mayo visibles arriba en la cola.</p>
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
          <StatCard
            label="Contabilizados"
            value={operationalSummary.contabilizados}
            help="Documentos ya resueltos y contabilizados en la operación"
            href="/pendiente-revision?operationalView=posted&monthScope=all"
          />
          <StatCard
            label="Por contabilizar"
            value={operationalSummary.porContabilizar}
            help="Documentos todavía pendientes de cierre operativo"
            href="/pendiente-revision?operationalView=pending&monthScope=all"
          />
          <StatCard
            label="Excluidos"
            value={operationalSummary.excluidos}
            help="Documentos fuera del flujo normal, incluyendo DIN y sin valor"
            href="/pendiente-revision?operationalView=excluded&monthScope=all"
          />
          <StatCard
            label="Facturas nuevos proveedores"
            value={operationalSummary.nuevosProveedores}
            help="Casos que requieren tratamiento por proveedor nuevo"
            href="/pendiente-revision?operationalView=new_vendors&monthScope=all"
          />
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
            <h2 className="text-xl font-semibold text-slate-900">Resumen operativo del mes</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>• Etapas activas: {summary.byBucket.map((row) => `${etapaLabel(row.bucket)}: ${row.total}`).join(' · ') || 'Sin datos'}.</p>
              <p>• Estados activos: {summary.byStatus.map((row) => `${estadoLabel(row.status)}: ${row.total}`).join(' · ') || 'Sin datos'}.</p>
              <p>• Total documentos RCV del período: {rcvTotalDocuments} documentos por {formatCurrency(rcvTotalAmount)}.</p>
              <p>• Documentos con revisión de OC: {revisionOcCount}.</p>
              <p>• Rechazos SII: {rejectedSiiCount}. Errores contables: {errorRealCount}. Casos especiales: {exceptionCount}.</p>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">Flujo diario activo</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>• Corrida principal 6:00 AM hábil.</p>
              <p>• Corrida adicional 11:45 PM hábil.</p>
              <p>• La cola sigue priorizando rechazos SII, errores contables y revisión de OC.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
            <Link href="/auditoria" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50">
              <h3 className="font-semibold text-slate-900">Auditoría</h3>
              <p className="mt-1 text-sm text-slate-600">Ver eventos reales del flujo y decisiones tomadas.</p>
            </Link>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">Totales RCV por tipo de documento</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Período SII: {rcvPeriods.selected.detail}. Base: registro RCV oficial descargado desde SII.
                  </p>
                  {rcvSource.type === 'sii_csv' ? (
                    <p className="mt-1 text-[11px] text-slate-400">Fuente: {rcvSource.sourceFile}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-amber-700">Sin CSV SII para este período; usando casos importados a la mesa.</p>
                  )}
                </div>
                <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-medium text-slate-600">
                  {rcvPeriods.periods.map((period) => (
                    <Link
                      key={period.key}
                      href={`/dashboard?rcvPeriod=${period.key}`}
                      className={`rounded-lg px-3 py-2 ${
                        period.key === rcvPeriods.selected.key
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'hover:bg-slate-200'
                      }`}
                    >
                      <span className="block">{period.label}</span>
                      <span className="block text-[11px] font-normal">{period.detail}</span>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Tipo documento</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600">Total docs</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600">Monto exento</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600">Monto neto</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600">IVA recuperable</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600">IVA uso común</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600">IVA no recuperable</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600">Otros impuestos</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600">Monto total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {documentTypeSummary.map((row) => (
                      <tr key={row.documentType} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-800">{documentTypeLabel(row.documentType)}</td>
                        <SiiCountCell value={row.totalDocuments} />
                        <SiiAmountCell value={row.montoExento} />
                        <SiiAmountCell value={row.montoNeto} />
                        <SiiAmountCell value={row.ivaRecuperable} />
                        <SiiAmountCell value={row.ivaUsoComun} />
                        <SiiAmountCell value={row.ivaNoRecuperable} />
                        <SiiAmountCell value={row.montoOtrosImpuestos} />
                        <SiiAmountCell value={row.montoTotal} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
