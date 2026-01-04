/**
 * sleep for some mileseconds to do something
 *
 * @param {number} ms
 * @return {Promise<any>}
 */
const sleep = ms => new Promise((resolve, reject) => setTimeout(resolve, ms));

export default sleep;
