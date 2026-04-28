import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Integración Facturas Compra',
  description: 'MVP operativo SII → NetSuite',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
