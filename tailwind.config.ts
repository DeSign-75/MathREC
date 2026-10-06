import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["Orbitron", "sans-serif"],
        tech: ["Rajdhani", "sans-serif"],
        mono: ['"Share Tech Mono"', "monospace"],
        robo: ["Orbitron", "Rajdhani", "ui-monospace", "monospace"],
        mono2: ["Rajdhani", "ui-monospace", "monospace"],
      },
      colors: {
        void: "#05070B",
        panel: "#0E1422",
        card: "#121826",
        cyber: {
          black: "#05070B",
          dark: "#080C14",
          surface: "#0E1422",
          border: "#1D283A",
          cyan: "#00F0FF",
          pink: "#FF0055",
          white: "#F0F6FC",
        },
        neon: "#ffffff",
        mint: "#00FF9D",
        crimson: "#FF0055",
        amber: "#FFB800",
        good: "#00FF9D",
        bad: "#FF0055",
        score: "#FFB800",
      },
      boxShadow: {
        glow: "0 0 18px rgba(255,255,255,0.18), 0 0 42px rgba(255,255,255,0.08)",
        glowcyan: "0 0 20px rgba(0,240,255,0.35), inset 0 0 15px rgba(0,240,255,0.12)",
        glowgood: "0 0 24px rgba(0,255,157,0.4), inset 0 0 12px rgba(0,255,157,0.15)",
        glowbad: "0 0 24px rgba(255,0,85,0.5), inset 0 0 12px rgba(255,0,85,0.2)",
      },
    },
  },
  plugins: [],
};
export default config;
