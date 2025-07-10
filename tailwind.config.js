/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#a855f7", // violet premium
          dark: "#7e22ce",
        },
        secondary: {
          DEFAULT: "#ec4899", // pink premium
          dark: "#db2777",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};