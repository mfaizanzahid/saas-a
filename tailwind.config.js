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

    // themes: ["light","fantasy",
    //   {
    //     saasstartertheme: {
    //       "primary": "#180042",
    //       "primary-content": "#fefbf6",
    //       "neutral-content": "#fefbf6",
    //       "secondary": "#c7b9f8",
    //       "accent": "#db2777",
    //       "neutral": "#180042",
    //       "base-content": "#180042",
    //       "base-100": "#fefbf6",  
    //     },
    //   }
    // ],

    themes: [
      {
        mytheme: {
          
"primary": "#4b00c1",
          
"primary-content": "#e5d9ff",
          
"secondary": "#4beac1",
          
"secondary-content": "#001316",
          
"accent": "#00e3e1",
          
"accent-content": "#001212",
          
"neutral": "#1f2937",
          
"neutral-content": "#cdc9c9",
          
"base-100": "#ffffff",
          
"base-200": "#dedede",
          
"base-300": "#bebebe",
          
"base-content": "#374151",
          
"info": "#0087ab",
          
"info-content": "#00060b",
          
"success": "#00ee89",
          
"success-content": "#000604",
          
"warning": "#ffec24",
          
"warning-content": "#140b00",
          
"error": "#ff7788",
          
"error-content": "#160506",
          },
        },
      ],


//     themes: [
//       {
//         mytheme: {
          
// "primary": "#8c00ff",
          
// "primary-content": "#e5d9ff",
          
// "secondary": "#00ecff",
          
// "secondary-content": "#001316",
          
// "accent": "#00e3e1",
          
// "accent-content": "#001212",
          
// "neutral": "#1f2937",
          
// "neutral-content": "#cdc9c9",
          
// "base-100": "#ffffff",
          
// "base-200": "#dedede",
          
// "base-300": "#bebebe",
          
// "base-content": "#374151",
          
// "info": "#0087ab",
          
// "info-content": "#00060b",
          
// "success": "#008866",
          
// "success-content": "#000604",
          
// "warning": "#f2ae00",
          
// "warning-content": "#140b00",
          
// "error": "#ff7788",
          
// "error-content": "#160506",
//           },
//         },
//       ],
  }
}

