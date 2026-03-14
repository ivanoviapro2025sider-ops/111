import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { Sidebar } from '@/components/layout/Sidebar';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'KIMI Video Instructor',
  description: 'Generate step-by-step instructions from video',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider defaultTheme="dark" storageKey="kimi-theme">
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 pl-0 pt-16 md:pl-64 md:pt-0 min-h-screen">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
