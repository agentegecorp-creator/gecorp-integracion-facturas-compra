import generatedCatalogs from './generated-catalogs.json';

type CatalogOption = {
  value: string;
  label: string;
  name?: string;
  daysUntilDue?: number;
  ids?: number[];
  vendorCount?: number;
};

const rawAccountOptions = [
  { value: '742', label: '742 · 121004 - ANTICIPO PROVEEDORES' },
  { value: '1275', label: '1275 · 122006 - CREDITO SENCE' },
  { value: '645', label: '645 · 131001 - VEHICULOS' },
  { value: '646', label: '646 · 131002 - EQUIPOS DE COMPUTACION' },
  { value: '647', label: '647 · 131003 - RACK' },
  { value: '648', label: '648 · 131004 - BODEGA' },
  { value: '649', label: '649 · 131005 - TERRENO' },
  { value: '650', label: '650 · 131006 - CAMARA DE FRIO' },
  { value: '651', label: '651 · 131007 - MAQUINARIAS' },
  { value: '652', label: '652 · 131008 - AMPLIACION DE BODEGA' },
  { value: '653', label: '653 · 131009 - BARRILES EN ARRIENDO' },
  { value: '654', label: '654 · 131010 - ACTIVO FIJO EN LEASING' },
  { value: '753', label: '753 · 212001 - CUENTAS POR PAGAR' },
  { value: '754', label: '754 · 212002 - PROVEEDORES' },
  { value: '755', label: '755 · 212003 - PROVEEDOR EXTRANJERO' },
  { value: '756', label: '756 · 212004 - RETENCION SEGUNDA CATEGORIA' },
  { value: '757', label: '757 · 212005 - I.V.A. DEBITO FISCAL' },
  { value: '1155', label: '1155 · 212006 - ANTICIPO CLIENTES CLP' },
  { value: '759', label: '759 · 212007 - PROVISIONES VARIAS' },
  { value: '1048', label: '1048 · 212008 - FACTURAS POR RECIBIR' },
  { value: '761', label: '761 · 212009 - RETENCION 3% PREST. SOLIDARIO (EMPLEADO)' },
  { value: '762', label: '762 · 212010 - RETENCION 3% PREST. SOLIDARIO (BOLETAS HONORARIOS)' },
  { value: '763', label: '763 · 212011 - P.P.M POR PAGAR' },
  { value: '112', label: '112 · 212013 - COMPRAS ACUMULADAS' },
  { value: '1054', label: '1054 · 213003 - REMUNERACIONES POR PAGAR' },
  { value: '1265', label: '1265 · 214001 - HONORARIOS POR PAGAR BH' },
  { value: '1270', label: '1270 · 320310 - DEPRECIACION ACTIVOS' },
  { value: '1268', label: '1268 · 320320 - DEPRECIACION LEASING' },
  { value: '683', label: '683 · 450101 - COSTO DE VENTAS' },
  { value: '1271', label: '1271 · 450102 - MOVILIZACION VENTAS' },
  { value: '685', label: '685 · 450103 - REMUNERACIONES VARIABLES' },
  { value: '686', label: '686 · 450104 - DESPACHO VENTAS' },
  { value: '687', label: '687 · 450105 - GASTOS DE MERCADERIAS' },
  { value: '688', label: '688 · 450106 - COMISION TRANSBANK' },
  { value: '689', label: '689 · 450107 - MARKETING' },
  { value: '1259', label: '1259 · 450108 - CASTIGO CUENTAS INCOBRABLES' },
  { value: '690', label: '690 · 450201 - REMUNERACIONES FIJAS OPERACIONES' },
  { value: '691', label: '691 · 450202 - DESPACHOS INTERNOS' },
  { value: '692', label: '692 · 450203 - MERMAS' },
  { value: '693', label: '693 · 450204 - GASTOS OPERACIONALES NO IMPUTADOS' },
  { value: '694', label: '694 · 450205 - ALMACENAJE' },
  { value: '695', label: '695 · 450206 - GASTOS DE EMBALAJES' },
  { value: '1256', label: '1256 · 450207 - CONVERSIONES' },
  { value: '1257', label: '1257 · 450208 - ARRIENDO' },
  { value: '696', label: '696 · 460101 - REMUNERACIONES FIJAS ADMIN' },
  { value: '697', label: '697 · 460102 - INDEMNIZACIONES' },
  { value: '698', label: '698 · 460103 - ASESORIA LEGAL' },
  { value: '699', label: '699 · 460104 - ASESORIA CONTABLE' },
  { value: '700', label: '700 · 460105 - ASESORIA COMERCIAL' },
  { value: '701', label: '701 · 460106 - GASTOS ADMINISTRATIVOS' },
  { value: '702', label: '702 · 460107 - GASTOS COMUNES' },
  { value: '703', label: '703 · 460108 - GASTOS NOTARIALES' },
  { value: '704', label: '704 · 460109 - GASTOS GENERALES' },
  { value: '705', label: '705 · 460110 - GASTOS GENERALES II' },
  { value: '706', label: '706 · 460111 - GASTOS DE ASEO' },
  { value: '707', label: '707 · 460112 - PATENTE Y CONTRIBUCIONES' },
  { value: '708', label: '708 · 460113 - MOVILIZACION' },
  { value: '709', label: '709 · 460114 - HONORARIOS VARIOS' },
  { value: '710', label: '710 · 460115 - ARTICULOS DE ESCRITORIO' },
  { value: '711', label: '711 · 460116 - COURIER' },
  { value: '712', label: '712 · 460117 - PRIMA DE SEGURO' },
  { value: '713', label: '713 · 460118 - SEGURO SALUD' },
  { value: '714', label: '714 · 460119 - LUZ AGUA Y GAS' },
  { value: '715', label: '715 · 460120 - TELEFONIA Y OTRAS COMUNIC.' },
  { value: '716', label: '716 · 460121 - CAPACITACION AL PERSONAL' },
  { value: '1277', label: '1277 · 460122 - GASTOS TRANSITORIOS' },
  { value: '718', label: '718 · 460123 - APORTE PATRONAL' },
  { value: '719', label: '719 · 470101 - GASTOS FINANCIEROS' },
  { value: '720', label: '720 · 470102 - MAYOR VALOR FFMM' },
  { value: '721', label: '721 · 470103 - AJUSTES MENORES CAJA' },
  { value: '722', label: '722 · 470104 - INTERESES GANADOS' },
  { value: '723', label: '723 · 470105 - DIFERENCIA TIPO DE CAMBIO 2' },
  { value: '724', label: '724 · 470106 - LEASING' },
  { value: '725', label: '725 · 470107 - INTERESES PAGADOS EN CREDITOS' },
  { value: '726', label: '726 · 470108 - IMPUESTO PRIMERA CATEGORIA' },
  { value: '727', label: '727 · 470109 - IMPUESTO SUSTITUTIVO F50' },
  { value: '728', label: '728 · 470110 - IVA NO RECUPERABLE' },
  { value: '729', label: '729 · 470111 - INTERESES EN LEASING' },
  { value: '730', label: '730 · 470112 - MULTAS FISCALES' },
  { value: '1050', label: '1050 · 470113 - COSTO DE FFMM' },
];

