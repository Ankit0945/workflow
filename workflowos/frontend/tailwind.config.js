/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          bg: "#b40f0f",
          surface: "#12151F",
          surface2: "#24c270",
          border: "#262B3B",
        },
        ink: {
          100: "#EDEFF5",
          300: "#B4BACB",
          500: "#7E8599",
        },
        violet: {
          400: "#4639ac",
          500: "#7C6FFA",
          600: "#6355E0",
        },
        teal: {
          400: "#3FE0C5",
          500: "#2DD4BF",
        },
        amber: {
          400: "#F5A524",
        },
        rose: {
          400: "#F2545B",
        },
      },
      fontFamily: {
        display: ["Sora", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,111,250,0.25), 0 8px 30px -8px rgba(124,111,250,0.35)",
      },
    },
  },
  plugins: [],
};
