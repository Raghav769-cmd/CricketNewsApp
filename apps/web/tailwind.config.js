import defaultTheme from 'tailwindcss/defaultTheme';

const config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        primary: '#0070f3',
        secondary: '#1c1c1e',
        accent: '#f5f5f5',
      },
    },
  },
  plugins: [],
};

export default config;