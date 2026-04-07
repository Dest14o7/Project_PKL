
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        coffee: {
          dark: "#6F4E37",
          medium: "#A67B5B",
          light: "#ECB176",
          cream: "#FFF8F0",
        }
      }
    },
  },
  plugins: [],
}