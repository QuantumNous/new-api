export default {
  plugins: {
    '@tailwindcss/postcss': {
      // Ensure tailwindcss only watch files in the current directory
      base: import.meta.dirname,
    },
  },
};
