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
        robo: ["Orbitron", "Rajdhani", "ui-monospace", "monospace"],
        mono2: ["Rajdhani", "ui-monospace", "monospace"],
      },
      colors: {
        void: "#07070c",
        panel: "#0e0e16",
        neon: "#ffffff",
        good: "#22ff88",
        bad: "#ff3b5c",
        score: "#ffd60a",
      },
      boxShadow: {
        glow: "0 0 18px rgba(255,255,255,0.18), 0 0 42px rgba(255,255,255,0.08)",
        glowgood: "0 0 22px rgba(34,255,136,0.45)",
        glowbad: "0 0 22px rgba(255,59,92,0.5)",
      },
    },
  },
  plugins: [],
};
export default config;
