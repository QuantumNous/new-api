import path from 'node:path';
import type { InvalidOriginalMapping, OriginalMapping, TraceMap } from '@jridgewell/trace-mapping';
import type { StackFrame } from 'stacktrace-parser';
import { SCRIPT_REGEX } from '../constants';
import { color, isRspackRuntimeModule } from '../helpers';
import { readFileAsync } from '../helpers/fs';
import { isVerbose } from '../logger';
import type { BrowserLogsStackTrace, InternalContext, Rspack } from '../types';
import { getFileFromUrl } from './assets-middleware/getFileFromUrl';

/**
 * Determines whether a given string is a valid method name
 * extracted from a browser error stack trace.
 * Excludes file paths such as "./src/App.tsx"
 */
const isValidMethodName = (methodName: string) => {
  return methodName !== '<unknown>' && !/[\\/]/.test(methodName);
};

const isRspackRuntimeStack = (value?: string): boolean => {
  if (!value) {
    return false;
  }

  return value.includes('__webpack_require__') || isRspackRuntimeModule(value);
};

export type CachedTraceMap = Map<string, TraceMap>;

/**
 * Returns the first stack frame that looks like user code
 */
const findFirstUserFrame = (parsed: StackFrame[]) => {
  return parsed.find(
    (frame) =>
      frame.file !== null &&
      frame.column !== null &&
      frame.lineNumber !== null &&
      SCRIPT_REGEX.test(frame.file),
  ) as (StackFrame & Pick<Required<StackFrame>, 'file' | 'column' | 'lineNumber'>) | undefined;
};

/**
 * Parse a single stack frame to get original position from source map
 */
const parseFrame = async (
  frame: Pick<StackFrame, 'file' | 'column' | 'lineNumber'>,
  fs: Rspack.OutputFileSystem,
  context: InternalContext,
  cachedTraceMap: CachedTraceMap,
) => {
  const { file, column, lineNumber } = frame;
  const sourceMapInfo = await getFileFromUrl(`${file}.map`, fs, context);

  if (!sourceMapInfo || 'errorCode' in sourceMapInfo) {
    return;
  }

  const { TraceMap, originalPositionFor } = await import(
    /* rspackChunkName: "trace-mapping" */
    '@jridgewell/trace-mapping'
  );

  const sourceMapPath = sourceMapInfo.filename;
  const needle = {
    line: lineNumber ?? 0,
    column: column ?? 0,
  };

  try {
    let tracer = cachedTraceMap.get(sourceMapPath);

    if (!tracer) {
      const sourceMap = await readFileAsync(fs, sourceMapPath);
      tracer = new TraceMap(sourceMap.toString());
      cachedTraceMap.set(sourceMapPath, tracer);
    }

    const originalPosition = originalPositionFor(tracer, needle);
    return { sourceMapPath, originalPosition };
  } catch (error) {
    if (error instanceof Error) {
      context.logger.debug(`failed to map source map position: ${error.message}`);
    }
  }
};

/**
 * Resolve source filename and original position from runtime stack trace,
 * return formatted string like `src/App.tsx:10:20`
 */
const resolveOriginalLocation = async (
  stackFrames: StackFrame[],
  fs: Rspack.OutputFileSystem,
  context: InternalContext,
  cachedTraceMap: CachedTraceMap,
) => {
  // only parse JS files
  const frame = findFirstUserFrame(stackFrames);
  if (!frame) {
    return;
  }

  const parsedFrame = await parseFrame(frame, fs, context, cachedTraceMap);
  if (!parsedFrame) {
    return;
  }

  const { sourceMapPath, originalPosition } = parsedFrame;
  return {
    frame,
    location: formatOriginalLocation(sourceMapPath, originalPosition, context),
  };
};

/**
 * Resolve a source path to a project-root-relative path.
 * By default, the source path is relative to the source map path or is absolute.
 */
const resolveSourceRelativeToRoot = (
  source: string,
  sourceMapPath: string,
  context: InternalContext,
) => {
  // For Rspack runtime modules, return as is
  if (isRspackRuntimeModule(source)) {
    return source;
  }

  const absoluteSourcePath = path.isAbsolute(source)
    ? source
    : path.join(path.dirname(sourceMapPath), source);
  return path.relative(context.rootPath, absoluteSourcePath);
};

