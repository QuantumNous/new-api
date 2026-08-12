let VChartId = 0;
const VChartIdMax = 9999999;

export function createID(): number {
  VChartId >= VChartIdMax && (VChartId = 0);
  return VChartId++;
}

export function resetID() {
  VChartId = 0;
}
