import { getCombinedSizeOfRegions, type IAxis } from '@visactor/vchart';

export const getUpdateAttributeOfZAxis = (axis: IAxis, ignoreGrid: boolean) => {
  const regionSize = getCombinedSizeOfRegions(axis.getRegions());
  const { width } = axis.getLayoutRect();
  const axisLength = width;
  const depth = (axis as any).layout3dBox ? (axis as any).layout3dBox.length : 0;
  const depthZ = (axis as any).layout3dBox ? (axis as any).layout3dBox.width : 0;
  const end = { x: depth, y: 0 };

  const items = (axis as any).getLabelItems(axisLength);
  const attrs: any = {
    start: { x: 0, y: 0 },
    end,
    title: {
      text: (axis as any)._spec.title.text || (axis as any)._dataFieldText,
      maxWidth: (axis as any)._getTitleLimit(false)
    },
    items,
    scale: (axis as any)._scale.clone()
  };

  const directionStr = (axis as any).directionStr ?? 'r2l';
  let anchor3d = [0, 0];
  let alpha = -Math.PI / 2;
  let z = 0;
  if (directionStr === 'l2r') {
    z = (axis as any).layout3dBox.length;
    anchor3d = [0, 0, 0];
    alpha = Math.PI / 2;
  }
  attrs.z = z;
  attrs.alpha = alpha;
  attrs.anchor3d = anchor3d;

  if (!ignoreGrid) {
    attrs.grid = {
      type: 'line',
      start: { x: 0, y: 0 },
      end,
      items: items[0],
      verticalFactor: (axis as any)._axisStyle.verticalFactor,
      depth: depthZ,
      length: !ignoreGrid ? regionSize.height : 0,
      alpha,
      z,
      anchor3d
    };
  }
  return attrs;
};
