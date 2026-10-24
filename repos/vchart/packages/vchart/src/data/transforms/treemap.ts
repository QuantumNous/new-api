import { flattenNodes, TreemapLayout, type TreemapNodeElement, type TreemapOptions } from '@visactor/vlayouts';
import { isFunction } from '@visactor/vutils';
import { DEFAULT_HIERARCHY_ROOT } from '../../constant/hierarchy';

interface ITreemapLayoutOptions extends TreemapOptions {
  getViewBox: () => {
    x0: number;
    x1: number;
    y0: number;
    y1: number;
  };
  nameField: string;
}

export const treemapLayout = (
  data: Array<Record<string, unknown>>,
  op: ITreemapLayoutOptions | (() => ITreemapLayoutOptions)
) => {
  const options = isFunction(op) ? op() : op;
  const viewBox = options.getViewBox();

  if (viewBox) {
    const layout = new TreemapLayout(options);
    const res = layout.layout(data, viewBox);

    const nodes: TreemapNodeElement[] = [];
    flattenNodes(res, nodes, { maxDepth: options?.maxDepth });

    nodes.forEach(datum => {
      if (datum) {
        [DEFAULT_HIERARCHY_ROOT, 'name'].forEach(key => {
          (datum as unknown as Record<string, unknown>)[key] = datum.datum[datum.depth][options.nameField];
        });
      }
    });

    return nodes;
  }

  return [];
};
