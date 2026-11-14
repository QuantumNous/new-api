declare module 'string.prototype.replaceall' {
  type ReplaceAll = (source: string, sbuStr: RegExp | string, newSubStr: string) => string;

  const replaceAll: ReplaceAll = () => {}

  export default replaceAll
}
