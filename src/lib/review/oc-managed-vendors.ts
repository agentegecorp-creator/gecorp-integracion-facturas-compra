export type OcManagedVendor = {
  rut: string;
  normalizedRut: string;
  name: string;
};

export const OC_MANAGED_VENDORS: OcManagedVendor[] = [
  { rut: '96993560-0', normalizedRut: '969935600', name: 'IMPORTADORA Y EXPORTADORA GIRONA .S.A' },
  { rut: '83274700-9', normalizedRut: '832747009', name: 'Navarro y Cia Spa' },
  { rut: '78425850-5', normalizedRut: '784258505', name: 'BALL CHILE S.A.' },
  { rut: '91942000-6', normalizedRut: '919420006', name: 'MALTEXCO S.A.' },
  { rut: '87690900-6', normalizedRut: '876909006', name: 'DISTRIBUIDORA PORTLAND S.A.' },
  { rut: '76151639-6', normalizedRut: '761516396', name: 'Sociedad Comercial Yerival Ltda.' },
  { rut: '76376519-9', normalizedRut: '763765199', name: 'TIEMPOCAR SPA' },
  { rut: '77140079-5', normalizedRut: '771400795', name: 'GROUP LAHH SER SPA' },
  { rut: '76164832-2', normalizedRut: '761648322', name: 'REFRIGERACION Y ELECTRICIDAD INDUSTRIAL ALTO FRIO LIMITADA' },
  { rut: '99587850-K', normalizedRut: '99587850K', name: 'COMACO SERVICIOS LOGISTICOS SPA' },
  { rut: '96556940-5', normalizedRut: '965569405', name: 'PROVEEDORES INTEGRALES PRISA S A' },
  { rut: '77084730-3', normalizedRut: '770847303', name: 'MARYUN SEGURIDAD INDUSTRIAL SPA' },
  { rut: '77271012-7', normalizedRut: '772710127', name: 'AMBIQUIM RP SPA' },
  { rut: '96607770-0', normalizedRut: '966077700', name: 'COMERCIAL VENSER S.A' },
];

export const OC_MANAGED_VENDOR_RUTS = OC_MANAGED_VENDORS.map((vendor) => vendor.normalizedRut);

export function normalizeRut(value?: string | null) {
  return String(value ?? '').toUpperCase().replace(/[^0-9K]/g, '');
}

export function isOcManagedVendorRut(value?: string | null) {
  return OC_MANAGED_VENDOR_RUTS.includes(normalizeRut(value));
}
