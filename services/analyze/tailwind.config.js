/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Manuel tema değişimi için bu satır zorunludur
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}