export default <T>(data: T[], indexA: number, indexB: number): void => {
  [data[indexA], data[indexB]] = [data[indexB], data[indexA]];
};
