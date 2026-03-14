import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "KIMI Swarm Chat Service",
  description: "Multi-agent chat UI powered by OpenRouter Kimi K2.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-[#0a0a0a] text-zinc-100 antialiased`}
      >
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <Header />
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
