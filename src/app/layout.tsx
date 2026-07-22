import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Instrument_Serif, Inter } from 'next/font/google';

import './globals.css';

const displayFont = Instrument_Serif({
  variable: '--font-instrument-serif',
  weight: '400',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});

const uiFont = Inter({
  variable: '--font-inter',
  weight: ['400', '500', '600'],
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'A L T E R .',
  description: 'A L T E R . learning release',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${uiFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
