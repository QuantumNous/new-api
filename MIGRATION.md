# Migration Guide

This is a guide on migration from `github.com/duo-labs/webauthn`. As discussed in [this issue](https://github.com/duo-labs/webauthn/issues/155)
this library is tentatively the natural successor to the amazing `github.com/duo-labs/webauthn`.

### Differences

There are several differences between the upstream library and this one (items marked with a strike-through indicate
they are also solved/merged in the upstream fork now). We will aim to keep this list updated:

* There are minimal breaking changes between this library and the upstream one. Identified breaking changes exist in the
  following commits:
    * ~~Change of protocol.ResidentKeyUnrequired() to protocol.ResidentKeyNotRequired() [5ad54f8](https://github.com/go-webauthn/webauthn/commit/5ad54f89952eb238a7d6e10ed2d443738351d67f).~~
      This method has been restored as a deprecated function making the migration path clearer.
* This library is versioned with branches per minor version for back-porting fixes.
* This library releases tagged versions.
* This library has a smaller dependency tree because of [c561447](https://github.com/go-webauthn/webauthn/commit/c561447e218d73421476565a3d66ab6dc934966c).
* The following upstream issues have been resolved:
    * [Issue #76](https://github.com/duo-labs/webauthn/issues/76) was fixed related to the google.golang.org/grpc/naming dependency was fixed by merging
      [c561447](https://github.com/go-webauthn/webauthn/commit/c561447e218d73421476565a3d66ab6dc934966c)
      which migrates from the github.com/cloudflare/cfssl module to a fork of the features used by this module implemented
      in [1edcf14](https://github.com/go-webauthn/revoke/commit/1edcf14a748f88f41663433f336e07604f5e72c1).
* The following pull requests in the upstream repository are merged in one form or another:
    * ~~[Pull Request #132](https://github.com/duo-labs/webauthn/pull/132) was merged in [401a3f6](https://github.com/go-webauthn/webauthn/commit/401a3f63b5fb3c91faa52c56a9295b78d62e039f).~~
    * ~~[Pull Request #131](https://github.com/duo-labs/webauthn/pull/131) was merged in [509e08f](https://github.com/go-webauthn/webauthn/commit/509e08fb364c78be30067a93d976730a8fe4a656) (cherry-pick squashed).~~
    * [Pull Request #130](https://github.com/duo-labs/webauthn/pull/130) was merged in [729227d](https://github.com/go-webauthn/webauthn/commit/729227d1ec0504ebb518f38e72bcd10ae68c4130) (v0.2.x) and [93a942a](https://github.com/go-webauthn/webauthn/commit/93a942a90dbb82d997e1ed2945ba41b37d47890f) (v0.1.x).
    * ~~[Pull Request #122](https://github.com/duo-labs/webauthn/pull/122) was merged in [2bbb113](https://github.com/go-webauthn/webauthn/commit/2bbb113b333b775d2d7c5551b7220f713f666f00).~~
    * ~~[Pull Request #116](https://github.com/duo-labs/webauthn/pull/116) was (effectively) merged in [d64d2ba](https://github.com/go-webauthn/webauthn/commit/d64d2ba780240964310c7f5862add333bc659348).~~
* The following additional features have been added:
  * Support for the MDS3 in [697bc4c](https://github.com/go-webauthn/webauthn/commit/697bc4cb16d3cfc8755bd946b55b9699e76a4510).
  * Migration to the Google TPM library in [cdfc867](https://github.com/go-webauthn/webauthn/commit/cdfc8674dbeaed1b48b28bc87c364dffe132b104).
  * Migration away from `github.com/cloudflare/cfssl` in [c561447](https://github.com/go-webauthn/webauthn/commit/c561447e218d73421476565a3d66ab6dc934966c).
* The following misc fixes have been merged:
    * Ensuring the credential ID length is not too long in [b3b93ac](https://github.com/go-webauthn/webauthn/commit/b3b93ac3770a26a92adbcd4b527bbb391127931b) (v0.2.x) and [35287ea](https://github.com/go-webauthn/webauthn/commit/35287ea54b50b1f553f3cc0f0f5527039f375e2c) (v0.1.x).
    * Ensuring errors are effectively checked, ineffectual checks are not done, and general linting fixes in [90be0fe](https://github.com/go-webauthn/webauthn/commit/90be0fe276222bd574cf19856081979789ce9fca).
    * A potential nil pointer error in ParseFIDOPublicKey in [3551cfa](https://github.com/go-webauthn/webauthn/commit/3551cfae24f258cd9c978a73711fb9551f82d1e4).

### Guide

At the present time the only adjustment that should need to be made is as follows:

- Follow the [Quickstart](README.md#quickstart).
- Replace all instances of `github.com/duo-labs/webauthn` with `github.com/go-webauthn/webauthn`.

If you believe this is an inaccurate guide please create a
[bug report](https://github.com/go-webauthn/webauthn/issues/new?assignees=&labels=type%2Fpotential-bug%2Cstatus%2Fneeds-triage%2Cpriority%2Fnormal&template=bug-report.yml) 
or [start a discussion](https://github.com/go-webauthn/webauthn/discussions/new).