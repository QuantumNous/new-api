declare module 'jscodeshift/dist/testUtils' {
  export function defineTest(
    dirName: string,
    transformName: string,
    options?: any,
    testFilePrefix?: string,
    testOptions?: any,
  ): void;
}
