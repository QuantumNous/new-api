/**
 * Gets the index associated with `key` in the backing array, if it is already present.
 */
export declare let get: (strarr: SetArray, key: string) => number | undefined;
/**
 * Puts `key` into the backing array, if it is not already present. Returns
 * the index of the `key` in the backing array.
 */
export declare let put: (strarr: SetArray, key: string) => number;
/**
 * Pops the last added item out of the SetArray.
 */
export declare let pop: (strarr: SetArray) => void;
/**
 * SetArray acts like a `Set` (allowing only one occurrence of a string `key`), but provides the
 * index of the `key` in the backing array.
 *
 * This is designed to allow synchronizing a second array with the contents of the backing array,
 * like how in a sourcemap `sourcesContent[i]` is the source content associated with `source[i]`,
 * and there are never duplicates.
 */
export declare class SetArray {
    private _indexes;
    array: readonly string[];
    constructor();
}
