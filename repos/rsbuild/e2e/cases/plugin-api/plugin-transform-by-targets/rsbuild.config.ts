import { myPlugin } from './myPlugin';

export default {
  plugins: [myPlugin],
  environments: {
    web: {},
    node: {
      output: {
        target: 'node',
        distPath: 'dist/server',
      },
    },
  },
};
