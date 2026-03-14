import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';

export const metadata: Metadata = {
  title: 'KIMI Swarm Chat Service',
  description: 'Next.js service for Kimi K2 via OpenRouter with swarm agents, file uploads and local persistence.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <div className="flex min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0.4),_transparent_40%)]">
          <Sidebar />
          <div className="flex min-h-screen flex-1 flex-col">
            <Header />
            <main className="flex-1 px-4 py-6 xl:px-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
