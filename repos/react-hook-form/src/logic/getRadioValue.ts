type RadioFieldResult = {
  isValid: boolean;
  value: number | string | null;
};

const defaultReturn: RadioFieldResult = {
  isValid: false,
  value: null,
};

export default (options?: HTMLInputElement[]): RadioFieldResult =>
  Array.isArray(options)
    ? options.reduce(
        (previous, option): RadioFieldResult =>
          option && option.checked && !option.disabled
            ? {
                isValid: true,
                value: option.value,
              }
            : previous,
        defaultReturn,
      )
    : defaultReturn;
