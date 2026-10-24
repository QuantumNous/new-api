import type { ISequenceScatterPixelSpec } from './interface';
import { BACKGROUND_KEY, DATA_KEY } from './constant';

// 将RGB三元组数组转换为Canvas可用的imageData
export function createImageDataFromColorMatrix(colorMatrix: any[][], spec: ISequenceScatterPixelSpec): string | null {
  // 浏览器环境检查
  if (typeof document === 'undefined') {
    throw new Error('Canvas rendering requires browser environment with document object'); // 非浏览器环境下返回null
  }

  // 创建Canvas离屏渲染
  const canvas = document.createElement('canvas');
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get 2D rendering context from canvas'); // Canvas context creation failed
  }

  // 创建imageData
  const imageData = ctx.createImageData(spec.width, spec.height);

  // 填充像素数据
  for (let y = 0; y < 300; y++) {
    for (let x = 0; x < 300; x++) {
      const rgb = colorMatrix[y]?.[x] || [0, 0, 0];
      const pixelIndex = (y * 300 + x) * 4;

      // 转换0-1范围到0-255
      imageData.data[pixelIndex] = Math.round(rgb[0] * 255); // R
      imageData.data[pixelIndex + 1] = Math.round(rgb[1] * 255); // G
      imageData.data[pixelIndex + 2] = Math.round(rgb[2] * 255); // B
      imageData.data[pixelIndex + 3] = 255; // A (完全不透明)
    }
  }

  // 将imageData绘制到canvas然后返回dataURL
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

export function processSequenceData(spec: ISequenceScatterPixelSpec) {
  const result: any[] = [];
  Object.keys(spec.data).forEach(inter => {
    let backgroundData = null;
    if (spec.backgroundColors && spec.backgroundColors[inter]) {
      const imageData = createImageDataFromColorMatrix(spec.backgroundColors[inter], spec);
      backgroundData = { imageData };
    }
    result.push({
      data: [
        {
          id: 'nodes',
          values: spec.data[inter].map((d, i) => {
            return { ...d, [DATA_KEY]: i };
          })
        },
        {
          id: 'inter',
          values: [
            {
              inter
            }
          ]
        },
        {
          id: BACKGROUND_KEY,
          values: backgroundData ? [backgroundData] : []
        }
      ]
    });
  });
  return result;
}
