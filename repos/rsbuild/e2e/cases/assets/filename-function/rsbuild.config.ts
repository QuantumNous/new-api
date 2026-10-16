import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    filename: {
      js: (pathData) => {
        if (pathData.chunk?.name === 'index') {
          return 'my-index.js';
        }

        return '/some-path/[name].js';
      },
      css: (pathData) => {
        if (pathData.chunk?.name === 'index') {
          return 'my-index.css';
        }
        return '/some-path/[name].css';
      },
      image: (pathData) => {
        if (pathData.filename?.includes('icon.png')) {
          return 'my-icon.png';
        }
        return '/some-path/[name][ext]';
      },
      svg: (pathData) => {
        if (pathData.filename?.includes('circle.svg')) {
          return 'my-circle.svg';
        }
        return '/some-path/[name][ext]';
      },
    },
  },
});
