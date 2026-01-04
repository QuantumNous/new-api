/**
 * Determine whether both values are NaN
 * @param {*} a
 * @param {*} b
 * @returns {Boolean}
 */
const isBothNaN = (a: any, b: any) => {
    const { isNaN } = Number;
    return isNaN(a) && isNaN(b);
};

export default isBothNaN;