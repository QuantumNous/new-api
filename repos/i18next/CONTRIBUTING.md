# Developer's Certificate of Origin

By making a contribution to this project, I certify that:

- (a) The contribution was created in whole or in part by me and I have the
  right to submit it under the open source license indicated in the file; or

- (b) The contribution is based upon previous work that, to the best of my
  knowledge, is covered under an appropriate open source license and I have the
  right under that license to submit that work with modifications, whether
  created in whole or in part by me, under the same open source license (unless
  I am permitted to submit under a different license), as indicated in the file;
  or

- (c) The contribution was provided directly to me by some other person who
  certified (a), (b) or (c) and I have not modified it.

- (d) I understand and agree that this project and the contribution are public
  and that a record of the contribution (including all personal information I
  submit with it, including my sign-off) is maintained indefinitely and may be
  redistributed consistent with this project or the open source license(s)
  involved.

## Testing

### Local tests

The test files within `test/local` are not meant to be executed on ci/cd envs
so they have a separate vitest workspace definition: `vitest.workspace.local.mts`

To run them simply use:

```bash
npm run test:local
```

### Typescript

If you want to run only a specific project use `--project` flag.

```bash
npm run test:typescript -- --project custom-types
```

#### New Test scenario

If you need to create a new typescript test scenario:

1. Create a new folder inside `test/typescript`
2. Create a `tsconfig.json` and a `i18next.d.ts` with the relevant properties inside `CustomOptions`
3. If you need to test multiple tsconfig within the same scenario you can create another `tsconfig.json` but with a semantic name between tsconfig and json.
   E.g.: `tsconfig.nonEsModuleInterop.json` inside `test/typescript/misc`
4. For more information about workspace setup check `vitest.workspace.typescript.mts`
