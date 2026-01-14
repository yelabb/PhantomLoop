/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        phantom: '#FFD700',
        biolink: '#00FF00',
        loopback: '#0080FF',
      },
    },
  },
  plugins: [],
}
