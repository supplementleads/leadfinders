import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: "#0A0A0F",
          surface: "#111118",
          surface2: "#1A1A24",
          surface3: "#22222E",
          border: "#2A2A38",
          border2: "#383848",
          amber: "#F59E0B",
          "amber-dim": "#92400E",
          purple: "#8B5CF6",
          "purple-dim": "#4C1D95",
          cyan: "#06B6D4",
          green: "#10B981",
          red: "#EF4444",
          muted: "#6B7280",
          text: "#F0EFEA",
          "text-dim": "#A0A0B0",
        },
      },
      fontFamily: {
        sans: ["var(--font-syne)", "system-ui", "sans-serif"],
        mono: ["var(--font-dm-mono)", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.4s ease-out",
        "spin-slow": "spin 3s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
