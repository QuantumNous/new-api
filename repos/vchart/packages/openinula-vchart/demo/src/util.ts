export const crossCats = (cats: Array<{ values: string[]; key: string }>, output: any[] = []): any[] => {
  const firstCat = cats[0];

  if (firstCat.key && firstCat.values?.length) {
    const len = output.length;

    firstCat.values.forEach((val, catIndex) => {
      if (len) {
        for (let i = 0; i < len; i++) {
          output[catIndex * len + i] = { ...output[i], [firstCat.key]: val };
        }
      } else {
        output[catIndex] = { [firstCat.key]: val };
      }
    });
  }

  if (cats.length > 1) {
    return crossCats(cats.slice(1), output);
  }

  return output;
};

export const generateData = (cats: Array<{ values: string[]; key: string }>, size: number) => {
  const baseData = crossCats(cats);
  let res: any[] = [];

  baseData.forEach(entry => {
    res = res.concat(
      new Array(size).fill(0).map((val, index) => {
        return {
          ...entry,
          y2: 0,
          y: Math.floor(Math.random() * 300) + 600,
          x: index
        };
      })
    );
  });

  return res;
};
