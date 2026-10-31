import path from 'node:path';
import type { Compilation, LoaderContext, LoaderDefinition } from '@rspack/core';

const INLINE_QUERY_REGEX = /[?&]inline(?:&|=|$)/;
const JS_FILE_REGEX = /\.m?js(?:\?.*)?$/;
const SOURCE_MAPPING_URL_REGEX = /(?:\/\*# sourceMappingURL=.*?\*\/|\/\/# sourceMappingURL=.*)$/gm;

type WorkerLoaderOptions = {
  name?: string;
};

const normalizePath = (value: string) => value.replace(/\\/g, '/');

const toWorkerRequest = (resourcePath: string) => `./${normalizePath(path.basename(resourcePath))}`;

const getWorkerOptionsCode = (isModule: boolean) => `{
  ${isModule ? 'type: "module",' : ''}
  name: options && options.name
}`;

const getWorkerWrapper = ({
  resourcePath,
  isModule,
}: {
  resourcePath: string;
  isModule: boolean;
}) => {
  const workerRequest = toWorkerRequest(resourcePath);
  const workerOptions = getWorkerOptionsCode(isModule);

  return `export default function WorkerWrapper(options) {
  return new Worker(new URL(${JSON.stringify(workerRequest)}, import.meta.url), ${workerOptions});
}`;
};

const stripSourceMappingURL = (source: string) => source.replace(SOURCE_MAPPING_URL_REGEX, '');

const getInlineWorkerWrapper = ({ source, isModule }: { source: string; isModule: boolean }) => {
  const workerOptions = getWorkerOptionsCode(isModule);
  const revokeCode = isModule
    ? 'URL.revokeObjectURL(import.meta.url);'
    : '(self.URL || self.webkitURL).revokeObjectURL(self.location.href);';

  // Keep the generated wrapper code ES6-compatible since it will not go through transforms.
  return `const jsContent = ${JSON.stringify(stripSourceMappingURL(source))};
const workerURL = typeof self !== "undefined" && (self.URL || self.webkitURL);
const blob = workerURL && self.Blob && new Blob([${JSON.stringify(
    revokeCode,
  )}, jsContent], { type: "text/javascript;charset=utf-8" });

export default function WorkerWrapper(options) {
  let objURL;
  try {
    objURL = blob && workerURL.createObjectURL(blob);
    if (!objURL) throw "";
    const worker = new Worker(objURL, ${workerOptions});
    worker.addEventListener("error", () => {
      workerURL.revokeObjectURL(objURL);
    });
    return worker;
  } catch (e) {
    if (objURL) {
      workerURL.revokeObjectURL(objURL);
    }
    return new Worker(
      "data:text/javascript;charset=utf-8," + encodeURIComponent(jsContent),
      ${workerOptions}
    );
  }
}`;
};

const deleteAsset = (compilation: Compilation, filename: string) => {
  if (compilation.getAsset(filename)) {
    compilation.deleteAsset(filename);
  }
};

const compileInlineWorker = (context: LoaderContext<WorkerLoaderOptions>): Promise<string> => {
  const compiler = context._compiler;
  const compilation = context._compilation;
  const { rspack } = compiler;
  const { outputOptions } = compilation;
  const compilerName = `rsbuild-worker ${context.resourcePath}`;

  const childCompiler = compilation.createChildCompiler(
    compilerName,
    {
      publicPath: outputOptions.publicPath,
      globalObject: 'self',
      module: outputOptions.module,
      chunkFormat: outputOptions.module ? 'module' : undefined,
      chunkLoading: outputOptions.module ? 'import' : undefined,
      workerChunkLoading: outputOptions.workerChunkLoading,
      wasmLoading: outputOptions.wasmLoading,
      workerWasmLoading: outputOptions.workerWasmLoading,
    },
    [],
  );

  new rspack.webworker.WebWorkerTemplatePlugin().apply(childCompiler);

  const moduleOptions = childCompiler.options.module;
  const parserOptions = moduleOptions.parser ?? {};

  // Inline workers run from Blob/data URLs, so dynamic import chunks cannot be
  // loaded by relative URLs. Use eager imports to keep the worker in one file.
  childCompiler.options.module = {
    ...moduleOptions,
    parser: {
      ...parserOptions,
      javascript: {
        ...parserOptions.javascript,
        dynamicImportMode: 'eager',
      },
    },
  };

  new rspack.LoaderTargetPlugin('webworker').apply(childCompiler);

  new rspack.EntryPlugin(
    context.context ?? path.dirname(context.resourcePath),
    context.resourcePath,
    path.parse(context.resourcePath).name,
  ).apply(childCompiler);

  return new Promise((resolve, reject) => {
    childCompiler.runAsChild((error, entries, childCompilation) => {
      if (error) {
        reject(error);
        return;
      }

      const entry = entries?.[0];
      if (!entry || !childCompilation) {
        reject(
          new Error(`[rsbuild:worker] Failed to compile inline worker "${context.resourcePath}".`),
        );
        return;
      }

      const files = [...entry.files];
      const jsFiles = files.filter((file) => JS_FILE_REGEX.test(file));
      const workerFilename = jsFiles[0];

      if (!workerFilename) {
        reject(
          new Error(
            `[rsbuild:worker] Failed to find the inline worker output for "${context.resourcePath}".`,
          ),
        );
        return;
      }

      const extraJsFiles = childCompilation
        .getAssets()
        .map((asset) => asset.name)
        .filter((file) => file !== workerFilename && JS_FILE_REGEX.test(file));
      if (extraJsFiles.length > 0) {
        reject(
          new Error(
            `[rsbuild:worker] Inline workers do not support code splitting yet. Use ?worker instead, or remove dynamic imports from "${context.resourcePath}".`,
          ),
        );
        return;
      }

      const asset = childCompilation.getAsset(workerFilename);
      if (!asset) {
        reject(
          new Error(
            `[rsbuild:worker] Failed to read the inline worker output "${workerFilename}".`,
          ),
        );
        return;
      }

      deleteAsset(compilation, workerFilename);
      deleteAsset(compilation, `${workerFilename}.map`);

      for (const file of childCompilation.fileDependencies) {
        context.addDependency(file);
      }
      for (const dir of childCompilation.contextDependencies) {
        context.addContextDependency(dir);
      }
      for (const missing of childCompilation.missingDependencies) {
        context.addMissingDependency(missing);
      }

      resolve(asset.source.source().toString());
    });
  });
};

const workerLoader: LoaderDefinition<WorkerLoaderOptions> =
  async function workerLoader(): Promise<void> {
    const callback = this.async();
    const isModule = Boolean(this._compilation.outputOptions.module);

    try {
      if (!INLINE_QUERY_REGEX.test(this.resourceQuery)) {
        callback(null, getWorkerWrapper({ resourcePath: this.resourcePath, isModule }));
        return;
      }

      const source = await compileInlineWorker(this);
      callback(null, getInlineWorkerWrapper({ source, isModule }));
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)));
    }
  };

export default workerLoader;
