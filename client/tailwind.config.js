/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F6F7F9",
        surface: "#FFFFFF",
        ink: "#14161A",
        muted: "#5B6472",
        subtle: "#8A93A3",
        accent: "#2563EB",
        accent2: "#0D9488",
        border: "#E6E8EC",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.06), 0 8px 24px rgba(16,24,40,.06)",
      },
    },
  },
  plugins: [],
};
