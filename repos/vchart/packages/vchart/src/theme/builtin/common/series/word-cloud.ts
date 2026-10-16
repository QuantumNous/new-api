import type { IWordCloudSeriesTheme } from '../../../../series/word-cloud/interface';

const getWordCloudTheme = (): IWordCloudSeriesTheme => {
  return {
    word: {
      padding: 1,
      style: {
        textAlign: 'center',
        textBaseline: 'alphabetic'
      }
    }
  };
};

export const wordCloud: IWordCloudSeriesTheme = getWordCloudTheme();
