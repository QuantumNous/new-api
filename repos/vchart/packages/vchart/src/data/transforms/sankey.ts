import { SankeyLayout, type SankeyOptions, type SankeyData } from '@visactor/vlayouts';
import { isArray, isFunction, isNil } from '@visactor/vutils';

export interface ISankeyOpt extends SankeyOptions {
  targetField: string;
  sourceField: string;
  valueField: string;
  view: () => { x0: number; x1: number; y0: number; y1: number };
}

type SankeyLayoutOption = ISankeyOpt | (() => ISankeyOpt);
type SankeyFormatDatum = Record<string, unknown> & {
  id?: 'links' | 'nodes';
  values?: unknown;
  latestData?: SankeyData[];
  children?: SankeyFormatDatum[];
};

export const collectHierarchyField = <T>(set: Set<T>, data: SankeyFormatDatum[], field: string) => {
  data.forEach(obj => {
    if (!isNil(obj[field])) {
      set.add(obj[field] as T);
    }

    if (obj.children && obj.children.length > 0) {
      collectHierarchyField(set, obj.children, field); // 递归处理子节点
    }
  });
};

export const sankeyFormat = (data: SankeyFormatDatum[]): SankeyData[] => {
  if (!data || !isArray(data)) {
    return [] as SankeyData[];
  }

  if (data.length > 1) {
    /**
     * data structure for Fengshen:
     * [{id:’nodes’, values:[xxx]},{id:’links’, values:[xxx]}]
     */
    const updateData: SankeyData = {
      links: [],
      nodes: []
    };
    data.forEach(datum => {
      if (datum.id === 'links' || datum.id === 'nodes') {
        (updateData as Record<string, unknown>)[datum.id] = datum.values;
      }
    });
    return [updateData];
  }
  /**
   * data structure:
   * [{nodes: [xxx], links: [xxx]}]
   */
  if (data[0]?.latestData) {
    return data[0].latestData;
  }
  return data as unknown as SankeyData[];
};

export const sankeyLayout = (data: SankeyData[], op: SankeyLayoutOption) => {
  const options = isFunction(op) ? op() : op;
  if (!data || !options?.view || !data.length) {
    return [];
  }

  const view = options.view();

  if (
    view.x1 - view.x0 === 0 ||
    view.y1 - view.y0 === 0 ||
    view.x1 - view.x0 === -Infinity ||
    view.x1 - view.x0 === Infinity ||
    view.y1 - view.y0 === -Infinity ||
    view.y1 - view.y0 === Infinity
  ) {
    return [];
  }

  const originalData = data[0];
  const layoutData = normalizeSankeyData(originalData, options);

  const layout = new SankeyLayout(options);

  const result = [];

  result.push(layout.layout(layoutData, view));

  return result;
};

const normalizeSankeyData = (data: SankeyData, options: ISankeyOpt): SankeyData => {
  if (
    options.sourceField === 'source' &&
    options.targetField === 'target' &&
    options.valueField === 'value'
  ) {
    return data;
  }

  const links = (data as { links?: Array<Record<string, unknown>> }).links;
  if (!links) {
    return data;
  }

  return {
    ...data,
    links: links.map(link => {
      const updatedLink: Record<string, unknown> = {};
      Object.keys(link).forEach(key => {
        if (key === options.sourceField) {
          updatedLink.source = link[options.sourceField];
        } else if (key === options.targetField) {
          updatedLink.target = link[options.targetField];
        } else if (key === options.valueField) {
          updatedLink.value = link[options.valueField];
        } else {
          updatedLink[key] = link[key];
        }
      });
      return updatedLink;
    })
  } as unknown as SankeyData;
};
