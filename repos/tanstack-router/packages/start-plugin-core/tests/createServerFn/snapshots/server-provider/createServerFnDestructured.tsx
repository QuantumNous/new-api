import { createServerRpc } from '@tanstack/react-start/server-rpc';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
const withUseServer_createServerFn_handler = createServerRpc({
  id: "b6fe31e85836ae6c65d8ab262dd1af6a68620aeef609029d50127f4cceaaf320",
  name: "withUseServer",
  filename: "src/test.ts"
}, opts => withUseServer.__executeServer(opts));
const withUseServer = createServerFn({
  method: 'GET'
}).handler(withUseServer_createServerFn_handler, async function () {
  console.info('Fetching posts...');
  await new Promise(r => setTimeout(r, 500));
  return axios.get<Array<PostType>>('https://jsonplaceholder.typicode.com/posts').then(r => r.data.slice(0, 10));
});
const withArrowFunction_createServerFn_handler = createServerRpc({
  id: "a311dfd9a6554bc0bb9371ef4fbc72c852d0b5532829a2613a29157b8595a793",
  name: "withArrowFunction",
  filename: "src/test.ts"
}, opts => withArrowFunction.__executeServer(opts));
const withArrowFunction = createServerFn({
  method: 'GET'
}).handler(withArrowFunction_createServerFn_handler, async () => null);
const withArrowFunctionAndFunction_createServerFn_handler = createServerRpc({
  id: "dbe1f77c6ea7590bce3212a75b06d3cee83b425bcf493014cb47462ef725e36e",
  name: "withArrowFunctionAndFunction",
  filename: "src/test.ts"
}, opts => withArrowFunctionAndFunction.__executeServer(opts));
const withArrowFunctionAndFunction = createServerFn({
  method: 'GET'
}).handler(withArrowFunctionAndFunction_createServerFn_handler, async () => test());
const withoutUseServer_createServerFn_handler = createServerRpc({
  id: "c0d9fdeb2b01aafecc782f439416b86f666cb5334ac9a934546b177e5698bbb2",
  name: "withoutUseServer",
  filename: "src/test.ts"
}, opts => withoutUseServer.__executeServer(opts));
const withoutUseServer = createServerFn({
  method: 'GET'
}).handler(withoutUseServer_createServerFn_handler, async () => {
  console.info('Fetching posts...');
  await new Promise(r => setTimeout(r, 500));
  return axios.get<Array<PostType>>('https://jsonplaceholder.typicode.com/posts').then(r => r.data.slice(0, 10));
});
const withVariable_createServerFn_handler = createServerRpc({
  id: "7d36cb30c30bd688b9773bd7f85a0d51d83f868255e127605e4f236615fefe70",
  name: "withVariable",
  filename: "src/test.ts"
}, opts => withVariable.__executeServer(opts));
const withVariable = createServerFn({
  method: 'GET'
}).handler(withVariable_createServerFn_handler, abstractedFunction);
async function abstractedFunction() {
  console.info('Fetching posts...');
  await new Promise(r => setTimeout(r, 500));
  return axios.get<Array<PostType>>('https://jsonplaceholder.typicode.com/posts').then(r => r.data.slice(0, 10));
}
function zodValidator<TSchema extends z.ZodSchema, TResult>(schema: TSchema, fn: (input: z.output<TSchema>) => TResult) {
  return async (input: unknown) => {
    return fn(schema.parse(input));
  };
}
const withZodValidator_createServerFn_handler = createServerRpc({
  id: "43606a369c85444a332f701d6399564b6a3691aabab63dfc9a0b7c341fb798f3",
  name: "withZodValidator",
  filename: "src/test.ts"
}, opts => withZodValidator.__executeServer(opts));
const withZodValidator = createServerFn({
  method: 'GET'
}).handler(withZodValidator_createServerFn_handler, zodValidator(z.number(), input => {
  return {
    'you gave': input
  };
}));
const withValidatorFn_createServerFn_handler = createServerRpc({
  id: "5cf922ac733d835fee496964cbf0b4b4067cb43d51f2efa484d072e6bb7dae44",
  name: "withValidatorFn",
  filename: "src/test.ts"
}, opts => withValidatorFn.__executeServer(opts));
const withValidatorFn = createServerFn({
  method: 'GET'
}).validator(z.number()).handler(withValidatorFn_createServerFn_handler, async ({
  input
}) => {
  return null;
});
export { withUseServer_createServerFn_handler, withArrowFunction_createServerFn_handler, withArrowFunctionAndFunction_createServerFn_handler, withoutUseServer_createServerFn_handler, withVariable_createServerFn_handler, withZodValidator_createServerFn_handler, withValidatorFn_createServerFn_handler };