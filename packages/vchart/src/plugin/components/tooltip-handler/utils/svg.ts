import { escapeHTML } from './common';
// eslint-disable-next-line no-duplicate-imports
import type { CustomSymbolClass, IColor, IGradientColor, ILinearGradient } from '@visactor/vrender-core';
import { Symbol, GradientParser } from '@visactor/vrender-core';
import { Bounds, isObject, isString } from '@visactor/vutils';
import type { ITooltipShapeActual } from '../../../../typings';

export function getSvgHtml(option: ITooltipShapeActual | undefined, gradientId?: string) {
  if (!option || !option.hasShape || !option.shapeType) {
    return '';
  }

  const styleString = `style="display:inline-block;vertical-align:middle;"`;
  const { shapeType, shapeStroke, shapeHollow = false, shapeFill } = option;
  const size = option.shapeSize ?? 8;
  const lineWidth = option.shapeLineWidth ? escapeHTML(option.shapeLineWidth) + 'px' : '0px';
  let fillString: string = 'currentColor';
  const getStroke = () => (shapeStroke ? escapeHTML(shapeStroke) : fillString);

  const sizeNumber = size;
  const createSymbol = (symbolType: string) => new Symbol({ symbolType, size: sizeNumber, fill: true });

  let symbol = createSymbol(shapeType);
  const parsedPath = symbol.getParsedPath();
  if (!parsedPath.path && parsedPath.pathStr) {
    symbol = createSymbol(parsedPath.pathStr);
  }

  let bounds;
  let path;
  if (symbol.getParsedPath().path) {
    const pathModel = symbol.getParsedPath().path;

    path = pathModel.toString();
    bounds = pathModel.bounds;
  } else if (parsedPath.isSvg && (parsedPath as unknown as CustomSymbolClass).svgCache) {
    path = (parsedPath as unknown as CustomSymbolClass).svgCache.map(s => s.path.toString()).join();
    bounds = (parsedPath as unknown as CustomSymbolClass).svgCache.reduce(
      (acc, cur) => acc.union(cur.path.bounds),
      new Bounds()
    );
  }
  let viewBox = `${bounds.x1} ${bounds.y1} ${bounds.width()} ${bounds.height()}`;

  // svg 不支持内描边，需要手动将描边空间预留在 viewBox 上
  if (lineWidth !== '0px') {
    const [x, y, w, h] = viewBox.split(' ').map(n => Number(n));
    const lw = Number(lineWidth.slice(0, -2));
    viewBox = `${x - lw / 2} ${y - lw / 2} ${w + lw} ${h + lw}`;
  }

  const isFillGradientStr = GradientParser.IsGradientStr(shapeFill);

  if (!shapeFill || (isString(shapeFill) && !isFillGradientStr) || shapeHollow) {
    fillString = shapeHollow ? 'none' : shapeFill ? escapeHTML(shapeFill) : 'currentColor';
    return `
    <svg ${styleString} width="${size}" height="${size}" viewBox="${viewBox}">
      <path
        d="${path}"
        style="fill: ${fillString}; stroke: ${getStroke()}; stroke-width: ${lineWidth}"
      >
      </path>
    </svg>`;
  }

  const shapeFillObject = isFillGradientStr ? GradientParser.Parse(shapeFill) : isObject(shapeFill) ? shapeFill : null;

  if (shapeFillObject) {
    fillString = 'gradientColor' + (gradientId ?? '');
    let gradient = '';
    const stops = ((shapeFillObject as IGradientColor).stops ?? [])
      .map(s => `<stop offset="${escapeHTML(s.offset.toString())}" stop-color="${escapeHTML(s.color)}"/>`)
      .join('');
    if ((shapeFillObject as IGradientColor).gradient === 'radial') {
      gradient = `<radialGradient id="${fillString}" cx="50%" cy="50%" r="50%" fx="0%" fy="0%">
      ${stops}
      </radialGradient>`;
    } else if ((shapeFillObject as IGradientColor).gradient === 'linear') {
      gradient = `<linearGradient id="${fillString}" x1="${
        (((shapeFillObject as ILinearGradient).x0 as number) ?? 0) * 100
      }%" y1="${(((shapeFillObject as ILinearGradient).y0 as number) ?? 0) * 100}%" x2="${
        (((shapeFillObject as ILinearGradient).x1 as number) ?? 0) * 100
      }%" y2="${(((shapeFillObject as ILinearGradient).y1 as number) ?? 0) * 100}%">
      ${stops}
      </linearGradient>`;
    }
    return `
    <svg ${styleString} width="${size}" height="${size}" viewBox="-0.5 -0.5 1 1">
      ${gradient}
      <path
        d="${path}"
        style="fill: url(#${fillString}); stroke: ${getStroke()}; stroke-width: ${lineWidth}"
      >
      </path>
    </svg>`;
  }

  return '';
}
