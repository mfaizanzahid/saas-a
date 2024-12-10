/** @type {import('tailwindcss').Config} */
import typography from "@tailwindcss/typography"
import daisyui from "daisyui"

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {},
  },
  plugins: [typography, daisyui],
  daisyui: {
    themes: ["fantasy",
      {
        saasstartertheme: {
          "primary": "#180042",
          "primary-content": "#fefbf6",
          "neutral-content": "#fefbf6",
          "secondary": "#c7b9f8",
          "accent": "#db2777",
          "neutral": "#180042",
          "base-content": "#180042",
          "base-100": "#fefbf6",  
        },
      }
    ],
  }
}