export const accountOptions = rawAccountOptions.map((option) => ({
  ...option,
  label: option.label.replace(/^\d+\s*·\s*/, ''),
}));

export const documentTypeOptions = [
  { value: '33', label: '33 · Factura afecta' },
  { value: '34', label: '34 · Factura exenta' },
  { value: '61', label: '61 · Nota de crédito' },
];

const fallbackClassOptions = [
  { value: '1', label: '1 · Mercado Nacional' },
  { value: '2', label: '2 · Exportaciones' },
];

const fallbackDepartmentOptions = [
  { value: '1', label: '1 · 10 Casa Matriz' },
  { value: '2', label: '2 · 20 Santiago C. Guzman' },
  { value: '3', label: '3 · 30 Valdivia G. Lagos' },
  { value: '4', label: '4 · 40 Concepcion J. Repullo' },
  { value: '5', label: '5 · 50 Valparaiso' },
];

const fallbackLocationOptions = [
  { value: '3', label: '3 · Valdivia_Bodega' },
  { value: '5', label: '5 · Santiago_Bodega' },
  { value: '6', label: '6 · Concepción_Bodega' },
  { value: '8', label: '8 · Bodega_Transito' },
];

export const vendorOptions = [
  { value: 'COMUNICACIONES BERMANN SPA', label: 'COMUNICACIONES BERMANN SPA' },
  { value: 'CLARO COMUNICACIONES SA', label: 'CLARO COMUNICACIONES SA' },
  { value: 'RECUPEROS SA', label: 'RECUPEROS SA' },
  { value: 'MACAF / SOCIEDAD DE TRANSPORTES', label: 'MACAF / SOCIEDAD DE TRANSPORTES' },
  { value: 'MANANTIAL', label: 'MANANTIAL' },
];

function generatedOptions(name: keyof typeof generatedCatalogs, fallback: CatalogOption[] = []) {
  const options = generatedCatalogs[name] as CatalogOption[] | undefined;
  return options && options.length > 0 ? options : fallback;
}

export const paymentTermsOptions = generatedOptions('paymentTermsOptions');
export const classOptions = generatedOptions('classOptions', fallbackClassOptions);
export const departmentOptions = generatedOptions('departmentOptions', fallbackDepartmentOptions);
export const locationOptions = generatedOptions('locationOptions', fallbackLocationOptions);
export const approvalGroupOptions = generatedOptions('approvalGroupOptions');

export function optionLabel(options: CatalogOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function optionName(options: CatalogOption[], value: string) {
  const option = options.find((item) => item.value === value);
  return option?.name ?? option?.label ?? value;
}

export function optionValueFromLabel(options: CatalogOption[], label: string) {
  const normalizedLabel = label.trim().toLowerCase();
  const option = options.find((item) => item.label.trim().toLowerCase() === normalizedLabel);
  return option?.value ?? null;
}

export function paymentTermDays(value: string) {
  return paymentTermsOptions.find((option) => option.value === value)?.daysUntilDue ?? 0;
}

export function approvalGroupIds(value: string) {
  return approvalGroupOptions.find((option) => option.value === value)?.ids ?? null;
}

export function approvalGroupValueFromIds(ids: unknown) {
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const normalizedIds = ids
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b);

  const match = approvalGroupOptions.find((option) => {
    const optionIds = (option.ids ?? []).map((id) => Number(id)).sort((a, b) => a - b);
    return optionIds.length === normalizedIds.length
      && optionIds.every((id, index) => id === normalizedIds[index]);
  });

  return match?.value ?? null;
}
