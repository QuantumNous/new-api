/**
 * modified from https://github.com/facebook/create-react-app
 * license at https://github.com/facebook/create-react-app/blob/master/LICENSE
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { JS_REGEX } from '../constants';
import { color, hash } from '../helpers';
import type { Logger } from '../logger';
import type {
  InternalContext,
  NormalizedEnvironmentConfig,
  PrintFileSizeAsset,
  PrintFileSizeOptions,
  RsbuildPlugin,
  Rspack,
} from '../types';

type SizeMap = Record<
  string,
  {
    size: number;
    gzippedSize?: number;
  }
>;

type SizeSnapshot = {
  files: SizeMap;
  totalSize: number;
  totalGzipSize: number;
};

type SizeSnapshots = Record<string, SizeSnapshot>;

type FormattedAsset = {
  filePath: string;
  filenameLabel: string;
  filenameLength: number;
  size: number;
  sizeLabel: string;
  sizeLabelLength: number;
  gzippedSize: number | null;
  gzipSizeLabel: string | null;
};

async function gzipSize(input: Buffer | string) {
  const data = await new Promise<Buffer>((resolve, reject) => {
    zlib.gzip(input, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
  return data.length;
}

/** Get the cache file path for storing previous build sizes */
function getSnapshotPath(dir: string, snapshotHash: string): string {
  if (snapshotHash) {
    return path.join(dir, `rsbuild/file-sizes-${snapshotHash}.json`);
  }
  return path.join(dir, 'rsbuild/file-sizes.json');
}

/** Normalize file path by removing hash for comparison across builds */
export function normalizeFilePath(filePath: string): string {
  // Remove hash patterns like .a1b2c3d4. but keep the extension
  return filePath.replace(/\.[a-f0-9]{8,}\./g, '.');
}

