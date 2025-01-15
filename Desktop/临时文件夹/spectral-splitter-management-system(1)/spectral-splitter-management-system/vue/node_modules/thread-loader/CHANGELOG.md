# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [3.0.4](https://github.com/webpack-contrib/thread-loader/compare/v3.0.3...v3.0.4) (2021-05-10)


### Bug Fixes

* do not crash on `this.addBuildDependency` usage ([#117](https://github.com/webpack-contrib/thread-loader/issues/117)) ([1c7a8a2](https://github.com/webpack-contrib/thread-loader/commit/1c7a8a2454c7540a226b2a7fa6e0cbfef6ebf2c6))
* `this.addMissingDependency` works fine ([#119](https://github.com/webpack-contrib/thread-loader/issues/119)) ([5a0ea0c](https://github.com/webpack-contrib/thread-loader/commit/5a0ea0c4239e69cffd68e79a01f9615250c66755))

### [3.0.3](https://github.com/webpack-contrib/thread-loader/compare/v3.0.2...v3.0.3) (2021-04-13)


### Bug Fixes

* `getOptions` usage ([#113](https://github.com/webpack-contrib/thread-loader/issues/113)) ([d7531ef](https://github.com/webpack-contrib/thread-loader/commit/d7531efd39b90eff3e6cdd5e6917997f5b392bff))

### [3.0.2](https://github.com/webpack-contrib/thread-loader/compare/v3.0.1...v3.0.2) (2021-04-12)


### Bug Fixes

* support serialization of RegExp ([#102](https://github.com/webpack-contrib/thread-loader/issues/102)) ([3766560](https://github.com/webpack-contrib/thread-loader/commit/37665608bea01c4072fa974b038de1352a82961c))

### [3.0.1](https://github.com/webpack-contrib/thread-loader/compare/v3.0.0...v3.0.1) (2020-10-27)


### Bug Fixes

* pass rootContext to loaders ([#104](https://github.com/webpack-contrib/thread-loader/issues/104)) ([8e56785](https://github.com/webpack-contrib/thread-loader/commit/8e567853efa3a0d6b95423d3598a68ad77598bc4))

## [3.0.0](https://github.com/webpack-contrib/thread-loader/compare/v2.1.3...v3.0.0) (2020-09-12)


### ⚠ BREAKING CHANGES

* minimum supported `Node.js` version is `10.13`

### Bug Fixes

* `loadModule` and `fs` are now available in a loader context ([#88](https://github.com/webpack-contrib/thread-loader/issues/88)) ([ea5c9ad](https://github.com/webpack-contrib/thread-loader/commit/ea5c9ad8ffd3898e1fe136cc3cf371b3d15e3f97))
* `getResolve` is now available in a loader context ([#99](https://github.com/webpack-contrib/thread-loader/issues/99)) ([16bbc23](https://github.com/webpack-contrib/thread-loader/commit/16bbc236dfdc26c857c97c8c005bbad6883c49ed))

<a name="2.1.3"></a>
## [2.1.3](https://github.com/webpack-contrib/thread-loader/compare/v2.1.2...v2.1.3) (2019-08-08)


### Bug Fixes

* correct default for workerParallelJobs option ([#74](https://github.com/webpack-contrib/thread-loader/issues/74)) ([79758d0](https://github.com/webpack-contrib/thread-loader/commit/79758d0))
* do not allow empty or invalid node args when spin up child process ([#73](https://github.com/webpack-contrib/thread-loader/issues/73)) ([b02d503](https://github.com/webpack-contrib/thread-loader/commit/b02d503))



<a name="2.1.2"></a>
## [2.1.2](https://github.com/webpack-contrib/thread-loader/compare/v2.1.1...v2.1.2) (2019-01-25)


### Bug Fixes

* lifecycle handling for signals



<a name="2.1.1"></a>
## [2.1.1](https://github.com/webpack-contrib/thread-loader/compare/v2.1.0...v2.1.1) (2018-12-21)


### Performance Improvements

* use `neo-async` instead of `async` ([#54](https://github.com/webpack-contrib/thread-loader/issues/54)) ([d3a6664](https://github.com/webpack-contrib/thread-loader/commit/d3a6664))



<a name="2.1.0"></a>
# [2.1.0](https://github.com/webpack-contrib/thread-loader/compare/v2.0.2...v2.1.0) (2018-12-21)


### Features

* add poolRespawn flag to speed up incremental builds ([#52](https://github.com/webpack-contrib/thread-loader/issues/52)) ([76535bf](https://github.com/webpack-contrib/thread-loader/commit/76535bf))



<a name="2.0.2"></a>
## [2.0.2](https://github.com/webpack-contrib/thread-loader/compare/v2.0.1...v2.0.2) (2018-12-20)


### Bug Fixes

* build hang ([#53](https://github.com/webpack-contrib/thread-loader/issues/53)) ([fa02b60](https://github.com/webpack-contrib/thread-loader/commit/fa02b60))



<a name="2.0.1"></a>
## [2.0.1](https://github.com/webpack-contrib/thread-loader/compare/v2.0.0...v2.0.1) (2018-12-19)


### Bug Fixes

* memory leaks, worker and main process lifecycles ([#51](https://github.com/webpack-contrib/thread-loader/issues/51)) ([f10fe55](https://github.com/webpack-contrib/thread-loader/commit/f10fe55))



<a name="2.0.0"></a>
## [2.0.0](https://github.com/webpack-contrib/thread-loader/compare/v1.2.0...v2.0.0) (2018-12-18)


### Bug Fixes

* calculate number of workers correctly ([#49](https://github.com/webpack-contrib/thread-loader/issues/49)) ([fcbd813](https://github.com/webpack-contrib/thread-loader/commit/fcbd813))
* check on `undefined` for `worker.stdio` ([#45](https://github.com/webpack-contrib/thread-loader/issues/45)) ([c891a9c](https://github.com/webpack-contrib/thread-loader/commit/c891a9c))
* listen `end` events ([#42](https://github.com/webpack-contrib/thread-loader/issues/42)) ([0f87683](https://github.com/webpack-contrib/thread-loader/commit/0f87683))


### BREAKING CHANGE

* drop support for node < 6.9



<a name="1.2.0"></a>
# [1.2.0](https://github.com/webpack-contrib/thread-loader/compare/v1.1.5...v1.2.0) (2018-07-27)


### Features

* add target, minimize and resourceQuery into context ([#25](https://github.com/webpack-contrib/thread-loader/issues/25)) ([f3c7a2c](https://github.com/webpack-contrib/thread-loader/commit/f3c7a2c))



<a name="1.1.5"></a>
## [1.1.5](https://github.com/webpack-contrib/thread-loader/compare/v1.1.4...v1.1.5) (2018-02-26)


### Bug Fixes

* **package:** add `webpack >= 4` (`peerDependencies`) ([#22](https://github.com/webpack-contrib/thread-loader/issues/22)) ([9345756](https://github.com/webpack-contrib/thread-loader/commit/9345756))
* **WorkerError:** handle undefined `error` stacks ([#20](https://github.com/webpack-contrib/thread-loader/issues/20)) ([6fb5daf](https://github.com/webpack-contrib/thread-loader/commit/6fb5daf))



<a name="1.1.4"></a>
## [1.1.4](https://github.com/webpack-contrib/thread-loader/compare/v1.1.3...v1.1.4) (2018-02-21)


### Bug Fixes

* **index:** add `webpack >= v4.0.0` support ([#16](https://github.com/webpack-contrib/thread-loader/issues/16)) ([5d33937](https://github.com/webpack-contrib/thread-loader/commit/5d33937))



<a name="1.1.3"></a>
## [1.1.3](https://github.com/webpack-contrib/thread-loader/compare/v1.1.2...v1.1.3) (2018-02-07)


### Bug Fixes

* **WorkerPool:** trace stacks to avoid duplicated `err.messages` from workers ([#13](https://github.com/webpack-contrib/thread-loader/issues/13)) ([80dda4f](https://github.com/webpack-contrib/thread-loader/commit/80dda4f))



<a name="1.1.2"></a>
## [1.1.2](https://github.com/webpack-contrib/thread-loader/compare/v1.1.1...v1.1.2) (2017-10-09)


### Bug Fixes

* **readBuffer:** handle 0-byte reads ([c7ca960](https://github.com/webpack-contrib/thread-loader/commit/c7ca960))



<a name="1.1.1"></a>
## [1.1.1](https://github.com/webpack-contrib/thread-loader/compare/v1.1.0...v1.1.1) (2017-08-28)


### Bug Fixes

* **context:** Pass context to loader ([29ced70](https://github.com/webpack-contrib/thread-loader/commit/29ced70))
* **deps:** pass along result for dependencies ([19832ec](https://github.com/webpack-contrib/thread-loader/commit/19832ec))
* **example:** fix for broken sass and add watch ([47ba43e](https://github.com/webpack-contrib/thread-loader/commit/47ba43e))



<a name="1.1.0"></a>
# [1.1.0](https://github.com/webpack-contrib/thread-loader/compare/v1.0.3...v1.1.0) (2017-07-14)


### Features

* **pool:** add warmup method ([a0ce440](https://github.com/webpack-contrib/thread-loader/commit/a0ce440))



<a name="1.0.3"></a>
## [1.0.3](https://github.com/webpack-contrib/thread-loader/compare/v1.0.2...v1.0.3) (2017-05-27)


### Bug Fixes

* **resolve:** fix passing error to worker ([6561f57](https://github.com/webpack-contrib/thread-loader/commit/6561f57))



<a name="1.0.2"></a>
## [1.0.2](https://github.com/webpack-contrib/thread-loader/compare/v1.0.1...v1.0.2) (2017-05-27)


### Bug Fixes

* **resolve:** fix incorrect method for sending message ([bb92a28](https://github.com/webpack-contrib/thread-loader/commit/bb92a28))



<a name="1.0.1"></a>
## 1.0.1 (2017-04-28)



# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

x.x.x / <year>-<month>-<day>
==================

  * Bug fix -
  * Feature -
  * Chore -
  * Docs -
