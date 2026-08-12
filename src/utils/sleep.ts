export default (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
