import Link from 'next/link';
import { requireSession } from '@/lib/auth/guards';
import { getDashboardSummary, listReviewCases } from '@/lib/db/queries';
import { estadoLabel, etapaLabel } from '@/lib/review/labels';

function StatCard({ label, value, help, href }: { label: string; value: string | number; help: string; href?: string }) {
  const className = "block rounded-2xl bg-indigo-50 p-4 shadow-sm ring-1 ring-indigo-100 transition hover:bg-indigo-100";
  const content = (
    <>
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{help}</p>
    </>
  );

  if (!href) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link href={href} className={className}>{content}</Link>
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

function getDashboardPeriods(selectedPeriod: string | undefined) {
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

function periodQuery(periodKey: string) {
  return new URLSearchParams({ period: periodKey }).toString();
}

function PeriodSelector({ periods }: { periods: ReturnType<typeof getDashboardPeriods> }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <span className="px-2 text-sm font-medium text-slate-700">Prefiltro</span>
      <div className="inline-flex rounded-xl bg-white p-1 text-sm font-medium text-slate-600 ring-1 ring-slate-200">
        {periods.periods.map((period) => (
          <Link
            key={period.key}
            href={`/dashboard?${periodQuery(period.key)}`}
            className={`rounded-lg px-4 py-2 ${
              period.key === periods.selected.key
                ? 'bg-slate-900 text-white shadow-sm'
                : 'hover:bg-slate-100'
            }`}
          >
            <span className="block">{period.label}</span>
            <span className="block text-[11px] font-normal opacity-80">{period.detail}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function documentTypeLabel(code: string) {
  if (code === '33') return 'Factura Electrónica (33)';
  if (code === '34') return 'Factura no Afecta o Exenta Electrónica (34)';
  if (code === '56') return 'Nota de débito (56)';
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

function RcvDocumentTypeTotals({
  documentTypeSummary,
  selectedPeriodDetail,
  rcvSource,
  rcvTotalAmount,
  rcvTotalDocuments,
}: {
  documentTypeSummary: Awaited<ReturnType<typeof getDashboardSummary>>['documentTypeSummary'];
  selectedPeriodDetail: string;
  rcvSource: Awaited<ReturnType<typeof getDashboardSummary>>['documentTypeSummarySource'];
  rcvTotalAmount: number;
  rcvTotalDocuments: number;
}) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Totales RCV por tipo de documento</h2>
          <p className="mt-1 text-sm text-slate-600">
            Período SII: {selectedPeriodDetail}. Base: registro RCV oficial descargado desde SII.
          </p>
          {rcvSource.type === 'sii_csv' ? (
            <p className="mt-1 text-xs text-slate-400">Fuente: {rcvSource.sourceFile}</p>
          ) : (
            <p className="mt-1 text-xs text-amber-700">Sin CSV SII para este período; usando casos importados a la mesa.</p>
          )}
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
            <p className="text-xs font-medium text-slate-500">Documentos RCV</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{rcvTotalDocuments}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
            <p className="text-xs font-medium text-slate-500">Monto total RCV</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrency(rcvTotalAmount)}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-[1120px] divide-y divide-slate-200 text-sm">
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
                <td className="px-4 py-3 text-sm font-medium text-slate-800">{documentTypeLabel(row.documentType)}</td>
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
    </section>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string; rcvPeriod?: string }>;
}) {
  const session = await requireSession();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const dashboardPeriods = getDashboardPeriods(resolvedSearchParams?.period ?? resolvedSearchParams?.rcvPeriod);
  const summary = await getDashboardSummary({
    startDate: dashboardPeriods.selected.startDate,
    endDate: dashboardPeriods.selected.endDate,
  });
  const recentCases = await listReviewCases(8, {
    period: {
      startDate: dashboardPeriods.selected.startDate,
      endDate: dashboardPeriods.selected.endDate,
    },
  });
  const pendingCount = summary.byStatus.find((row) => row.status === 'new')?.total ?? 0;
  const resolvedCount = summary.byStatus.find((row) => row.status === 'resolved')?.total ?? 0;
  const exceptionCount = summary.byStatus.find((row) => row.status === 'exception')?.total ?? 0;
  const ocHistoricalCount = summary.byBucket.find((row) => row.bucket === 'rejected_sii')?.total ?? 0;
  const revisionOcCount = summary.byBucket.find((row) => row.bucket === 'revision_oc')?.total ?? 0;
  const errorRealCount = summary.byBucket.find((row) => row.bucket === 'error_real')?.total ?? 0;
  const operationalSummary = summary.operationalSummary;
  const pipelineSummary = summary.pipelineSummary;
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
              Bienvenido, {session.name}. Esta portada muestra la carga operativa real para {dashboardPeriods.selected.detail} y desde dónde entrar a resolverla.
            </p>
            {pipelineSummary ? (
              <p className="mt-2 text-xs font-medium text-emerald-700">
                Última corrida SII: {pipelineSummary.createdAutomatically} creadas automáticas en {pipelineSummary.mode}; los casos manuales siguen en la Mesa.
              </p>
            ) : (
              <p className="mt-2 text-xs font-medium text-emerald-700">Última corrida SII importada visible en la cola de revisión.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
              <span>Origen: Postgres + mission-control</span>
              <span>•</span>
              <span>Dominio: facturascompra.gecorp.cl</span>
              <span>•</span>
              <span>Total maestro RCV: {rcvTotalDocuments}</span>
            </div>
            <PeriodSelector periods={dashboardPeriods} />
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
              Cerrar sesión
            </button>
          </form>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Documentos RCV"
            value={rcvTotalDocuments}
            help="Total maestro desde el CSV oficial SII"
          />
          <StatCard
            label="Clasificados pipeline"
            value={operationalSummary.clasificadosPipeline}
            help="Creadas + revisión + rechazos + proveedores nuevos"
          />
          <StatCard
            label="Diferencia cuadratura"
            value={operationalSummary.diferenciaRcv}
            help="Debe quedar en 0 contra el RCV oficial"
          />
          <StatCard
            label="Creadas automáticas"
            value={operationalSummary.creadasAutomaticas}
            help="Documentos auto-creables por el pipeline SII → NetSuite"
            href={`/pendiente-revision?${new URLSearchParams({ operationalView: 'automatic', period: dashboardPeriods.selected.key }).toString()}`}
          />
          <StatCard
            label="Revisión manual"
            value={operationalSummary.porContabilizar}
            help="Pendientes, OC referencial y proveedor nuevo"
            href={`/pendiente-revision?${new URLSearchParams({ operationalView: 'pending', period: dashboardPeriods.selected.key }).toString()}`}
          />
          <StatCard
            label="Fuera de flujo"
            value={operationalSummary.fueraDeFlujo}
            help="Documentos del RCV sin clasificación operativa en la corrida"
            href={`/pendiente-revision?${new URLSearchParams({ operationalView: 'unclassified', period: dashboardPeriods.selected.key }).toString()}`}
          />
        </div>
      </section>

      <RcvDocumentTypeTotals
        documentTypeSummary={documentTypeSummary}
        selectedPeriodDetail={dashboardPeriods.selected.detail}
        rcvSource={rcvSource}
        rcvTotalAmount={rcvTotalAmount}
        rcvTotalDocuments={rcvTotalDocuments}
      />

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Documentos nuevos de la operación</h2>
              <p className="mt-1 text-sm text-slate-600">Lo último que entró a la mesa y requiere mirada operativa.</p>
            </div>
            <Link href={`/pendiente-revision?${periodQuery(dashboardPeriods.selected.key)}`} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
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
              <p>• Cuadratura: {rcvTotalDocuments} RCV = {operationalSummary.clasificadosPipeline} clasificados por pipeline + {operationalSummary.fueraDeFlujo} fuera de flujo + {operationalSummary.diferenciaRcv} diferencia.</p>
              <p>• Total documentos RCV del período: {rcvTotalDocuments} documentos por {formatCurrency(rcvTotalAmount)}.</p>
              <p>• Revisión manual: {operationalSummary.porContabilizar} documentos, incluyendo {revisionOcCount + ocHistoricalCount} con revisión de OC y {operationalSummary.nuevosProveedores} proveedores nuevos.</p>
              <p>• Errores contables: {errorRealCount}. Fuera de flujo/excluidos: {operationalSummary.excluidos}.</p>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">Flujo diario activo</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>• Corrida principal 6:00 AM hábil.</p>
              <p>• Corrida adicional 11:45 PM hábil.</p>
              <p>• La cola sigue priorizando errores contables, revisión de OC y pendientes de Producción.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
            <Link href="/auditoria" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50">
              <h3 className="font-semibold text-slate-900">Auditoría</h3>
              <p className="mt-1 text-sm text-slate-600">Ver eventos reales del flujo y decisiones tomadas.</p>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
