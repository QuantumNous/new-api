export type Datum = {
    [key: string]: any;
};
export type StringOrNumber = string | number;
export type MaybeArray<T> = T | Array<T>;
export type Maybe<T> = T | undefined | null;
export type Quadrant = 1 | 2 | 3 | 4;
export type ValueOf<T, K extends keyof T = keyof T> = T[K];
export type DiffResult<Prev, Next> = {
    enter: {
        next: Next;
    }[];
    update: {
        prev: Prev;
        next: Next;
    }[];
    exit: {
        prev: Prev;
    }[];
};
