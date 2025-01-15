declare function transformOn(
  obj: Record<string, any>
): Record<`on${string}`, any>;
export default transformOn;
