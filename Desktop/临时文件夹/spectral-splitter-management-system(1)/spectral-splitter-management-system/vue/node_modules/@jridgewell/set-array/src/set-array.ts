/**
 * Gets the index associated with `key` in the backing array, if it is already present.
 */
export let get: (strarr: SetArray, key: string) => number | undefined;

/**
 * Puts `key` into the backing array, if it is not already present. Returns
 * the index of the `key` in the backing array.
 */
export let put: (strarr: SetArray, key: string) => number;

/**
 * Pops the last added item out of the SetArray.
 */
export let pop: (strarr: SetArray) => void;

/**
 * SetArray acts like a `Set` (allowing only one occurrence of a string `key`), but provides the
 * index of the `key` in the backing array.
 *
 * This is designed to allow synchronizing a second array with the contents of the backing array,
 * like how in a sourcemap `sourcesContent[i]` is the source content associated with `source[i]`,
 * and there are never duplicates.
 */
export class SetArray {
  private declare _indexes: { [key: string]: number | undefined };
  declare array: readonly string[];

  constructor() {
    this._indexes = { __proto__: null } as any;
    this.array = [];
  }

  static {
    get = (strarr, key) => strarr._indexes[key];

    put = (strarr, key) => {
      // The key may or may not be present. If it is present, it's a number.
      const index = get(strarr, key);
      if (index !== undefined) return index;

      const { array, _indexes: indexes } = strarr;

      return (indexes[key] = (array as string[]).push(key) - 1);
    };

    pop = (strarr) => {
      const { array, _indexes: indexes } = strarr;
      if (array.length === 0) return;

      const last = (array as string[]).pop()!;
      indexes[last] = undefined;
    };
  }
}
