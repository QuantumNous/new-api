export function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && process.release?.name === 'node';
}
