import type { Config } from "tailwindcss";

// Azion dark palette + orange accent.
// HSL chosen to keep Tailwind opacity modifiers usable (e.g. bg-primary/30).
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Sora",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        // Surfaces
        background: "hsl(0 0% 4%)", // ~#0A0A0A
        foreground: "hsl(0 0% 96%)",
        // Subtle elevated surface (bubbles, inputs, popovers)
        muted: "hsl(0 0% 9%)", // ~#161616
        "muted-foreground": "hsl(0 0% 64%)",
        // Borders / dividers
        border: "hsl(0 0% 15%)", // ~#262626
        // Accent — Azion orange (#F3652B ≈ hsl(14 89% 56%))
        primary: "hsl(14 89% 56%)",
        "primary-foreground": "hsl(0 0% 6%)",
        // Status
        success: "hsl(142 70% 45%)",
        danger: "hsl(0 72% 51%)",
      },
      ringColor: {
        DEFAULT: "hsl(14 89% 56% / 0.35)",
      },
      boxShadow: {
        popover: "0 8px 24px -6px hsl(0 0% 0% / 0.6), 0 0 0 1px hsl(0 0% 15%)",
      },
    },
  },
} satisfies Config;
