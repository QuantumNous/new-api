export const fn = () => {
  throw new Error("createServerOnlyFn() functions can only be called on the server!");
};
export const wrappedFn = (() => {
  throw new Error("createServerOnlyFn() functions can only be called on the server!");
}) as () => string;