import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KIMI Swarm Studio",
  description: "OpenRouter-powered KIMI swarm control plane with large-file uploads."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
