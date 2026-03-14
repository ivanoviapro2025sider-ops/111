import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'KIMI Video Instructor',
  description: 'Generate step-by-step instructions from video using AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${inter.className} dark`}>
        <ThemeProvider defaultTheme="dark" storageKey="kimi-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
