import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./stores/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        panel: "#111827",
        border: "#1f2937",
        muted: "#9ca3af",
        accent: "#6366f1",
      },
      fontFamily: {
        sans: ["Inter", "Geist Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(99, 102, 241, 0.18), 0 12px 42px rgba(15, 23, 42, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
