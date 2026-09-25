export interface Page01YearDatum {
  year: number;
  image: string;
  progress: number;
  dataList: {
    name: string;
    value: string | string[];
  }[];
}

export interface Page01OriginalData {
  boy: Page01YearDatum[];
  girl: Page01YearDatum[];
}

export interface Page01YearMap {
  [year: number]: Page01YearData;
}

export interface Page01YearData {
  year: number;
  boy?: Page01YearDatum;
  girl?: Page01YearDatum;
}
