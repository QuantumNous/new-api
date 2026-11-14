import { registerDataSetInstanceParser, warn } from '@visactor/vchart';
import { DataSet, DataView, svgParser, type SVGParserResult } from '@visactor/vchart';

export const svgSourceMap = new Map<string, DataView>();
export const SVG_VIEWPORT_RECT_KEY = '_vchartViewportRect' as const;

export interface SVGViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SVGParserResultWithViewport extends SVGParserResult {
  [SVG_VIEWPORT_RECT_KEY]?: SVGViewportRect;
}

let svgDataSet: DataSet | null;

const numberReg = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

function initSVGDataSet() {
  if (svgDataSet) {
    return;
  }
  svgDataSet = new DataSet();
  registerDataSetInstanceParser(svgDataSet, 'svg', svgParser);
}

function parseEnableBackgroundViewport(source: string): SVGViewportRect | null {
  const svgStartTag = source.match(/<svg\b[\s\S]*?>/i)?.[0];
  const enableBackground = svgStartTag?.match(/\benable-background\s*=\s*(['"])(.*?)\1/i)?.[2];

  if (!enableBackground || !/^\s*new\b/i.test(enableBackground)) {
    return null;
  }

  const values = enableBackground.match(numberReg)?.map(Number) ?? [];
  const [x, y, width, height] = values;

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return { x, y, width, height };
}

function hasValidSize(parsedSvg: SVGParserResultWithViewport) {
  return (
    Number.isFinite(parsedSvg.width) && Number.isFinite(parsedSvg.height) && parsedSvg.width > 0 && parsedSvg.height > 0
  );
}

export function registerSVGSource(key: string, source: string) {
  if (svgSourceMap.has(key)) {
    warn(`svg source key of '${key}' already exists, will be overwritten.`);
  }
  initSVGDataSet();
  const dataView = new DataView(svgDataSet!);
  dataView.parse(source, {
    type: 'svg'
  });
  const parsedSvg = dataView.latestData as SVGParserResultWithViewport;
  const viewportRect = parseEnableBackgroundViewport(source);

  if (parsedSvg && viewportRect && !parsedSvg.viewBoxRect && !hasValidSize(parsedSvg)) {
    parsedSvg[SVG_VIEWPORT_RECT_KEY] = viewportRect;
  }

  svgSourceMap.set(key, dataView);
}

export function unregisterSVGSource(key: string) {
  if (!svgSourceMap.has(key)) {
    warn(`map type of '${key}' does not exists.`);
    return;
  }
  svgSourceMap.delete(key);
}

export function getSVGSource(type: string) {
  return svgSourceMap.get(type);
}

export function clearSVGSource() {
  svgSourceMap.clear();
  svgDataSet = null;
}
