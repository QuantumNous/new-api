export = getPorts;
/**
 * @param {number} basePort
 * @param {string=} host
 * @return {Promise<number>}
 */
declare function getPorts(
  basePort: number,
  host?: string | undefined
): Promise<number>;
