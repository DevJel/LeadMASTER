/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./required-componets-design/**/*.{ts,tsx,js,jsx,html}",
    "./src/Mandatory LeadMASTER Dashboard.html",
    "./public/dashboard.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"]
      }
    }
  },
  plugins: []
};
