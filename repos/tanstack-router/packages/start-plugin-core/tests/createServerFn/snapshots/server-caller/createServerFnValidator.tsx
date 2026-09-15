import { createSsrRpc } from '@tanstack/react-start/ssr-rpc';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
export const withUseServer = createServerFn({
  method: 'GET'
}).validator(z.number()).handler(createSsrRpc("b6fe31e85836ae6c65d8ab262dd1af6a68620aeef609029d50127f4cceaaf320"));