import { URL } from 'node:url';
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';
import { logger, type RsbuildPlugin } from '@rsbuild/core';
import type { Page } from 'playwright';
import { expect } from './fixture.ts';

/**
 * Build an URL based on the entry name and port
 */
export const buildEntryUrl = (entryName: string, port: number) => {
  const htmlRoot = new URL(`http://localhost:${port}`);
  const homeUrl = new URL(`${entryName}.html`, htmlRoot);
  return homeUrl.href;
};

/**
 * Build the entry URL and navigate to it
 */
export const gotoPage = async (
  page: Page,
  rsbuild: { port: number },
  path = 'index',
  { hash = '' } = {},
) => {
  const url = `${buildEntryUrl(path, rsbuild.port)}${hash ? `#${hash}` : ''}`;
  return page.goto(url);
};

export const noop = async () => {};

/**
 * A faster `expect.poll`
 */
export const expectPoll: typeof expect.poll = (fn) => {
  return expect.poll(fn, {
    intervals: [20, 30, 40, 50, 60, 70, 80, 90, 100],
  });
};

export const recordPluginHooks = () => {
  const hooks: string[] = [];

  const plugin: RsbuildPlugin = {
    name: 'record-hooks-plugin',
    setup(api) {
      api.modifyRspackConfig(() => {
        hooks.push('ModifyBundlerConfig');
      });
      api.modifyRsbuildConfig(() => {
        hooks.push('ModifyRsbuildConfig');
      });
      api.modifyEnvironmentConfig(() => {
        hooks.push('ModifyEnvironmentConfig');
      });
      api.modifyBundlerChain(() => {
        hooks.push('ModifyBundlerChain');
      });
      api.modifyHTML((html) => {
        hooks.push('ModifyHTML');
        return html;
      });
      api.modifyHTMLTags((tags) => {
        hooks.push('ModifyHTMLTags');
        return tags;
      });
      api.onBeforeStartDevServer(() => {
        hooks.push('BeforeStartDevServer');
      });
      api.onAfterStartDevServer(() => {
        hooks.push('AfterStartDevServer');
      });
      api.onBeforeCreateCompiler(() => {
        hooks.push('BeforeCreateCompiler');
      });
      api.onAfterCreateCompiler(() => {
        hooks.push('AfterCreateCompiler');
      });
      api.onBeforeBuild(() => {
        hooks.push('BeforeBuild');
      });
      api.onBeforeDevCompile(() => {
        hooks.push('BeforeDevCompile');
      });
      api.onAfterBuild(() => {
        hooks.push('AfterBuild');
      });
      api.onBeforeEnvironmentCompile(() => {
        hooks.push('BeforeEnvironmentCompile');
      });
      api.onAfterEnvironmentCompile(() => {
        hooks.push('AfterEnvironmentCompile');
      });
      api.onBeforeStartPreviewServer(() => {
        hooks.push('BeforeStartPreviewServer');
      });
      api.onCloseDevServer(() => {
        hooks.push('CloseDevServer');
      });
      api.onAfterStartPreviewServer(() => {
        hooks.push('AfterStartPreviewServer');
      });
      api.onAfterDevCompile(() => {
        hooks.push('AfterDevCompile');
      });
      api.onDevCompileDone(() => {
        hooks.push('DevCompileDone');
      });
      api.onCloseBuild(() => {
        hooks.push('CloseBuild');
      });
    },
  };

  return { plugin, hooks };
};

export async function mapSourceMapPositions(
  rawSourceMap: string,
  generatedPositions: {
    line: number;
    column: number;
  }[],
) {
  const tracer = new TraceMap(rawSourceMap);
  const originalPositions = generatedPositions.map((generatedPosition) =>
    originalPositionFor(tracer, {
      line: generatedPosition.line,
      column: generatedPosition.column,
    }),
  );

  return originalPositions;
}

export const enableDebugMode = () => {
  process.env.DEBUG = 'rsbuild';
  const { level } = logger;
  logger.level = 'verbose';
  return () => {
    delete process.env.DEBUG;
    logger.level = level;
  };
};
