import getBaseConfig from '@mui/internal-code-infra/babel-config';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const errorCodesPath = path.join(dirname, 'docs/src/error-codes.json');

export default function getBabelConfig(api) {
  const baseConfig = getBaseConfig(api);

  const plugins = [
    [
      '@mui/internal-babel-plugin-minify-errors',
      {
        missingError: 'annotate',
        runtimeModule: '#formatErrorMessage',
        detection: 'opt-out',
        errorCodesPath,
        outExtension: process.env.MUI_OUT_FILE_EXTENSION ?? undefined,
      },
    ],
  ];

  const displayNamePlugin = baseConfig.plugins.find(
    (p) => p[2] === '@mui/internal-babel-plugin-display-name',
  );
  displayNamePlugin[1].allowedCallees ??= {};
  displayNamePlugin[1].allowedCallees['@base-ui/utils/fastHooks'] = [
    'fastComponent',
    'fastComponentRef',
  ];

  return {
    ...baseConfig,
    plugins: [...baseConfig.plugins, ...plugins],
    overrides: [
      {
        exclude: /\.test\.(js|ts|tsx)$/,
        plugins: ['@babel/plugin-transform-react-constant-elements'],
      },
    ],
    env: {
      test: {
        sourceMaps: 'both',
      },
    },
  };
}
