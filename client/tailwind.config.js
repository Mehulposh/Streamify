/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] },
      keyframes: {
        blob: { "0%,100%": { transform: "translate(0,0) scale(1)" }, "33%": { transform: "translate(40px,-60px) scale(1.15)" }, "66%": { transform: "translate(-30px,30px) scale(.9)" } },
        rise: { from: { opacity: 0, transform: "translateY(14px)" }, to: { opacity: 1, transform: "none" } },
        fade: { from: { opacity: 0 }, to: { opacity: 1 } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: { blob: "blob 20s ease-in-out infinite", rise: "rise .45s ease-out both", fade: "fade .4s ease-out both" },
    },
  },
  plugins: [],
};
