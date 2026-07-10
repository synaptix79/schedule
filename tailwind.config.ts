import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101114",
        paper: "#f6f2ea",
        moss: "#5d7554",
        clay: "#a65f3b",
        steel: "#53616f",
        signal: "rgb(var(--signal-rgb) / <alpha-value>)"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(16, 17, 20, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
