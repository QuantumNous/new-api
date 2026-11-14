import type { DataView } from '@visactor/vdataset';
import { isArray, isFunction, isValid } from '@visactor/vutils';
import { BOX_PLOT_OUTLIER_VALUE_FIELD } from '../../constant/box-plot';

export interface IBoxPlotOutlierOpt {
  dimensionField: string[];
  outliersField: string;
  seriesField?: string;
}

type BoxPlotOutlierOption = IBoxPlotOutlierOpt | (() => IBoxPlotOutlierOpt);
/**
 * 将箱型图outlier数组展平
 * @param data
 * @param options
 * @returns
 */
export const foldOutlierData = (data: Array<DataView>, op: BoxPlotOutlierOption) => {
  const result: Array<Record<string, unknown>> = [];
  const options = isFunction(op) ? op() : op;
  const { outliersField, dimensionField, seriesField } = options;
  const latestData = (data[0] as unknown as { latestData?: Array<Record<string, unknown>> }).latestData || [];

  latestData.forEach(d => {
    const rawOutlierValues = d[outliersField];
    const outlierValues = isArray(rawOutlierValues) ? rawOutlierValues : [rawOutlierValues];
    result.push(
      ...outlierValues.map((v: unknown) => {
        const resData: Record<string, unknown> = {
          [BOX_PLOT_OUTLIER_VALUE_FIELD]: v
        };
        dimensionField.forEach(field => {
          resData[field] = d[field];
        });

        if (isValid(seriesField)) {
          resData[seriesField] = d[seriesField];
        }

        return resData;
      })
    );
  });
  return result;
};
