/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      {
        "github": {
          "primary": "#0969da",
          "primary-content": "#ffffff",
          "secondary": "#656d76", 
          "secondary-content": "#ffffff",
          "accent": "#8250df",
          "accent-content": "#ffffff",
          "neutral": "#24292f",
          "neutral-content": "#ffffff",
          "base-100": "#ffffff",
          "base-200": "#f6f8fa",
          "base-300": "#d0d7de",
          "base-content": "#24292f",
          "info": "#0969da",
          "info-content": "#ffffff",
          "success": "#1a7f37",
          "success-content": "#ffffff",
          "warning": "#d97706",
          "warning-content": "#ffffff",
          "error": "#d1242f",
          "error-content": "#ffffff",
        }
      },
      "light",
      "dark"
    ],
    darkTheme: "dark",
    base: true,
    styled: true,
    utils: true,
    prefix: "",
    logs: true,
    themeRoot: ":root",
  },
}