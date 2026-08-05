export const appConfig = {
  name: 'Integración Facturas Compra',
  basePath: '/',
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'facturascompra_session',
  secureCookies: process.env.NODE_ENV === 'production',
};
