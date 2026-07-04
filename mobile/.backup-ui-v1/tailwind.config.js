/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f0f7f3",
          100: "#dceee4",
          200: "#b8ddc8",
          300: "#85c5a3",
          400: "#4da678",
          500: "#2a8a55",
          600: "#004225",
          700: "#003620",
          800: "#002a18",
          900: "#001e10",
        },
        gray: {
          50: "#f9fafb",
          100: "#f3f4f6",
          200: "#e5e7eb",
          300: "#d1d5db",
          400: "#9ca3af",
          500: "#6b7280",
          600: "#4b5563",
          700: "#374151",
          800: "#1f2937",
          900: "#111827",
        },
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
      borderRadius: {
        "2xl": 16,
        "3xl": 24,
      },
    },
  },
  plugins: [],
};