const formatOriginalLocation = (
  sourceMapPath: string,
  originalMapping: OriginalMapping | InvalidOriginalMapping,
  context: InternalContext,
) => {
  const { source, line, column } = originalMapping;
  if (!source) {
    return;
  }

  let result = resolveSourceRelativeToRoot(source, sourceMapPath, context);
  if (line !== null) {
    result += column === null ? `:${line}` : `:${line}:${column}`;
  }
  return result;
};

const formatFrameLocation = (frame: StackFrame) => {
  const { file, lineNumber, column } = frame;
  if (!file) {
    return;
  }
  if (lineNumber !== null) {
    return column !== null ? `${file}:${lineNumber}:${column}` : `${file}:${lineNumber}`;
  }
  return file;
};

const enhanceErrorLogWithHints = (log: string) => {
  const isProcessUndefined = log.includes('ReferenceError: process is not defined');
  if (isProcessUndefined) {
    return `${log}\n${color.yellow(`        - \`process\` is a Node.js global and not available in browsers.
        - To access \`process.env.*\`, define them in a \`.env\` file with the \`PUBLIC_\` prefix.
        - Or configure them via \`source.define\`.
        - Alternatively, install \`@rsbuild/plugin-node-polyfill\` to polyfill Node.js globals.`)}`;
  }

  return log;
};

const formatFullStack = async (
  stackFrames: StackFrame[],
  context: InternalContext,
  fs: Rspack.OutputFileSystem,
  cachedTraceMap: CachedTraceMap,
) => {
  const formattedFrames: {
    text: string;
    isRspackRuntime: boolean;
    hasLocation: boolean;
  }[] = [];

  for (const frame of stackFrames) {
    const parsedFrame = await parseFrame(frame, fs, context, cachedTraceMap);
    const { methodName } = frame;
    const parts: string[] = [];

    if (isValidMethodName(methodName)) {
      parts.push(methodName);
    }

    let location: string | undefined;
    let parsed = false;
    if (parsedFrame) {
      const { sourceMapPath, originalPosition } = parsedFrame;
      const originalLocation = formatOriginalLocation(sourceMapPath, originalPosition, context);
      if (originalLocation) {
        location = originalLocation;
        parts.push(originalLocation);
        parsed = true;
      }
    }

    // Fallback to original frame location if source map parsing failed
    // These frames are usually low-signal for users, so only show them in verbose mode.
    if (!parsed && isVerbose(context.logger)) {
      const frameString = formatFrameLocation(frame);
      if (frameString) {
        location = frameString;
        parts.push(frameString);
      }
    }

    const [first, second] = parts;
    if (first) {
      const isRspackRuntime = isRspackRuntimeStack(methodName) || isRspackRuntimeStack(location);
      formattedFrames.push({
        text: second ? `\n    at ${first} (${second})` : `\n    at ${first}`,
        isRspackRuntime,
        hasLocation: location !== undefined,
      });
    }
  }

  // Hide Rspack runtime frames only when other useful stack frames with locations exist.
  const shouldFilterRspackRuntime = formattedFrames.some(
    (frame) => !frame.isRspackRuntime && frame.hasLocation,
  );

  return formattedFrames
    .filter((frame) => !(shouldFilterRspackRuntime && frame.isRspackRuntime))
    .map((frame) => frame.text)
    .join('');
};

/**
 * Formats error messages received from the browser into a log string with
 * source location information.
 */
export const formatBrowserErrorLog = async (
  message: string,
  context: InternalContext,
  fs: Rspack.OutputFileSystem,
  stackTrace: BrowserLogsStackTrace,
  stackFrames: StackFrame[] | null,
  cachedTraceMap: CachedTraceMap,
): Promise<string> => {
  let log = color.red(message);

  if (stackFrames?.length) {
    switch (stackTrace) {
      case 'summary': {
        const resolved = await resolveOriginalLocation(stackFrames, fs, context, cachedTraceMap);

        if (!resolved) {
          break;
        }

        const { frame, location } = resolved;
        const { methodName } = frame;

        let suffix = '';

        if (isValidMethodName(methodName)) {
          suffix += ` at ${methodName}`;
        }
        if (location) {
          suffix += ` (${location})`;
        }
        log += suffix ? color.dim(suffix) : '';
        break;
      }
      case 'full': {
        const fullStack = await formatFullStack(stackFrames, context, fs, cachedTraceMap);
        if (fullStack) {
          log += fullStack;
        }
        break;
      }
      case 'none':
        break;
      // no default
    }
  }

  return enhanceErrorLogWithHints(log);
};
