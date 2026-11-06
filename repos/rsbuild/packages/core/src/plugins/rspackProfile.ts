import fs from 'node:fs';
import path from 'node:path';
import { rspack } from '@rspack/core';
import { color } from '../helpers';
import type { RsbuildPlugin } from '../types';

enum TracePreset {
  OVERVIEW = 'OVERVIEW', // contains overview trace events
  ALL = 'ALL', // contains all trace events
}

type TraceLayer = 'perfetto' | 'logger';

const DEFAULT_RUST_TRACE_LOGGER_OUTPUT = 'rspack.log';
const DEFAULT_RUST_TRACE_PERFETTO_OUTPUT = 'rspack.pftrace';

function isTerminalTraceOutput(output: string) {
  return output === 'stdout' || output === 'stderr';
}

function resolveLayer(value: string): string {
  const overviewTraceFilter = 'info';
  const allTraceFilter = 'trace';

  if (value === TracePreset.OVERVIEW) {
    return overviewTraceFilter;
  }
  if (value === TracePreset.ALL) {
    return allTraceFilter;
  }

  return value;
}

async function ensureFileDir(outputFilePath: string) {
  const dir = path.dirname(outputFilePath);
  await fs.promises.mkdir(dir, { recursive: true });
}

/**
 * `RSPACK_PROFILE=ALL` // all trace events
 * `RSPACK_PROFILE=OVERVIEW` // overview trace events
 * `RSPACK_PROFILE=warn,tokio::net=info` // trace filter from  https://docs.rs/tracing-subscriber/latest/tracing_subscriber/filter/struct.EnvFilter.html#example-syntax
 * `RSPACK_TRACE_LAYER=perfetto` // requires the Rspack debug package
 */
async function applyProfile(
  root: string,
  filterValue: string,
  traceLayer: TraceLayer,
  traceOutput?: string,
) {
  if (traceLayer !== 'perfetto' && traceLayer !== 'logger') {
    throw new Error(`unsupported trace layer: ${traceLayer}`);
  }

  if (traceOutput && traceLayer === 'perfetto' && isTerminalTraceOutput(traceOutput)) {
    throw new Error(
      'RSPACK_TRACE_OUTPUT=stdout|stderr is only supported for the logger trace layer. The perfetto trace layer requires a file path.',
    );
  }

  const timestamp = Date.now();
  const defaultOutputDir = path.join(root, `.rspack-profile-${timestamp}-${process.pid}`);

  if (!traceOutput) {
    const defaultRustTraceOutput =
      traceLayer === 'perfetto'
        ? DEFAULT_RUST_TRACE_PERFETTO_OUTPUT
        : DEFAULT_RUST_TRACE_LOGGER_OUTPUT;

    traceOutput = path.resolve(defaultOutputDir, defaultRustTraceOutput);
  } else if (!isTerminalTraceOutput(traceOutput)) {
    traceOutput = path.resolve(defaultOutputDir, traceOutput);
  }

  const filter = resolveLayer(filterValue);

  if (!isTerminalTraceOutput(traceOutput)) {
    await ensureFileDir(traceOutput);
  }

  await rspack.experiments.globalTrace.register(filter, traceLayer, traceOutput);

  return traceOutput;
}

// Referenced from Rspack CLI
// https://github.com/web-infra-dev/rspack/blob/main/packages/rspack-cli/src/utils/profile.ts
export const pluginRspackProfile = (): RsbuildPlugin => ({
  name: 'rsbuild:rspack-profile',

  setup(api) {
    const { RSPACK_PROFILE, RSPACK_TRACE_LAYER = 'logger' } = process.env;
    if (!RSPACK_PROFILE) {
      return;
    }

    let traceOutput: string;

    const onStart = async () => {
      traceOutput = await applyProfile(
        api.context.rootPath,
        RSPACK_PROFILE,
        RSPACK_TRACE_LAYER as TraceLayer,
        process.env.RSPACK_TRACE_OUTPUT,
      );
    };

    api.onBeforeBuild(async ({ isFirstCompile }) => {
      if (isFirstCompile) {
        await onStart();
      }
    });
    api.onBeforeStartDevServer(onStart);

    api.onExit(() => {
      if (!traceOutput) {
        return;
      }

      rspack.experiments.globalTrace.cleanup();

      if (!isTerminalTraceOutput(traceOutput)) {
        const profileMessage = 'profile file saved to';
        api.logger.info(`${profileMessage} ${color.cyan(traceOutput)}`);
      }
    });
  },
});