/** Load previous build file sizes from snapshots */
async function loadPrevSnapshots(snapshotPath: string): Promise<SizeSnapshots | null> {
  try {
    const content = await fs.promises.readFile(snapshotPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    // Cache doesn't exist or is invalid
    return null;
  }
}

/** Save current build file sizes to snapshots */
async function saveSnapshots(
  snapshotPath: string,
  snapshots: SizeSnapshots,
  logger: Logger,
): Promise<void> {
  try {
    await fs.promises.mkdir(path.dirname(snapshotPath), { recursive: true });
    await fs.promises.writeFile(snapshotPath, JSON.stringify(snapshots, null, 2));
  } catch (err) {
    // Fail silently - snapshots is not critical
    logger.debug('Failed to save file size snapshots:', err);
  }
}

const EXCLUDE_ASSET_REGEX = /\.(?:map|LICENSE\.txt|d\.(?:ts|mts|cts))$/;

/** Exclude source map, license, and type declaration files by default */
export const excludeAsset = (asset: PrintFileSizeAsset): boolean =>
  EXCLUDE_ASSET_REGEX.test(asset.name);

/** Check if the size difference is significant */
const isSignificantDiff = (diff: number) => Math.abs(diff) >= 10;

/** Format a size difference for inline display */
const formatDiff = (diff: number) => {
  const sign = diff > 0 ? '+' : '-';
  const label = `(${sign}${calcFileSize(Math.abs(diff))})`;
  const colorFn = diff > 0 ? color.red : color.green;
  return {
    label: colorFn(label),
    length: label.length,
  };
};

const getAssetColor = (size: number) => {
  if (size > 300 * 1000) {
    return color.red;
  }
  if (size > 100 * 1000) {
    return color.yellow;
  }
  return (input: string) => input;
};

function getHeader(
  maxFileLength: number,
  maxSizeLength: number,
  fileHeader: string,
  showGzipHeader: boolean,
) {
  const lengths = [maxFileLength, maxSizeLength];
  const rowTypes = [fileHeader, 'Size'];

  if (showGzipHeader) {
    rowTypes.push('Gzip');
  }

  const headerRow = rowTypes.reduce((prev, cur, index) => {
    const length = lengths[index];
    let curLabel = cur;
    if (length) {
      curLabel = cur.length < length ? cur + ' '.repeat(length - cur.length) : cur;
    }
    return `${prev + curLabel}   `;
  }, '');

  return color.blue(headerRow);
}

/** Calculate the file size in kB. */
const calcFileSize = (len: number) => {
  const val = len / 1000;
  return `${val.toFixed(val < 1 ? 2 : 1)} kB`;
};

const coloringAssetName = (assetName: string) => {
  if (JS_REGEX.test(assetName)) {
    return color.cyan(assetName);
  }
  if (assetName.endsWith('.css')) {
    return color.yellow(assetName);
  }
  if (assetName.endsWith('.html')) {
    return color.green(assetName);
  }
  return color.magenta(assetName);
};

const COMPRESSIBLE_REGEX =
  /\.(?:js|mjs|cjs|jsx|ts|tsx|mts|cts|css|html|json|svg|txt|xml|xhtml|wasm|manifest|md)$/i;

/** Check if the asset is compressible. */
const isCompressible = (assetName: string) => COMPRESSIBLE_REGEX.test(assetName);

const getFilePath = (assetName: string) => {
  const queryIndex = assetName.indexOf('?');
  return queryIndex === -1 ? assetName : assetName.slice(0, queryIndex);
};

const calcTotalSize = (assets: FormattedAsset[], compressed?: boolean) => {
  let totalSize = 0;
  let totalGzipSize = 0;

  for (const { size, gzippedSize } of assets) {
    totalSize += size;
    if (compressed) {
      totalGzipSize += gzippedSize ?? size;
    }
  }

  return {
    totalSize,
    totalGzipSize,
  };
};

async function printFileSizes(
  options: PrintFileSizeOptions,
  stats: Rspack.Stats,
  rootPath: string,
  distPath: string,
  environmentName: string,
  previousSizes: SizeSnapshots | null,
  saveSnapshot: boolean,
) {
  const logs: string[] = [];
  const showDetail = options.detail !== false;
  const showDiff = options.diff !== false && previousSizes !== null;
  let showTotal = options.total !== false;

  if (!showTotal && !showDetail) {
    return { logs };
  }

  const relativeDistPath = path.relative(rootPath, distPath);
  const snapshot: SizeSnapshot | null = saveSnapshot
    ? {
        files: {},
        totalSize: 0,
        totalGzipSize: 0,
      }
    : null;

  const formatAsset = (
    filePath: string,
    size: number,
    gzippedSize: number | null,
  ): FormattedAsset => {
    let normalizedPath = '';

    // Store current size for next build
    if (snapshot || showDiff) {
      // Normalize filename for comparison (remove hash)
      normalizedPath = normalizeFilePath(filePath);

      if (snapshot) {
        snapshot.files[normalizedPath] = {
          size,
          gzippedSize: gzippedSize ?? undefined,
        };
      }
    }

    // Append inline diff to sizeLabel
    let sizeLabel = calcFileSize(size);
    let sizeLabelLength = sizeLabel.length;
    let gzipSizeLabel = gzippedSize ? getAssetColor(gzippedSize)(calcFileSize(gzippedSize)) : null;

    // Calculate size differences for inline display
    if (showDiff) {
      const sizeData = previousSizes[environmentName]?.files[normalizedPath];
      const sizeDiff = size - (sizeData?.size ?? 0);
      if (isSignificantDiff(sizeDiff)) {
        const { label, length } = formatDiff(sizeDiff);
        sizeLabel += ` ${label}`;
        sizeLabelLength += length + 1;
      }

      if (gzippedSize !== null) {
        const gzipDiff = gzippedSize - (sizeData?.gzippedSize ?? 0);
        if (isSignificantDiff(gzipDiff)) {
          gzipSizeLabel += ` ${formatDiff(gzipDiff).label}`;
        }
      }
    }

    const separatorIndex = filePath.lastIndexOf('/');
    const folder =
      separatorIndex === -1
        ? path.join(relativeDistPath, '.')
        : path.join(relativeDistPath, filePath.slice(0, separatorIndex));
    const folderLabel = folder + path.sep;
    const filename = separatorIndex === -1 ? filePath : filePath.slice(separatorIndex + 1);
    const filenameLabel = color.dim(folderLabel) + coloringAssetName(filename);
    const filenameLength = folderLabel.length + filename.length;

    return {
      filePath,
      filenameLabel,
      filenameLength,
      size,
      sizeLabel,
      sizeLabelLength,
      gzippedSize,
      gzipSizeLabel,
    };
  };

  const getAssets = async () => {
    const { exclude, include } = options;
    const formattedAssets: (FormattedAsset | Promise<FormattedAsset>)[] = [];
    const compilationAssets = stats.compilation.assets;

    for (const assetName of Object.keys(compilationAssets)) {
      const value = compilationAssets[assetName];
      const filePath = getFilePath(assetName);

      if (!exclude && EXCLUDE_ASSET_REGEX.test(filePath)) {
        continue;
      }

      const content = options.compressed && isCompressible(filePath) ? value.source() : undefined;
      const size = content === undefined ? value.size() : Buffer.byteLength(content);

      if (exclude || include) {
        const publicAsset: PrintFileSizeAsset = {
          name: filePath,
          size,
        };
        if (exclude?.(publicAsset)) {
          continue;
        }
        if (include) {
          if (!include(publicAsset)) {
            continue;
          }
        }
      }

      if (content === undefined) {
        formattedAssets.push(formatAsset(filePath, size, null));
      } else {
        formattedAssets.push(
          gzipSize(content).then((gzippedSize) => formatAsset(filePath, size, gzippedSize)),
        );
      }
    }

    return (await Promise.all(formattedAssets)).sort((a, b) => a.size - b.size);
  };

  const assets = await getAssets();

  if (assets.length === 0) {
    return { logs };
  }

  logs.push('');

  // No need to print total size if there is only one asset and detail is true
  if (showDetail && assets.length === 1) {
    showTotal = false;
  }

  const { totalSize, totalGzipSize } = calcTotalSize(assets, options.compressed);

  if (snapshot) {
    snapshot.totalSize = totalSize;
    snapshot.totalGzipSize = totalGzipSize;
  }

  const fileHeader = showDetail ? `File (${environmentName})` : '';

  const getTotalSizeLabel = () => {
    if (!showTotal) {
      return {
        totalSizeTitle: '',
        totalSizeLabel: '',
        totalSizeLabelLength: 0,
      };
    }

    const totalSizeTitle = showDetail ? 'Total:' : `Total size (${environmentName}):`;

    let totalSizeLabel = calcFileSize(totalSize);
    let totalSizeLabelLength = totalSizeLabel.length;
    if (showDiff) {
      const totalSizeDiff = totalSize - (previousSizes[environmentName]?.totalSize ?? 0);
      if (isSignificantDiff(totalSizeDiff)) {
        const { label, length } = formatDiff(totalSizeDiff);
        totalSizeLabel += ` ${label}`;
        totalSizeLabelLength += length + 1;
      }
    }

    return { totalSizeTitle, totalSizeLabel, totalSizeLabelLength };
  };

  const { totalSizeTitle, totalSizeLabel, totalSizeLabelLength } = getTotalSizeLabel();

  const getCustomTotal = () => {
    if (typeof options.total === 'function') {
      return options.total({
        environmentName,
        distPath: relativeDistPath,
        assets: assets.map((asset) => ({
          name: asset.filePath,
          size: asset.size,
        })),
        totalSize,
        totalGzipSize,
      });
    }
    return null;
  };

  if (showDetail) {
    let maxFileLength = Math.max(showTotal ? totalSizeTitle.length : 0, fileHeader.length);
    let maxSizeLength = totalSizeLabelLength;
    let hasGzipSize = false;

    for (const asset of assets) {
      if (asset.filenameLength > maxFileLength) {
        maxFileLength = asset.filenameLength;
      }
      if (asset.sizeLabelLength > maxSizeLength) {
        maxSizeLength = asset.sizeLabelLength;
      }
      if (asset.gzippedSize !== null) {
        hasGzipSize = true;
      }
    }

    const showGzipHeader = Boolean(options.compressed && hasGzipSize);

    logs.push(getHeader(maxFileLength, maxSizeLength, fileHeader, showGzipHeader));

    for (const asset of assets) {
      let { sizeLabel, filenameLabel } = asset;
      const { sizeLabelLength, gzipSizeLabel, filenameLength } = asset;

      if (sizeLabelLength < maxSizeLength) {
        const rightPadding = ' '.repeat(maxSizeLength - sizeLabelLength);
        sizeLabel += rightPadding;
      }

      if (filenameLength < maxFileLength) {
        const rightPadding = ' '.repeat(maxFileLength - filenameLength);
        filenameLabel += rightPadding;
      }

      let log = `${filenameLabel}   ${sizeLabel}`;

      if (gzipSizeLabel) {
        log += `   ${gzipSizeLabel}`;
      }

      logs.push(log);
    }

    if (showTotal) {
      logs.push('');

      const customTotal = getCustomTotal();
      if (customTotal) {
        // Custom total display
        logs.push(customTotal);
      } else {
        // Default total display
        let log = '';
        log += ' '.repeat(maxFileLength - totalSizeTitle.length);
        log += color.magenta(totalSizeTitle);
        log += `   ${totalSizeLabel}`;

        if (options.compressed) {
          const colorFn = getAssetColor(totalGzipSize / assets.length);
          log += ' '.repeat(maxSizeLength - totalSizeLabelLength);
          log += `   ${colorFn(calcFileSize(totalGzipSize))}`;

          if (showDiff) {
            const totalGzipSizeDiff =
              totalGzipSize - (previousSizes[environmentName]?.totalGzipSize ?? 0);
            if (isSignificantDiff(totalGzipSizeDiff)) {
              log += ` ${formatDiff(totalGzipSizeDiff).label}`;
            }
          }
        }

        logs.push(log);
      }
    }
  } else if (showTotal) {
    const customTotal = getCustomTotal();
    if (customTotal) {
      // Custom total display
      logs.push(customTotal);
    } else {
      // Default total display
      let log = `${color.magenta(totalSizeTitle)} ${totalSizeLabel}`;

      if (options.compressed) {
        log += color.green(` (${calcFileSize(totalGzipSize)} gzipped)`);
      }

      logs.push(log);
    }
  }

  logs.push('');

  return { logs, snapshot };
}

const normalizeConfig = (config: NormalizedEnvironmentConfig) => {
  const { printFileSize } = config.performance;
  const defaultConfig: PrintFileSizeOptions = {
    total: true,
    detail: true,
    diff: false,
    // print compressed size for the browser targets by default
    compressed: config.output.target !== 'node',
  };

  return printFileSize === true
    ? defaultConfig
    : {
        ...defaultConfig,
        ...printFileSize,
      };
};

export const pluginFileSize = (context: InternalContext): RsbuildPlugin => ({
  name: 'rsbuild:file-size',

  setup(api) {
    api.onAfterBuild(async ({ stats, isFirstCompile }) => {
      const { hasErrors } = context.buildState;
      // No need to print file sizes if there is any compilation error
      if (!stats || hasErrors || !isFirstCompile) {
        return;
      }

      const environments = context.environmentList.filter(
        ({ config }) => config.performance.printFileSize !== false,
      );

      // If no environment has printFileSize enabled, skip
      if (!environments.length) {
        return;
      }

      // Check if any environment has diff enabled
      const showDiff = environments.some((environment) => {
        const { printFileSize } = environment.config.performance;
        return typeof printFileSize === 'object' && Boolean(printFileSize.diff);
      });

      // If `configFilePath` is provided, use it to generate a unique snapshot path
      // to avoid collision when using multiple Rsbuild config files
      const { configFilePath } = api.getNormalizedConfig()._privateMeta || {};
      const snapshotHash = showDiff && configFilePath ? await hash(configFilePath) : '';
      const snapshotPath = showDiff ? getSnapshotPath(api.context.cachePath, snapshotHash) : '';

      // Load previous build sizes for comparison (only if diff is enabled)
      const prevSnapshots = showDiff ? await loadPrevSnapshots(snapshotPath) : null;
      const nextSnapshots: SizeSnapshots = {};

      const logs = await Promise.all(
        environments.map(async ({ name, index, config, distPath }) => {
          const statsItem = 'stats' in stats ? stats.stats[index] : stats;
          const { logs: sizeLogs, snapshot } = await printFileSizes(
            normalizeConfig(config),
            statsItem,
            api.context.rootPath,
            distPath,
            name,
            prevSnapshots,
            showDiff,
          );

          // Store current sizes for this environment
          if (snapshot) {
            nextSnapshots[name] = snapshot;
          }

          return sizeLogs.join('\n');
        }),
      ).catch((err: unknown) => {
        api.logger.warn('Failed to print file size.');
        api.logger.warn(err);
      });

      if (logs) {
        api.logger.log(logs.join(''));
      }

      // Save current sizes for next build comparison (only if diff is enabled)
      if (showDiff) {
        await saveSnapshots(snapshotPath, nextSnapshots, api.logger);
      }
    });
  },
});
