import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Records & Access',
  description: 'Multi-tenant records with strict ownership scoping',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
