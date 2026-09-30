/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutral scale: near-black (950) for page background up to
        // near-white (50) for high-emphasis text. `ink` bare = default
        // body text color (light, for the dark-first theme).
        ink: {
          50: "#f5f5f7",
          100: "#e7e7ea",
          200: "#d4d4da",
          300: "#b8b8c2",
          400: "#9494a1",
          500: "#8b8b96",
          600: "#45454f",
          700: "#2a2a33",
          800: "#1c1c24",
          900: "#121218",
          950: "#0a0a0f",
          DEFAULT: "#e7e7ea",
        },
        // Single restrained accent (electric blue) for CTAs/links/badges/focus.
        accent: {
          300: "#77a0f8",
          400: "#5185f6",
          500: "#2c6bf4",
          600: "#0c52e9",
          700: "#0a44c2",
          DEFAULT: "#2c6bf4",
        },
        bg: "#0a0a0f",
        surface: "#121218",
        muted: "#b8b8c2",
        subtle: "#8b8b96",
        border: "#242430",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,.04) inset, 0 16px 40px -16px rgba(0,0,0,.7)",
      },
    },
  },
  plugins: [],
};
