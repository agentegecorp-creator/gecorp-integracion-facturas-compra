import './globals.css';
import type { Metadata } from 'next';
import { AppFrame } from '@/components/app-frame';

export const metadata: Metadata = {
  title: 'Integración Facturas Compra',
  description: 'MVP operativo SII → NetSuite',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
