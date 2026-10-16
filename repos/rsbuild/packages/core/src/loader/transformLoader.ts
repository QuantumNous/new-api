import type { SourceMapInput } from '@jridgewell/trace-mapping';
import type { LoaderDefinition, RawSourceMap } from '@rspack/core';
import type { EnvironmentContext } from '../types';

export type TransformLoaderOptions = {
  id: string;
  getEnvironment: () => EnvironmentContext;
};

const mergeSourceMap = async (
  originalSourceMap: RawSourceMap | string,
  generatedSourceMap: RawSourceMap | string,
): Promise<RawSourceMap> => {
  const { default: remapping } = await import(
    /* rspackChunkName: "remapping" */ '@jridgewell/remapping'
  );
  return remapping(
    [generatedSourceMap, originalSourceMap] as SourceMapInput[],
    () => null,
  ) as RawSourceMap;
};

const transformLoader: LoaderDefinition<TransformLoaderOptions> = async function transform(
  source,
  map,
): Promise<void> {
  const callback = this.async();

  const { id: transformId, getEnvironment } = this.getOptions();
  if (!transformId) {
    callback(null, source, map);
    return;
  }

  const transform = this._compiler?.__rsbuildTransformer?.[transformId];
  if (!transform) {
    callback(null, source, map);
    return;
  }

  try {
    const result = await transform({
      code: source,
      context: this.context,
      resource: this.resource,
      resourcePath: this.resourcePath,
      resourceQuery: this.resourceQuery,
      environment: getEnvironment(),
      addDependency: this.addDependency.bind(this),
      addMissingDependency: this.addMissingDependency.bind(this),
      addContextDependency: this.addContextDependency.bind(this),
      emitFile: this.emitFile.bind(this),
      importModule: this.importModule.bind(this),
      resolve: this.resolve.bind(this),
    });

    if (result === null || result === undefined) {
      callback(null, source, map);
      return;
    }

    if (typeof result === 'string' || Buffer.isBuffer(result)) {
      callback(null, result, map);
      return;
    }

    const mergedMap =
      map && result.map ? await mergeSourceMap(map, result.map) : (result.map ?? map);
    callback(null, result.code, mergedMap);
  } catch (error) {
    if (error instanceof Error) {
      callback(error);
    } else {
      callback(new Error(String(error)));
    }
  }
};

export default transformLoader;
