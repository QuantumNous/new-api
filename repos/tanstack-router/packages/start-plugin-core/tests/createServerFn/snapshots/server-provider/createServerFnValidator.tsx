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
}).validator(z.number()).handler(withUseServer_createServerFn_handler, ({
  input
}) => input + 1);
export { withUseServer_createServerFn_handler };