import { logger, type NormalizedConfig } from '../src';
import { getHTMLPathByEntry } from '../src/initPlugins';
import { hasTitle } from '../src/rspack-plugins/RsbuildHtmlPlugin';

test('should detect HTML title via "hasTitle" correctly', () => {
  expect(hasTitle()).toEqual(false);
  expect(hasTitle('<title></title>')).toEqual(true);
  expect(hasTitle('<title>hello</title>')).toEqual(true);
  expect(hasTitle('<title  ></title>')).toEqual(true);
  expect(hasTitle('<title></title  >')).toEqual(true);
  expect(hasTitle('<title >hello</title  >')).toEqual(true);
  expect(hasTitle('<html><head></head><body></body></html>')).toEqual(false);
  expect(hasTitle('<html><head><title>Page Title</title></head><body></body></html>')).toEqual(
    true,
  );
  expect(
    hasTitle('<html>\n<head>\n<title>\nPage Title\n</title>\n</head>\n<body></body>\n</html>'),
  ).toEqual(true);
});

describe('getHTMLPathByEntry', () => {
  it('should use distPath.html as the folder', async () => {
    const htmlPath = getHTMLPathByEntry(
      'main',
      {
        output: {
          distPath: {
            html: 'my-html',
          },
          filename: {},
          filenameHash: {},
        },
        html: {
          outputStructure: 'nested',
        },
      } as NormalizedConfig,
      logger,
    );

    expect(htmlPath).toEqual('my-html/main/index.html');
  });

  it('should allow disabling html folder', async () => {
    const htmlPath = getHTMLPathByEntry(
      'main',
      {
        output: {
          distPath: {
            html: 'html',
          },
          filename: {},
          filenameHash: {},
        },
        html: {
          outputStructure: 'flat',
        },
      } as NormalizedConfig,
      logger,
    );

    expect(htmlPath).toEqual('html/main.html');
  });
});
