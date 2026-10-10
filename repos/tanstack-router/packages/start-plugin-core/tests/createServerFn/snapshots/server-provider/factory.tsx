import { createServerRpc } from '@tanstack/react-start/server-rpc';
import { createServerFn, createMiddleware } from '@tanstack/react-start';
const authMiddleware = createMiddleware({
  type: 'function'
}).server(({
  next
}) => {
  return next({
    context: {
      auth: 'auth'
    }
  });
});
const adminMiddleware = createMiddleware({
  type: 'function'
}).server(({
  next
}) => {
  return next({
    context: {
      admin: 'admin'
    }
  });
});
const createAuthServerFn = createServerFn().middleware([authMiddleware]);
const createAdminServerFn = createAuthServerFn().middleware([adminMiddleware]);
const myAuthedFn_createServerFn_handler = createServerRpc({
  id: "3bb88b23926fa224cea3dcfb877026757733d95b42e3b66cf7f06bb89dab06a3",
  name: "myAuthedFn",
  filename: "src/test.ts"
}, opts => myAuthedFn.__executeServer(opts));
const myAuthedFn = createAuthServerFn().handler(myAuthedFn_createServerFn_handler, () => {
  return 'myAuthedFn';
});
const deleteUserFn_createServerFn_handler = createServerRpc({
  id: "44d9483a9412daaacaa5a8aee6b02294333a0e61b5d3b17ba6bcb34fd2bdce31",
  name: "deleteUserFn",
  filename: "src/test.ts"
}, opts => deleteUserFn.__executeServer(opts));
const deleteUserFn = createAdminServerFn().handler(deleteUserFn_createServerFn_handler, () => {
  return 'deleteUserFn';
});
function createFakeFn() {
  return {
    handler: cb => {
      return cb();
    }
  };
}
const x = createFakeFn().handler(() => {
  return 'fakeFn';
});
export { myAuthedFn_createServerFn_handler, deleteUserFn_createServerFn_handler };