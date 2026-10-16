/**
 * tsd expects a value when calling expectType.
 * We're mostly dealing with types though. Therefore,
 * simply export this const and cast it to the expected type.
 * @example
 * ```
 * type Actual = DropLastElement<[0, 1, 2]>;
 * expectType<[0, 1]>(_ as Actual);
 * ```
 */
export declare const _: never;
