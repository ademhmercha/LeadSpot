import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#bcdaff",
          300: "#8ec2ff",
          400: "#589fff",
          500: "#3178f6",
          600: "#1d5aeb",
          700: "#1846d6",
          800: "#1a3ba8",
          900: "#1b3785",
        },
      },
    },
  },
  plugins: [],
};

export default config;
