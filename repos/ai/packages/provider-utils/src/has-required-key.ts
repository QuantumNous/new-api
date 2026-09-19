/**
 * Checks if an object has required keys.
 * @param OBJECT - The object to check.
 * @returns True if the object has required keys, false otherwise.
 */
export type HasRequiredKey<OBJECT> = {} extends OBJECT ? false : true;
