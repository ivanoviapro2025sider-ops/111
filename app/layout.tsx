import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { TooltipProvider } from '@/components/ui/tooltip';

export const metadata: Metadata = {
  title: 'KIMI Swarm Chat',
  description: 'Multi-agent chat service powered by Kimi K2 via OpenRouter API',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <TooltipProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <Header />
              <main className="flex-1 overflow-auto">{children}</main>
            </div>
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}
