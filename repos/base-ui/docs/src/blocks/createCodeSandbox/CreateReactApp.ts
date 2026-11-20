interface GetHtmlParameters {
  title: string;
  language: string;
  additionalHeadContent?: string;
}

export const getHtml = ({ title, language, additionalHeadContent }: GetHtmlParameters) => {
  return `<!DOCTYPE html>
<html lang="${language}">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta name="viewport" content="initial-scale=1, width=device-width" />
    ${additionalHeadContent ?? ''}
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
};

export function getRootIndex(useTypescript: boolean) {
  // document.querySelector returns 'Element | null' but createRoot expects 'Element | DocumentFragment'.
  const type = useTypescript ? '!' : '';

  return `import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.querySelector("#root")${type}).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
}

export const getTsconfig = () => `{
  "compilerOptions": {
    "target": "es2022",
    "lib": [
      "dom",
      "dom.iterable",
      "esnext"
    ],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react"
  },
  "include": [
    "src"
  ]
}
`;
