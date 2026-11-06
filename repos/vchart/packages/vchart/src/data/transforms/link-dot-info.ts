import type { Datum } from '../../typings';

export interface ILinkDotInfoOpt {
  infoKey: string;
  fields: () => {
    fromField: string;
    toField: string;
    xField: string | string[];
    yField: string | string[];
  };
  linkData: () => Datum[];
  dotData: () => Datum[];
}

/**
 * @description 根据link数据以及对应的dot数据生成node name和node data的哈希表，并将node data的信息放进来
 */
export const linkDotInfo = (data: Array<DataView>, op: ILinkDotInfoOpt) => {
  const { infoKey, fields, linkData, dotData } = op;
  const { fromField, toField, xField, yField } = fields();
  const dataLinkObj = linkData();
  const dataDotObj = dotData();
  const dataLinkDotHash = {};

  // 遍历dot数据，生成哈希表
  dataDotObj.forEach((datum: any) => {
    const dataCopy: any = {};
    for (const key in datum) {
      if (key !== infoKey) {
        dataCopy[key] = datum[key];
      }
    }
    const dataOp = datum[infoKey];
    dataOp?.forEach((d: any) => {
      dataLinkDotHash[d.node_name] = Object.assign({}, dataCopy, d);
    });
  });

  // 将起始点的node data加入进来
  dataLinkObj.forEach((datum: any) => {
    datum[fromField + '_xField'] = dataLinkDotHash?.[datum[fromField]]?.[xField];
    datum[fromField + '_yField'] = dataLinkDotHash?.[datum[fromField]]?.[yField];
    datum[toField + '_xField'] = dataLinkDotHash?.[datum[toField]]?.[xField];
    datum[toField + '_yField'] = dataLinkDotHash?.[datum[toField]]?.[yField];
  });
  return dataLinkObj;
};
