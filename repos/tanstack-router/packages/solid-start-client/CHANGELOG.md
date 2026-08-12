# @tanstack/solid-start-client

## 1.168.15

### Patch Changes

- Updated dependencies [[`9809a06`](https://github.com/TanStack/router/commit/9809a0619d4ed3fe8c2a393af5b9eca4b6c7695b), [`ba52d2b`](https://github.com/TanStack/router/commit/ba52d2b8f9e95d6becd1be14c020b35f3231e02c)]:
  - @tanstack/router-core@1.171.14
  - @tanstack/start-client-core@1.170.13
  - @tanstack/solid-router@1.170.17

## 1.168.14

### Patch Changes

- Updated dependencies [[`41e7a24`](https://github.com/TanStack/router/commit/41e7a24f693b0f58c2bef89a2b8c4d084acbd531)]:
  - @tanstack/solid-router@1.170.16

## 1.168.13

### Patch Changes

- Updated dependencies [[`9bebf8d`](https://github.com/TanStack/router/commit/9bebf8dc9f2bf74b680c065a5aa63d03b9622825)]:
  - @tanstack/start-client-core@1.170.12

## 1.168.12

### Patch Changes

- Updated dependencies [[`776d8ef`](https://github.com/TanStack/router/commit/776d8ef283e5bd9ffe97d43bc3a7f58064cd7e03)]:
  - @tanstack/router-core@1.171.13
  - @tanstack/solid-router@1.170.15
  - @tanstack/start-client-core@1.170.11

## 1.168.11

### Patch Changes

- Updated dependencies [[`df1076c`](https://github.com/TanStack/router/commit/df1076c03ae5a51ab384bebd4d6afda20fb6f107)]:
  - @tanstack/router-core@1.171.12
  - @tanstack/solid-router@1.170.14
  - @tanstack/start-client-core@1.170.10

## 1.168.10

### Patch Changes

- Updated dependencies [[`ac10815`](https://github.com/TanStack/router/commit/ac10815f387d25b15163ff711b4049e8f8482d01)]:
  - @tanstack/router-core@1.171.11
  - @tanstack/solid-router@1.170.13
  - @tanstack/start-client-core@1.170.9

## 1.168.9

### Patch Changes

- Updated dependencies [[`2cca73c`](https://github.com/TanStack/router/commit/2cca73c92262ffd96dac4e283c9f69fb37f4b43a), [`7a83e67`](https://github.com/TanStack/router/commit/7a83e67e6596fbef21cb0a88a7127f5935bed2ba), [`76b3d3b`](https://github.com/TanStack/router/commit/76b3d3b24522bd3d1d216674c441252c9b8f184c)]:
  - @tanstack/router-core@1.171.10
  - @tanstack/solid-router@1.170.12
  - @tanstack/start-client-core@1.170.8

## 1.168.8

### Patch Changes

- Updated dependencies [[`b4cd5af`](https://github.com/TanStack/router/commit/b4cd5af8d0f9d4aaa2d29095e6a261b9181bc778)]:
  - @tanstack/router-core@1.171.9
  - @tanstack/solid-router@1.170.11
  - @tanstack/start-client-core@1.170.7

## 1.168.7

### Patch Changes

- Updated dependencies [[`2f53749`](https://github.com/TanStack/router/commit/2f5374945e2138559a51464f45a5152eae67e1dd)]:
  - @tanstack/router-core@1.171.8
  - @tanstack/solid-router@1.170.10
  - @tanstack/start-client-core@1.170.6

## 1.168.6

### Patch Changes

- Updated dependencies [[`d1997b6`](https://github.com/TanStack/router/commit/d1997b66d7c24c1d64772bb8bab5caf9c6d9cc48)]:
  - @tanstack/solid-router@1.170.9
  - @tanstack/router-core@1.171.7
  - @tanstack/start-client-core@1.170.5

## 1.168.5

### Patch Changes

- [#7492](https://github.com/TanStack/router/pull/7492) [`71fb329`](https://github.com/TanStack/router/commit/71fb3297e93a126e1bcfd9eeb0626cc4b8df8dd8) - Avoid pulling the client hydration entry into root `@tanstack/react-start` and `@tanstack/solid-start` imports by re-exporting `Hydrate` from framework client Hydrate-only subpaths.

## 1.168.4

### Patch Changes

- Updated dependencies [[`a82cec6`](https://github.com/TanStack/router/commit/a82cec69474c366b36efdb3f43c4efe8311c485a)]:
  - @tanstack/start-client-core@1.170.4

## 1.168.3

### Patch Changes

- Updated dependencies [[`51a97a1`](https://github.com/TanStack/router/commit/51a97a167fb3ef1b8ca70fbb63db635158f43509)]:
  - @tanstack/router-core@1.171.6
  - @tanstack/solid-router@1.170.8
  - @tanstack/start-client-core@1.170.3

## 1.168.2

### Patch Changes

- Updated dependencies [[`5268ba4`](https://github.com/TanStack/router/commit/5268ba4566233ea58880df85f167ad0401a93a46)]:
  - @tanstack/router-core@1.171.5
  - @tanstack/solid-router@1.170.7
  - @tanstack/start-client-core@1.170.2

## 1.168.1

### Patch Changes

- Updated dependencies [[`0300f87`](https://github.com/TanStack/router/commit/0300f87ec5a7f878ffbe0b181acf84cba9139960), [`0300f87`](https://github.com/TanStack/router/commit/0300f87ec5a7f878ffbe0b181acf84cba9139960)]:
  - @tanstack/router-core@1.171.4
  - @tanstack/solid-router@1.170.6
  - @tanstack/start-client-core@1.170.1

## 1.168.0

### Minor Changes

- Add deferred Hydrate boundary support for TanStack Start. ([#7362](https://github.com/TanStack/router/pull/7362))

  Hydrate boundaries can now be code-split by the Start compiler, preload their generated client chunks, preserve server-rendered fallback HTML, and replay interaction-triggered events after hydration. The compiler integration now uses a Start-owned compiler plugin for Hydrate virtual modules across Vite and Rsbuild, with dev invalidation for generated virtual modules.

  Shared AST utilities used by the router code-splitter and Hydrate virtual modules were moved into `@tanstack/router-utils` so both pipelines can retain referenced top-level declarations, unwrap local exports, and let dead-code elimination remove unused route module code.

### Patch Changes

- Updated dependencies [[`5fa9e55`](https://github.com/TanStack/router/commit/5fa9e555f3a2edb5e45586623e6bcbfa7f7c7a6b)]:
  - @tanstack/start-client-core@1.170.0
  - @tanstack/router-core@1.171.3
  - @tanstack/solid-router@1.170.5

## 1.167.4

### Patch Changes

- Updated dependencies [[`b60eb36`](https://github.com/TanStack/router/commit/b60eb36e59e8a468ee0742cbcf7f47aca1ff1c67)]:
  - @tanstack/router-core@1.171.2
  - @tanstack/solid-router@1.170.4
  - @tanstack/start-client-core@1.169.4

## 1.167.3

### Patch Changes

- Updated dependencies [[`d9cf933`](https://github.com/TanStack/router/commit/d9cf9331b83fcbd2abfee75d839d862f9bb18e6b)]:
  - @tanstack/router-core@1.171.1
  - @tanstack/solid-router@1.170.3
  - @tanstack/start-client-core@1.169.3

## 1.167.2

### Patch Changes

- Updated dependencies [[`d533f87`](https://github.com/TanStack/router/commit/d533f87976704098a40b48f160b37c28c8182806)]:
  - @tanstack/router-core@1.171.0
  - @tanstack/solid-router@1.170.2
  - @tanstack/start-client-core@1.169.2

## 1.167.1

### Patch Changes

- Updated dependencies [[`2387a2e`](https://github.com/TanStack/router/commit/2387a2eea0683004cc400b9f71bed5944eb60110)]:
  - @tanstack/router-core@1.170.1
  - @tanstack/solid-router@1.170.1
  - @tanstack/start-client-core@1.169.1

## 1.167.0

### Minor Changes

- Clean minor bump, fresh start ([#7395](https://github.com/TanStack/router/pull/7395))

### Patch Changes

- Updated dependencies [[`b1c061a`](https://github.com/TanStack/router/commit/b1c061aff9185cdf5fdc08c0136382a9dce0302f), [`201e150`](https://github.com/TanStack/router/commit/201e150bd1412bae2faa9ce53f0fefcb7574ac14)]:
  - @tanstack/router-core@1.170.0
  - @tanstack/solid-router@1.170.0
  - @tanstack/start-client-core@1.169.0

## 1.166.47

### Patch Changes

- Updated dependencies [[`35e88f0`](https://github.com/TanStack/router/commit/35e88f04996d71019a1868b7b06ecb4ddbc9df9e)]:
  - @tanstack/router-core@1.169.2
  - @tanstack/start-client-core@1.168.2
  - @tanstack/solid-router@1.169.2

## 1.166.46

### Patch Changes

- Updated dependencies [[`4a1e63f`](https://github.com/TanStack/router/commit/4a1e63f1d1230b1ed8234609acad4639d8982c13)]:
  - @tanstack/router-core@1.169.1
  - @tanstack/solid-router@1.169.1
  - @tanstack/start-client-core@1.168.1

## 1.166.45

### Patch Changes

- Updated dependencies [[`82b0613`](https://github.com/TanStack/router/commit/82b06132af776f74603ab27977cc277d6219a845)]:
  - @tanstack/start-client-core@1.168.0

## 1.166.44

### Patch Changes

- Updated dependencies [[`c992495`](https://github.com/TanStack/router/commit/c992495bf4010ff4c3597bb1f3b1ba02594e857e)]:
  - @tanstack/router-core@1.169.0
  - @tanstack/solid-router@1.169.0
  - @tanstack/start-client-core@1.167.22

## 1.166.43

### Patch Changes

- Updated dependencies [[`b5c4183`](https://github.com/TanStack/router/commit/b5c4183ab8b44be8a75647b7f7b588ad7c146ece)]:
  - @tanstack/router-core@1.168.18
  - @tanstack/solid-router@1.168.26
  - @tanstack/start-client-core@1.167.21

## 1.166.42

### Patch Changes

- Updated dependencies [[`493148b`](https://github.com/TanStack/router/commit/493148bc5378b7f9de1544d87f6aaa425c12eb34)]:
  - @tanstack/router-core@1.168.17
  - @tanstack/solid-router@1.168.25
  - @tanstack/start-client-core@1.167.20

## 1.166.41

### Patch Changes

- Updated dependencies [[`944b155`](https://github.com/TanStack/router/commit/944b1558965bf038eaf3c0dfb9e1ac3800d6fd3a)]:
  - @tanstack/solid-router@1.168.24

## 1.166.40

### Patch Changes

- Updated dependencies [[`41e37f8`](https://github.com/TanStack/router/commit/41e37f8a9c3d2a6e00e4ca6faabb6a596bc36a98), [`e054474`](https://github.com/TanStack/router/commit/e054474cd1df6f93cd69dd5d255013840441438e)]:
  - @tanstack/solid-router@1.168.23

## 1.166.39

### Patch Changes

- Updated dependencies [[`b732c8a`](https://github.com/TanStack/router/commit/b732c8ac26bd3b316e95b026ca2fc7c2c78a1ddd), [`d20c878`](https://github.com/TanStack/router/commit/d20c87813559ff00d0b4810c4b600d47b47eff2f)]:
  - @tanstack/solid-router@1.168.22

## 1.166.38

### Patch Changes

- Updated dependencies [[`8b97002`](https://github.com/TanStack/router/commit/8b97002af3f6d15204e60c55d3f5735b78bd7efe)]:
  - @tanstack/start-client-core@1.167.19

## 1.166.37

### Patch Changes

- Updated dependencies [[`4d864ee`](https://github.com/TanStack/router/commit/4d864eebbd184265eabb563d326ab409c93feb17)]:
  - @tanstack/router-core@1.168.16
  - @tanstack/solid-router@1.168.21
  - @tanstack/start-client-core@1.167.18

## 1.166.36

### Patch Changes

- Updated dependencies [[`22dc152`](https://github.com/TanStack/router/commit/22dc15203379da15e6eaa225e61696039380aedd)]:
  - @tanstack/solid-router@1.168.20

## 1.166.35

### Patch Changes

- Updated dependencies [[`16f6892`](https://github.com/TanStack/router/commit/16f6892d6b7ceadf606677c5a40e743f29163aa6)]:
  - @tanstack/router-core@1.168.15
  - @tanstack/solid-router@1.168.19
  - @tanstack/start-client-core@1.167.17

## 1.166.34

### Patch Changes

- Updated dependencies [[`105d056`](https://github.com/TanStack/router/commit/105d05691a247779a63e7b688aa1207cce619339)]:
  - @tanstack/solid-router@1.168.18

## 1.166.33

### Patch Changes

- Updated dependencies [[`0e2c900`](https://github.com/TanStack/router/commit/0e2c9003c18ae07c09969189c028f277ea562a7a)]:
  - @tanstack/router-core@1.168.14
  - @tanstack/solid-router@1.168.17
  - @tanstack/start-client-core@1.167.16

## 1.166.32

### Patch Changes

- Updated dependencies [[`812792f`](https://github.com/TanStack/router/commit/812792fbda3caf97b300770855cf5641252f413b)]:
  - @tanstack/router-core@1.168.13
  - @tanstack/solid-router@1.168.16
  - @tanstack/start-client-core@1.167.15

## 1.166.31

### Patch Changes

- Updated dependencies [[`8ec9ca9`](https://github.com/TanStack/router/commit/8ec9ca97b472779de878c2a6510f21deb24d386c)]:
  - @tanstack/router-core@1.168.12
  - @tanstack/solid-router@1.168.15
  - @tanstack/start-client-core@1.167.14

## 1.166.30

### Patch Changes

- Updated dependencies [[`6355bb7`](https://github.com/TanStack/router/commit/6355bb75f7637ba77f06a923c18fdaf37720bb48)]:
  - @tanstack/solid-router@1.168.14
  - @tanstack/router-core@1.168.11
  - @tanstack/start-client-core@1.167.13

## 1.166.29

### Patch Changes

- Updated dependencies [[`459057c`](https://github.com/TanStack/router/commit/459057cd2d90cff20d20e51d4964b0a8c950555e)]:
  - @tanstack/start-client-core@1.167.12
  - @tanstack/solid-router@1.168.13
  - @tanstack/router-core@1.168.10

## 1.166.28

### Patch Changes

- Updated dependencies [[`f8ac427`](https://github.com/TanStack/router/commit/f8ac427000c3fec99225926e72f9f2fc7a37231f)]:
  - @tanstack/start-client-core@1.167.11

## 1.166.27

### Patch Changes

- Updated dependencies [[`540d221`](https://github.com/TanStack/router/commit/540d22100d33415a1ddc9eb193f6aeb8184da77f)]:
  - @tanstack/solid-router@1.168.12

## 1.166.26

### Patch Changes

- Updated dependencies [[`b29d64d`](https://github.com/TanStack/router/commit/b29d64de0c400183114c12f82183f80e37d9ea5c)]:
  - @tanstack/solid-router@1.168.11

## 1.166.25

### Patch Changes

- Updated dependencies [[`4b9ed6c`](https://github.com/TanStack/router/commit/4b9ed6c5cb5437df8607c605728c8338dd2eb02c)]:
  - @tanstack/solid-router@1.168.10

## 1.166.24

### Patch Changes

- Updated dependencies [[`f7e9c5e`](https://github.com/TanStack/router/commit/f7e9c5e323793d1b28c96871819c265fd28ae397)]:
  - @tanstack/start-client-core@1.167.10

## 1.166.23

### Patch Changes

- Updated dependencies [[`796406d`](https://github.com/TanStack/router/commit/796406da66cfb12b518bb3ca326c9d541368fb06)]:
  - @tanstack/router-core@1.168.9
  - @tanstack/solid-router@1.168.9
  - @tanstack/start-client-core@1.167.9

## 1.166.22

### Patch Changes

- Updated dependencies [[`2d1ec86`](https://github.com/TanStack/router/commit/2d1ec865a446926f7db6e29dbbde82d265de6d36)]:
  - @tanstack/router-core@1.168.8
  - @tanstack/solid-router@1.168.8
  - @tanstack/start-client-core@1.167.8

## 1.166.21

### Patch Changes

- Updated dependencies [[`6ee0e79`](https://github.com/TanStack/router/commit/6ee0e795b085651beb2f1ac6503cdbd7eaffedd1)]:
  - @tanstack/router-core@1.168.7
  - @tanstack/solid-router@1.168.7
  - @tanstack/start-client-core@1.167.7

## 1.166.20

### Patch Changes

- Updated dependencies [[`42c3f3b`](https://github.com/TanStack/router/commit/42c3f3b3a3a478fd6d6894310ef94b2d23794b8e)]:
  - @tanstack/router-core@1.168.6
  - @tanstack/solid-router@1.168.6
  - @tanstack/start-client-core@1.167.6

## 1.166.19

### Patch Changes

- Updated dependencies [[`cf5f554`](https://github.com/TanStack/router/commit/cf5f5542476137a81515099ad740747e84512f9a)]:
  - @tanstack/router-core@1.168.5
  - @tanstack/solid-router@1.168.5
  - @tanstack/start-client-core@1.167.5

## 1.166.18

### Patch Changes

- Updated dependencies [[`71a8b68`](https://github.com/TanStack/router/commit/71a8b684c87c37fd4a033d99f5ba4a05c7a179f5)]:
  - @tanstack/router-core@1.168.4
  - @tanstack/solid-router@1.168.4
  - @tanstack/start-client-core@1.167.4

## 1.166.17

### Patch Changes

- Updated dependencies [[`d81d21a`](https://github.com/TanStack/router/commit/d81d21ad05c9401bf54b24acd29401e1e4fd624c)]:
  - @tanstack/router-core@1.168.3
  - @tanstack/solid-router@1.168.3
  - @tanstack/start-client-core@1.167.3

## 1.166.16

### Patch Changes

- Replace tiny-invariant and tiny-warning with in-house solution for bundle-size ([#7007](https://github.com/TanStack/router/pull/7007))

- Updated dependencies [[`c9e1855`](https://github.com/TanStack/router/commit/c9e18555f3a5531e96de8f574cfca9edcdb18e5c)]:
  - @tanstack/start-client-core@1.167.2
  - @tanstack/solid-router@1.168.2
  - @tanstack/router-core@1.168.2

## 1.166.15

### Patch Changes

- Updated dependencies [[`91cc628`](https://github.com/TanStack/router/commit/91cc62899b75ca920fe83c5ee7f3dbb5c71a523f)]:
  - @tanstack/router-core@1.168.1
  - @tanstack/solid-router@1.168.1
  - @tanstack/start-client-core@1.167.1

## 1.166.14

### Patch Changes

- Updated dependencies [[`0545239`](https://github.com/TanStack/router/commit/054523900b2ee19308e5a88417dadfc6923afe30)]:
  - @tanstack/start-client-core@1.167.0
  - @tanstack/solid-router@1.168.0
  - @tanstack/router-core@1.168.0

## 1.166.13

### Patch Changes

- Updated dependencies [[`5ff4f0b`](https://github.com/TanStack/router/commit/5ff4f0b8dce1fac2bb0b0bfe2684fc677a8ee505)]:
  - @tanstack/router-core@1.167.5
  - @tanstack/solid-router@1.167.5
  - @tanstack/start-client-core@1.166.13

## 1.166.12

### Patch Changes

- Updated dependencies [[`940151c`](https://github.com/TanStack/router/commit/940151cbed0c76c92a5cf196c0905b17a956ca7e)]:
  - @tanstack/router-core@1.167.4
  - @tanstack/solid-router@1.167.4
  - @tanstack/start-client-core@1.166.12

## 1.166.11

### Patch Changes

- Updated dependencies [[`32fcba7`](https://github.com/TanStack/router/commit/32fcba7b044b03f5901308b870f70b0b4910c220)]:
  - @tanstack/router-core@1.167.3
  - @tanstack/solid-router@1.167.3
  - @tanstack/start-client-core@1.166.11

## 1.166.10

### Patch Changes

- build: update to vite-config 5.x (rolldown) ([#6926](https://github.com/TanStack/router/pull/6926))

- Updated dependencies [[`838b0eb`](https://github.com/TanStack/router/commit/838b0eb9a8bbbb987a0a6972c1446e01423bbd7b)]:
  - @tanstack/router-core@1.167.2
  - @tanstack/solid-router@1.167.2
  - @tanstack/start-client-core@1.166.10

## 1.166.9

### Patch Changes

- fix: build with @tanstack/vite-config 0.4.3 ([#6923](https://github.com/TanStack/router/pull/6923))

- Updated dependencies [[`ef9b241`](https://github.com/TanStack/router/commit/ef9b241f3cfe95cee40daa96da669f0ffd4a971a)]:
  - @tanstack/start-client-core@1.166.9
  - @tanstack/solid-router@1.167.1
  - @tanstack/router-core@1.167.1

## 1.166.8

### Patch Changes

- Updated dependencies [[`6f297a2`](https://github.com/TanStack/router/commit/6f297a249424c0fd1c1a56aa4fc12c8217be7b6a)]:
  - @tanstack/router-core@1.167.0
  - @tanstack/solid-router@1.167.0
  - @tanstack/start-client-core@1.166.8
