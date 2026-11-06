import { createClientRpc } from '@tanstack/react-start/client-rpc';
import { createServerFn } from '@tanstack/react-start';
export const withUseServer = createServerFn({
  method: 'GET'
}).handler(createClientRpc("b6fe31e85836ae6c65d8ab262dd1af6a68620aeef609029d50127f4cceaaf320"));