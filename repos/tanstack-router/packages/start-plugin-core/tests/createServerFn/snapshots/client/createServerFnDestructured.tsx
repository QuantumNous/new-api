import { createClientRpc } from '@tanstack/react-start/client-rpc';
import { createServerFn } from '@tanstack/react-start';
export const withUseServer = createServerFn({
  method: 'GET'
}).handler(createClientRpc("b6fe31e85836ae6c65d8ab262dd1af6a68620aeef609029d50127f4cceaaf320"));
export const withArrowFunction = createServerFn({
  method: 'GET'
}).handler(createClientRpc("a311dfd9a6554bc0bb9371ef4fbc72c852d0b5532829a2613a29157b8595a793"));
export const withArrowFunctionAndFunction = createServerFn({
  method: 'GET'
}).handler(createClientRpc("dbe1f77c6ea7590bce3212a75b06d3cee83b425bcf493014cb47462ef725e36e"));
export const withoutUseServer = createServerFn({
  method: 'GET'
}).handler(createClientRpc("c0d9fdeb2b01aafecc782f439416b86f666cb5334ac9a934546b177e5698bbb2"));
export const withVariable = createServerFn({
  method: 'GET'
}).handler(createClientRpc("7d36cb30c30bd688b9773bd7f85a0d51d83f868255e127605e4f236615fefe70"));
export const withZodValidator = createServerFn({
  method: 'GET'
}).handler(createClientRpc("43606a369c85444a332f701d6399564b6a3691aabab63dfc9a0b7c341fb798f3"));
export const withValidatorFn = createServerFn({
  method: 'GET'
}).handler(createClientRpc("5cf922ac733d835fee496964cbf0b4b4067cb43d51f2efa484d072e6bb7dae44"));