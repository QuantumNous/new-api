const serverFunc = () => 'server';
const clientFunc = () => {
  throw new Error("createClientOnlyFn() functions can only be called on the client!");
};