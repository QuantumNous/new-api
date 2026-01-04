/**
 * @file
 *
 * react-motion/src/stepper.js
 */

// stepper is used a lot. Saves allocation to return the same array wrapper.
// This is fine and danger-free against mutations because the callsite
// immediately destructures it and gets the numbers inside without passing the
// array reference around.
const reusedTuple = [0, 0];

/**
 *
 * @param {number} secondPerFrame
 * @param {number} x
 * @param {number} v
 * @param {number} destX
 * @param {number} k
 * @param {number} b
 * @param {number} precision
 */
export default function stepper(secondPerFrame: number, x: number, v: number, destX: number, k: number, b: number, precision: number) {
    // Spring stiffness, in kg / s^2

    // for animations, destX is really spring length (spring at rest). initial
    // position is considered as the stretched/compressed position of a spring
    const Fspring = -k * (x - destX);

    // Damping, in kg / s
    const Fdamper = -b * v;

    // usually we put mass here, but for animation purposes, specifying mass is a
    // bit redundant. you could simply adjust k and b accordingly
    // let a = (Fspring + Fdamper) / mass;
    const a = Fspring + Fdamper;

    const newV = v + a * secondPerFrame;
    const newX = x + newV * secondPerFrame;

    if (Math.abs(newV) < precision && Math.abs(newX - destX) < precision) {
        reusedTuple[0] = destX;
        reusedTuple[1] = 0;
        return reusedTuple;
    }

    reusedTuple[0] = newX;
    reusedTuple[1] = newV;
    return reusedTuple;
}
