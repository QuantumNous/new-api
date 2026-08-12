export interface Page02EventDatum {
  category: string;
  value: number;
}

export interface Page02OriginalData {
  [date: string]: {
    image: string;
    dataList: Page02EventDatum[];
  };
}
