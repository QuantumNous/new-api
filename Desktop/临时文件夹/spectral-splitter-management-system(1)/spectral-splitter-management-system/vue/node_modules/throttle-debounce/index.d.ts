declare module 'throttle-debounce' {
  type throttleFn = (
    delay: number,
    noTrailing: boolean,
    callback?: Function,
    debounceMode?: boolean
  ) => Function;

  type debounceFn = (
    delay: number,
    atBegin: boolean,
    callback?: Function
  ) => Function;

  const throttle: throttleFn;
  const debounce: debounceFn;
}
