import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import RoleBar from '@/components/RoleBar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Supermetro — UberBasi Matatu PWA',
  description: 'Kenyan matatu ticketing and fleet management PWA for Supermetro.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen flex flex-col`}>
        <RoleBar />
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
        <footer className="bg-slate-900/60 border-t border-slate-800/80 py-4 text-center text-xs text-slate-400">
          Supermetro SACCO Demo • UberBasi Platform Infrastructure • Thika Superhighway Corridor (Route 237)
        </footer>
      </body>
    </html>
  );
}
