import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should compile CSS Modules with default configuration', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, 'index.css');
  expect(content).toMatch(
    /\.the-a-class{color:red}\.the-b-class-\w{6}{color:#00f}\.the-c-class-\w{6}{color:#ff0}\.the-d-class{color:green}/,
  );
});

test('should compile CSS Modules with custom auto configuration', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        cssModules: {
          auto: (resource) => {
            return resource.includes('.scss');
          },
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, 'index.css');
  expect(content).toMatch(
    /.the-a-class{color:red}.the-b-class-\w{6}{color:#00f}.the-c-class{color:#ff0}.the-d-class{color:green}/,
  );
});

test('should compile CSS Modules with custom localIdentName pattern', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        cssModules: {
          localIdentName: '[hash:base64:8]',
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, 'index.css');
  expect(content).toMatch(
    /\.the-a-class{color:red}\.\w{8}{color:#00f}\.\w{8}{color:#ff0}\.the-d-class{color:green}/,
  );
});

test('should compile CSS Modules with custom hash digest format', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        cssModules: {
          localIdentName: '[hash:hex:4]',
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, 'index.css');
  expect(content).toMatch(
    /\.the-a-class{color:red}\.\w{4}{color:#00f}\.\w{4}{color:#ff0}\.the-d-class{color:green}/,
  );
});
