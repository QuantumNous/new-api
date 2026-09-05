import { createSsrRpc } from '@tanstack/react-start/ssr-rpc';
import * as TanStackStart from '@tanstack/react-start';
export const withUseServer = TanStackStart.createServerFn({
  method: 'GET'
}).handler(createSsrRpc("b6fe31e85836ae6c65d8ab262dd1af6a68620aeef609029d50127f4cceaaf320"));
export const withoutUseServer = TanStackStart.createServerFn({
  method: 'GET'
}).handler(createSsrRpc("c0d9fdeb2b01aafecc782f439416b86f666cb5334ac9a934546b177e5698bbb2"));
export const withVariable = TanStackStart.createServerFn({
  method: 'GET'
}).handler(createSsrRpc("7d36cb30c30bd688b9773bd7f85a0d51d83f868255e127605e4f236615fefe70"));
export const withZodValidator = TanStackStart.createServerFn({
  method: 'GET'
}).handler(createSsrRpc("43606a369c85444a332f701d6399564b6a3691aabab63dfc9a0b7c341fb798f3"));