// This file is used by the test case: source-include
export const printLog = () => {
  const arr = [1, 2, 3, 4, [5, 6, [7, 8]]];
  console.log(arr, arr.flat());
};
