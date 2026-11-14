# @tanstack/router-plugin

## 1.168.20

### Patch Changes

- Updated dependencies [[`e2dd204`](https://github.com/TanStack/router/commit/e2dd2049cb42eb219d3b447b8605066d19d9c1fa)]:
  - @tanstack/router-core@1.171.15
  - @tanstack/react-router@1.170.18
  - @tanstack/router-generator@1.167.19

## 1.168.19

### Patch Changes

- Updated dependencies [[`9809a06`](https://github.com/TanStack/router/commit/9809a0619d4ed3fe8c2a393af5b9eca4b6c7695b)]:
  - @tanstack/router-core@1.171.14
  - @tanstack/react-router@1.170.17
  - @tanstack/router-generator@1.167.18

## 1.168.18

### Patch Changes

- Updated dependencies [[`776d8ef`](https://github.com/TanStack/router/commit/776d8ef283e5bd9ffe97d43bc3a7f58064cd7e03)]:
  - @tanstack/router-core@1.171.13
  - @tanstack/react-router@1.170.15
  - @tanstack/router-generator@1.167.17

## 1.168.17

### Patch Changes

- [#7560](https://github.com/TanStack/router/pull/7560) [`837897f`](https://github.com/TanStack/router/commit/837897f0733b836dd63880546eec4c20cf06be59) - Fix route HMR so aliased route imports keep generated route properties after hot reloads.

- Updated dependencies [[`df1076c`](https://github.com/TanStack/router/commit/df1076c03ae5a51ab384bebd4d6afda20fb6f107)]:
  - @tanstack/router-core@1.171.12
  - @tanstack/react-router@1.170.14
  - @tanstack/router-generator@1.167.16

## 1.168.16

### Patch Changes

- Updated dependencies [[`ac10815`](https://github.com/TanStack/router/commit/ac10815f387d25b15163ff711b4049e8f8482d01)]:
  - @tanstack/router-core@1.171.11
  - @tanstack/react-router@1.170.13
  - @tanstack/router-generator@1.167.15

## 1.168.15

### Patch Changes

- Updated dependencies [[`301f6ba`](https://github.com/TanStack/router/commit/301f6ba4599386edd6fb3b8423938c48eedb501f), [`2cca73c`](https://github.com/TanStack/router/commit/2cca73c92262ffd96dac4e283c9f69fb37f4b43a), [`7a83e67`](https://github.com/TanStack/router/commit/7a83e67e6596fbef21cb0a88a7127f5935bed2ba), [`76b3d3b`](https://github.com/TanStack/router/commit/76b3d3b24522bd3d1d216674c441252c9b8f184c)]:
  - @tanstack/router-utils@1.162.2
  - @tanstack/router-core@1.171.10
  - @tanstack/router-generator@1.167.14
  - @tanstack/react-router@1.170.12

## 1.168.14

### Patch Changes

- Updated dependencies [[`b4cd5af`](https://github.com/TanStack/router/commit/b4cd5af8d0f9d4aaa2d29095e6a261b9181bc778)]:
  - @tanstack/router-core@1.171.9
  - @tanstack/react-router@1.170.11
  - @tanstack/router-generator@1.167.13

## 1.168.13

### Patch Changes

- Updated dependencies [[`2f53749`](https://github.com/TanStack/router/commit/2f5374945e2138559a51464f45a5152eae67e1dd)]:
  - @tanstack/router-core@1.171.8
  - @tanstack/react-router@1.170.10
  - @tanstack/router-generator@1.167.12

## 1.168.12

### Patch Changes

- Updated dependencies [[`d1997b6`](https://github.com/TanStack/router/commit/d1997b66d7c24c1d64772bb8bab5caf9c6d9cc48)]:
  - @tanstack/react-router@1.170.9
  - @tanstack/router-core@1.171.7
  - @tanstack/router-generator@1.167.11

## 1.168.11

### Patch Changes

- Updated dependencies [[`51a97a1`](https://github.com/TanStack/router/commit/51a97a167fb3ef1b8ca70fbb63db635158f43509)]:
  - @tanstack/router-core@1.171.6
  - @tanstack/react-router@1.170.8
  - @tanstack/router-generator@1.167.10

## 1.168.10

### Patch Changes

- Updated dependencies [[`5268ba4`](https://github.com/TanStack/router/commit/5268ba4566233ea58880df85f167ad0401a93a46)]:
  - @tanstack/router-core@1.171.5
  - @tanstack/react-router@1.170.7
  - @tanstack/router-generator@1.167.9

## 1.168.9

### Patch Changes

- Updated dependencies [[`7df0d02`](https://github.com/TanStack/router/commit/7df0d02bfb1407b1f07731ef69af24e2f0e415d7)]:
  - @tanstack/router-generator@1.167.8

## 1.168.8

### Patch Changes

- Updated dependencies [[`0300f87`](https://github.com/TanStack/router/commit/0300f87ec5a7f878ffbe0b181acf84cba9139960), [`0300f87`](https://github.com/TanStack/router/commit/0300f87ec5a7f878ffbe0b181acf84cba9139960)]:
  - @tanstack/router-core@1.171.4
  - @tanstack/react-router@1.170.6
  - @tanstack/router-generator@1.167.7

## 1.168.7

### Patch Changes

- Update chokidar to v5. ([#7439](https://github.com/TanStack/router/pull/7439))

- Add deferred Hydrate boundary support for TanStack Start. ([#7362](https://github.com/TanStack/router/pull/7362))

  Hydrate boundaries can now be code-split by the Start compiler, preload their generated client chunks, preserve server-rendered fallback HTML, and replay interaction-triggered events after hydration. The compiler integration now uses a Start-owned compiler plugin for Hydrate virtual modules across Vite and Rsbuild, with dev invalidation for generated virtual modules.

  Shared AST utilities used by the router code-splitter and Hydrate virtual modules were moved into `@tanstack/router-utils` so both pipelines can retain referenced top-level declarations, unwrap local exports, and let dead-code elimination remove unused route module code.

- Updated dependencies [[`5fa9e55`](https://github.com/TanStack/router/commit/5fa9e555f3a2edb5e45586623e6bcbfa7f7c7a6b)]:
  - @tanstack/router-core@1.171.3
  - @tanstack/router-utils@1.162.1
  - @tanstack/react-router@1.170.5
  - @tanstack/router-generator@1.167.6

## 1.168.6

### Patch Changes

- Fix route mismatch warnings, HMR route index refresh, and generated route type preferences for duplicate pathless/index routes. ([#7422](https://github.com/TanStack/router/pull/7422))

- Updated dependencies [[`b60eb36`](https://github.com/TanStack/router/commit/b60eb36e59e8a468ee0742cbcf7f47aca1ff1c67)]:
  - @tanstack/router-core@1.171.2
  - @tanstack/router-generator@1.167.5
  - @tanstack/react-router@1.170.4

## 1.168.5

### Patch Changes

- Fix Vite Fast Refresh detection for root routes created with `createRootRouteWithContext` type arguments. ([#7420](https://github.com/TanStack/router/pull/7420))

## 1.168.4

### Patch Changes

- Updated dependencies [[`d9cf933`](https://github.com/TanStack/router/commit/d9cf9331b83fcbd2abfee75d839d862f9bb18e6b)]:
  - @tanstack/router-core@1.171.1
  - @tanstack/react-router@1.170.3
  - @tanstack/router-generator@1.167.4

## 1.168.3

### Patch Changes

- Updated dependencies [[`d533f87`](https://github.com/TanStack/router/commit/d533f87976704098a40b48f160b37c28c8182806)]:
  - @tanstack/router-core@1.171.0
  - @tanstack/react-router@1.170.2
  - @tanstack/router-generator@1.167.3

## 1.168.2

### Patch Changes

- Updated dependencies [[`742941e`](https://github.com/TanStack/router/commit/742941e2f1bf069c950d0a4985b2cd733639509e)]:
  - @tanstack/router-generator@1.167.2

## 1.168.1

### Patch Changes

- Updated dependencies [[`2387a2e`](https://github.com/TanStack/router/commit/2387a2eea0683004cc400b9f71bed5944eb60110)]:
  - @tanstack/router-core@1.170.1
  - @tanstack/react-router@1.170.1
  - @tanstack/router-generator@1.167.1

## 1.168.0

### Minor Changes

- Clean minor bump, fresh start ([#7395](https://github.com/TanStack/router/pull/7395))

### Patch Changes

- Updated dependencies [[`b1c061a`](https://github.com/TanStack/router/commit/b1c061aff9185cdf5fdc08c0136382a9dce0302f), [`038cd12`](https://github.com/TanStack/router/commit/038cd123b70bc6154d75abb6404a744c376f8f6a), [`201e150`](https://github.com/TanStack/router/commit/201e150bd1412bae2faa9ce53f0fefcb7574ac14)]:
  - @tanstack/router-core@1.170.0
  - @tanstack/router-generator@1.167.0
  - @tanstack/react-router@1.170.0
  - @tanstack/router-utils@1.162.0
  - @tanstack/virtual-file-routes@1.162.0

## 1.167.35

### Patch Changes

- Updated dependencies [[`c5811aa`](https://github.com/TanStack/router/commit/c5811aacb59b69a8179f14cd9529a51b2206d504)]:
  - @tanstack/router-generator@1.166.42

## 1.167.34

### Patch Changes

- Updated dependencies [[`35e88f0`](https://github.com/TanStack/router/commit/35e88f04996d71019a1868b7b06ecb4ddbc9df9e)]:
  - @tanstack/router-core@1.169.2
  - @tanstack/react-router@1.169.2
  - @tanstack/router-generator@1.166.41

## 1.167.33

### Patch Changes

- Parse plain TypeScript files without JSX when a filename is available, preventing angle-bracket type assertions from being interpreted as JSX during route and Start import-protection transforms. ([#7342](https://github.com/TanStack/router/pull/7342))

- Updated dependencies [[`056337e`](https://github.com/TanStack/router/commit/056337ef02ccbeaf45ec8533a227761be869e8f3)]:
  - @tanstack/router-generator@1.166.40
  - @tanstack/router-utils@1.161.8

## 1.167.32

### Patch Changes

- Replace global route metadata with explicit router plugin contexts so multiple router plugin instances cannot cross-transform route files. ([#7313](https://github.com/TanStack/router/pull/7313))

## 1.167.31

### Patch Changes

- Updated dependencies [[`4a1e63f`](https://github.com/TanStack/router/commit/4a1e63f1d1230b1ed8234609acad4639d8982c13)]:
  - @tanstack/router-core@1.169.1
  - @tanstack/react-router@1.169.1
  - @tanstack/router-generator@1.166.39

## 1.167.30

### Patch Changes

- Updated dependencies [[`c992495`](https://github.com/TanStack/router/commit/c992495bf4010ff4c3597bb1f3b1ba02594e857e)]:
  - @tanstack/router-core@1.169.0
  - @tanstack/react-router@1.169.0
  - @tanstack/router-generator@1.166.38

## 1.167.29

### Patch Changes

- Updated dependencies [[`b5c4183`](https://github.com/TanStack/router/commit/b5c4183ab8b44be8a75647b7f7b588ad7c146ece)]:
  - @tanstack/router-core@1.168.18
  - @tanstack/react-router@1.168.26
  - @tanstack/router-generator@1.166.37

## 1.167.28

### Patch Changes

- Updated dependencies [[`493148b`](https://github.com/TanStack/router/commit/493148bc5378b7f9de1544d87f6aaa425c12eb34)]:
  - @tanstack/router-core@1.168.17
  - @tanstack/react-router@1.168.25
  - @tanstack/router-generator@1.166.36

## 1.167.27

### Patch Changes

- Updated dependencies [[`a2ad394`](https://github.com/TanStack/router/commit/a2ad394598e2079ab4050ebb16bb03b31d69c32a)]:
  - @tanstack/router-generator@1.166.35

## 1.167.26

### Patch Changes

- refactor(router-plugin): upgrade unplugin to `v3` ([#7258](https://github.com/TanStack/router/pull/7258))

## 1.167.25

### Patch Changes

- Fix React route HMR for webpack and rspack so it no longer imports `react-refresh/runtime`, avoiding failures when that optional dependency is not installed. ([#7255](https://github.com/TanStack/router/pull/7255))

## 1.167.24

### Patch Changes

- Updated dependencies [[`4d864ee`](https://github.com/TanStack/router/commit/4d864eebbd184265eabb563d326ab409c93feb17)]:
  - @tanstack/react-router@1.168.24
  - @tanstack/router-core@1.168.16
  - @tanstack/router-generator@1.166.34

## 1.167.23

### Patch Changes

- rsbuild ([#7228](https://github.com/TanStack/router/pull/7228))

- Updated dependencies [[`91a7089`](https://github.com/TanStack/router/commit/91a708989d00537a21911e74ff60bbfec8266295)]:
  - @tanstack/router-utils@1.161.7
  - @tanstack/router-generator@1.166.33

## 1.167.22

### Patch Changes

- Updated dependencies [[`16f6892`](https://github.com/TanStack/router/commit/16f6892d6b7ceadf606677c5a40e743f29163aa6)]:
  - @tanstack/router-core@1.168.15
  - @tanstack/react-router@1.168.21
  - @tanstack/router-generator@1.166.32

## 1.167.21

### Patch Changes

- Updated dependencies [[`328d7e5`](https://github.com/TanStack/router/commit/328d7e5ebc6b8074242a07d68ccafafb83e37a0e)]:
  - @tanstack/router-generator@1.166.31

## 1.167.20

### Patch Changes

- fix: update vite-plugin-solid peer dependency to support version 3.0.0-0 ([#7170](https://github.com/TanStack/router/pull/7170))

## 1.167.19

### Patch Changes

- Updated dependencies [[`105d056`](https://github.com/TanStack/router/commit/105d05691a247779a63e7b688aa1207cce619339)]:
  - @tanstack/router-generator@1.166.30
  - @tanstack/react-router@1.168.19

## 1.167.18

### Patch Changes

- add vite 8 to peer deps ([#7160](https://github.com/TanStack/router/pull/7160))

## 1.167.17

### Patch Changes

- Updated dependencies [[`0e2c900`](https://github.com/TanStack/router/commit/0e2c9003c18ae07c09969189c028f277ea562a7a)]:
  - @tanstack/router-core@1.168.14
  - @tanstack/react-router@1.168.18
  - @tanstack/router-generator@1.166.29

## 1.167.16

### Patch Changes

- Updated dependencies [[`812792f`](https://github.com/TanStack/router/commit/812792fbda3caf97b300770855cf5641252f413b)]:
  - @tanstack/router-core@1.168.13
  - @tanstack/react-router@1.168.17
  - @tanstack/router-generator@1.166.28

## 1.167.15

### Patch Changes

- Updated dependencies [[`8ec9ca9`](https://github.com/TanStack/router/commit/8ec9ca97b472779de878c2a6510f21deb24d386c)]:
  - @tanstack/router-core@1.168.12
  - @tanstack/react-router@1.168.16
  - @tanstack/router-generator@1.166.27

## 1.167.14

### Patch Changes

- shorten internal non-minifiable store names for byte shaving ([#7152](https://github.com/TanStack/router/pull/7152))

- Updated dependencies [[`6355bb7`](https://github.com/TanStack/router/commit/6355bb75f7637ba77f06a923c18fdaf37720bb48)]:
  - @tanstack/react-router@1.168.15
  - @tanstack/router-core@1.168.11
  - @tanstack/router-generator@1.166.26

## 1.167.13

### Patch Changes

- migrate createStore > createAtom for simpler API ([#7150](https://github.com/TanStack/router/pull/7150))

- Updated dependencies [[`459057c`](https://github.com/TanStack/router/commit/459057cd2d90cff20d20e51d4964b0a8c950555e)]:
  - @tanstack/react-router@1.168.14
  - @tanstack/router-core@1.168.10
  - @tanstack/router-generator@1.166.25

## 1.167.12

### Patch Changes

- Updated dependencies [[`796406d`](https://github.com/TanStack/router/commit/796406da66cfb12b518bb3ca326c9d541368fb06)]:
  - @tanstack/router-core@1.168.9
  - @tanstack/react-router@1.168.10
  - @tanstack/router-generator@1.166.24

## 1.167.11

### Patch Changes

- Updated dependencies [[`2d1ec86`](https://github.com/TanStack/router/commit/2d1ec865a446926f7db6e29dbbde82d265de6d36)]:
  - @tanstack/router-core@1.168.8
  - @tanstack/react-router@1.168.9
  - @tanstack/router-generator@1.166.23

## 1.167.10

### Patch Changes

- Initialize `import.meta.hot.data` before storing stable split components so Vitest does not crash when HMR data is missing. ([#7074](https://github.com/TanStack/router/pull/7074))

## 1.167.9

### Patch Changes

- Updated dependencies [[`6ee0e79`](https://github.com/TanStack/router/commit/6ee0e795b085651beb2f1ac6503cdbd7eaffedd1)]:
  - @tanstack/router-core@1.168.7
  - @tanstack/react-router@1.168.8
  - @tanstack/router-generator@1.166.22

## 1.167.8

### Patch Changes

- Updated dependencies [[`42c3f3b`](https://github.com/TanStack/router/commit/42c3f3b3a3a478fd6d6894310ef94b2d23794b8e)]:
  - @tanstack/router-core@1.168.6
  - @tanstack/react-router@1.168.7
  - @tanstack/router-generator@1.166.21

## 1.167.7

### Patch Changes

- Updated dependencies [[`70b2225`](https://github.com/TanStack/router/commit/70b222513720d99c6d44bd3f28d1e9b19dc91a43)]:
  - @tanstack/router-generator@1.166.20

## 1.167.6

### Patch Changes

- Updated dependencies [[`cf5f554`](https://github.com/TanStack/router/commit/cf5f5542476137a81515099ad740747e84512f9a)]:
  - @tanstack/router-core@1.168.5
  - @tanstack/react-router@1.168.5
  - @tanstack/router-generator@1.166.19

## 1.167.5

### Patch Changes

- Updated dependencies [[`71a8b68`](https://github.com/TanStack/router/commit/71a8b684c87c37fd4a033d99f5ba4a05c7a179f5)]:
  - @tanstack/react-router@1.168.4
  - @tanstack/router-core@1.168.4
  - @tanstack/router-generator@1.166.18

## 1.167.4

### Patch Changes

- Updated dependencies [[`d81d21a`](https://github.com/TanStack/router/commit/d81d21ad05c9401bf54b24acd29401e1e4fd624c)]:
  - @tanstack/react-router@1.168.3
  - @tanstack/router-core@1.168.3
  - @tanstack/router-generator@1.166.17

## 1.167.3

### Patch Changes

- Updated dependencies [[`c9e1855`](https://github.com/TanStack/router/commit/c9e18555f3a5531e96de8f574cfca9edcdb18e5c)]:
  - @tanstack/react-router@1.168.2
  - @tanstack/router-core@1.168.2
  - @tanstack/router-generator@1.166.16

## 1.167.2

### Patch Changes

- Fix React Fast Refresh state preservation for auto code-split route components during HMR updates. ([#7000](https://github.com/TanStack/router/pull/7000))

## 1.167.1

### Patch Changes

- Updated dependencies [[`91cc628`](https://github.com/TanStack/router/commit/91cc62899b75ca920fe83c5ee7f3dbb5c71a523f)]:
  - @tanstack/react-router@1.168.1
  - @tanstack/router-core@1.168.1
  - @tanstack/router-generator@1.166.15

## 1.167.0

### Minor Changes

- remove pendingMatches, cachedMatches ([#6704](https://github.com/TanStack/router/pull/6704))
  move to signal-based reactivity
  solid uses its own native signals

### Patch Changes

- Updated dependencies [[`0545239`](https://github.com/TanStack/router/commit/054523900b2ee19308e5a88417dadfc6923afe30)]:
  - @tanstack/react-router@1.168.0
  - @tanstack/router-core@1.168.0
  - @tanstack/router-generator@1.166.14

## 1.166.14

### Patch Changes

- Updated dependencies [[`5ff4f0b`](https://github.com/TanStack/router/commit/5ff4f0b8dce1fac2bb0b0bfe2684fc677a8ee505)]:
  - @tanstack/router-core@1.167.5
  - @tanstack/react-router@1.167.5
  - @tanstack/router-generator@1.166.13

## 1.166.13

### Patch Changes

- Add @tanstack/intent AI agent skills and CLI entry points for Router and Start packages ([#6866](https://github.com/TanStack/router/pull/6866))

- Updated dependencies [[`940151c`](https://github.com/TanStack/router/commit/940151cbed0c76c92a5cf196c0905b17a956ca7e)]:
  - @tanstack/router-core@1.167.4
  - @tanstack/react-router@1.167.4
  - @tanstack/virtual-file-routes@1.161.7
  - @tanstack/router-generator@1.166.12

## 1.166.12

### Patch Changes

- Updated dependencies [[`32fcba7`](https://github.com/TanStack/router/commit/32fcba7b044b03f5901308b870f70b0b4910c220)]:
  - @tanstack/router-core@1.167.3
  - @tanstack/react-router@1.167.3
  - @tanstack/router-generator@1.166.11

## 1.166.11

### Patch Changes

- build: update to vite-config 5.x (rolldown) ([#6926](https://github.com/TanStack/router/pull/6926))

- Updated dependencies [[`838b0eb`](https://github.com/TanStack/router/commit/838b0eb9a8bbbb987a0a6972c1446e01423bbd7b)]:
  - @tanstack/react-router@1.167.2
  - @tanstack/router-core@1.167.2
  - @tanstack/router-generator@1.166.10
  - @tanstack/router-utils@1.161.6
  - @tanstack/virtual-file-routes@1.161.6

## 1.166.10

### Patch Changes

- fix: build with @tanstack/vite-config 0.4.3 ([#6923](https://github.com/TanStack/router/pull/6923))

- Updated dependencies [[`ef9b241`](https://github.com/TanStack/router/commit/ef9b241f3cfe95cee40daa96da669f0ffd4a971a)]:
  - @tanstack/virtual-file-routes@1.161.5
  - @tanstack/router-generator@1.166.9
  - @tanstack/react-router@1.167.1
  - @tanstack/router-utils@1.161.5
  - @tanstack/router-core@1.167.1

## 1.166.9

### Patch Changes

- Updated dependencies [[`6f297a2`](https://github.com/TanStack/router/commit/6f297a249424c0fd1c1a56aa4fc12c8217be7b6a)]:
  - @tanstack/router-core@1.167.0
  - @tanstack/react-router@1.167.0
  - @tanstack/router-generator@1.166.8

## 1.166.8

### Patch Changes

- fix: hoist inline component definitions for proper React HMR#6919 ([#6919](https://github.com/TanStack/router/pull/6919))

- Updated dependencies [[`6069eba`](https://github.com/TanStack/router/commit/6069eba64369dbddb0d8dccdb4407f0e1a82259e)]:
  - @tanstack/react-router@1.166.8
  - @tanstack/router-generator@1.166.7
