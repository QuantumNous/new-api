/**
 * Solve the problem of js addition accuracy
 * e.g.
 *  0.1 + 0.2 => 0.30000000000000004
 *  plus(0.1, 0.2) => 0.3
 * @param {Number} num1
 * @param {Number} num2
 */
export function plus(num1: number, num2: number) {
    const num1Digits = (num1.toString().split('.')[1] || '').length;
    const num2Digits = (num2.toString().split('.')[1] || '').length;
    const baseNum = Math.pow(10, Math.max(num1Digits, num2Digits));
    return (Math.round(num1 * baseNum + num2 * baseNum)) / baseNum;
}

export function minus(num1: number, num2: number) {
    return plus(num1, -num2);
}