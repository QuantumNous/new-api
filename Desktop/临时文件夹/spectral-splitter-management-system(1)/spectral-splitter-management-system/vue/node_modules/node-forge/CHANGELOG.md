Forge ChangeLog
===============

## 1.3.1 - 2022-03-29

### Fixes
- RFC 3447 and RFC 8017 allow for optional `DigestAlgorithm` `NULL` parameters
  for `sha*` algorithms and require `NULL` paramters for `md2` and `md5`
  algorithms.

## 1.3.0 - 2022-03-17

### Security
- Three RSA PKCS#1 v1.5 signature verification issues were reported by Moosa
  Yahyazadeh (moosa-yahyazadeh@uiowa.edu).
- **HIGH**: Leniency in checking `digestAlgorithm` structure can lead to
  signature forgery.
  - The code is lenient in checking the digest algorithm structure. This can
    allow a crafted structure that steals padding bytes and uses unchecked
    portion of the PKCS#1 encoded message to forge a signature when a low
    public exponent is being used. For more information, please see
    ["Bleichenbacher's RSA signature forgery based on implementation
    error"](https://mailarchive.ietf.org/arch/msg/openpgp/5rnE9ZRN1AokBVj3VqblGlP63QE/)
    by Hal Finney.
  - CVE ID: [CVE-2022-24771](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2022-24771)
  - GHSA ID: [GHSA-cfm4-qjh2-4765](https://github.com/digitalbazaar/forge/security/advisories/GHSA-cfm4-qjh2-4765)
- **HIGH**: Failing to check tailing garbage bytes can lead to signature
  forgery.
  - The code does not check for tailing garbage bytes after decoding a
    `DigestInfo` ASN.1 structure. This can allow padding bytes to be removed
    and garbage data added to forge a signature when a low public exponent is
    being used.  For more information, please see ["Bleichenbacher's RSA
    signature forgery based on implementation
    error"](https://mailarchive.ietf.org/arch/msg/openpgp/5rnE9ZRN1AokBVj3VqblGlP63QE/)
    by Hal Finney.
  - CVE ID: [CVE-2022-24772](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2022-24772)
  - GHSA ID: [GHSA-x4jg-mjrx-434g](https://github.com/digitalbazaar/forge/security/advisories/GHSA-x4jg-mjrx-434g)
- **MEDIUM**: Leniency in checking type octet.
  - `DigestInfo` is not properly checked for proper ASN.1 structure. This can
    lead to successful verification with signatures that contain invalid
    structures but a valid digest.
  - CVE ID: [CVE-2022-24773](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2022-24773)
  - GHSA ID: [GHSA-2r2c-g63r-vccr](https://github.com/digitalbazaar/forge/security/advisories/GHSA-2r2c-g63r-vccr)

### Fixed
- [asn1] Add fallback to pretty print invalid UTF8 data.
- [asn1] `fromDer` is now more strict and will default to ensuring all input
  bytes are parsed or throw an error. A new option `parseAllBytes` can disable
  this behavior.
  - **NOTE**: The previous behavior is being changed since it can lead to
    security issues with crafted inputs. It is possible that code doing custom
    DER parsing may need to adapt to this new behavior and optional flag.
- [rsa] Add and use a validator to check for proper structure of parsed ASN.1
  `RSASSA-PKCS-v1_5` `DigestInfo` data. Additionally check that the hash
  algorithm identifier is a known value from RFC 8017
  `PKCS1-v1-5DigestAlgorithms`. An invalid `DigestInfo` or algorithm identifier
  will now throw an error.
  - **NOTE**: The previous lenient behavior is being changed to be more strict
    since it could lead to security issues with crafted inputs. It is possible
    that code may have to handle the errors from these stricter checks.

### Added
- [oid] Added missing RFC 8017 PKCS1-v1-5DigestAlgorithms algorithm
  identifiers:
  - `1.2.840.113549.2.2` / `md2`
  - `2.16.840.1.101.3.4.2.4` / `sha224`
  - `2.16.840.1.101.3.4.2.5` / `sha512-224`
  - `2.16.840.1.101.3.4.2.6` / `sha512-256`

## 1.2.1 - 2022-01-11

### Fixed
- [tests]: Load entire module to improve top-level testing and coverage
  reporting.
- [log]: Refactor logging setup to avoid use of `URLSearchParams`.

## 1.2.0 - 2022-01-07

### Fixed
- [x509] 'Expected' and 'Actual' issuers were backwards in verification failure
  message.

### Added
- [oid,x509]: Added OID `1.3.14.3.2.29 / sha1WithRSASignature` for sha1 with
  RSA. Considered a deprecated equivalent to `1.2.840.113549.1.1.5 /
  sha1WithRSAEncryption`. See [discussion and
  links](https://github.com/digitalbazaar/forge/issues/825).

### Changed
- [x509]: Reduce duplicate code. Add helper function to create a signature
  digest given an signature algorithm OID. Add helper function to verify
  signatures.

## 1.1.0 - 2022-01-06

### Fixed
- [x509]: Correctly compute certificate issuer and subject hashes to match
  behavior of openssl.
- [pem]: Accept certificate requests with "NEW" in the label. "BEGIN NEW
  CERTIFICATE REQUEST" handled as "BEGIN CERTIFICATE REQUEST".

## 1.0.0 - 2022-01-04

### Notes
- **1.0.0**!
- This project is over a decade old! Time for a 1.0.0 release.
- The URL related changes may expose bugs in some of the networking related
  code (unrelated to the much wider used cryptography code). The automated and
  manual test coverage for this code is weak at best. Issues or patches to
  update the code or tests would be appreciated.

### Removed
- **SECURITY**, **BREAKING**: Remove `forge.debug` API. The API has the
  potential for prototype pollution. This API was only briefly used by the
  maintainers for internal project debug purposes and was never intended to be
  used with untrusted user inputs. This API was not documented or advertised
  and is being removed rather than fixed.
- **SECURITY**, **BREAKING**: Remove `forge.util.parseUrl()` (and
  `forge.http.parseUrl` alias) and use the [WHATWG URL
  Standard](https://url.spec.whatwg.org/). `URL` is supported by modern browers
  and modern Node.js. This change is needed to address URL parsing security
  issues. If `forge.util.parseUrl()` is used directly or through `forge.xhr` or
  `forge.http` APIs, and support is needed for environments without `URL`
  support, then a polyfill must be used.
- **BREAKING**: Remove `forge.task` API. This API was never used, documented,
  or advertised by the maintainers. If anyone was using this API and wishes to
  continue development it in other project, please let the maintainers know.
  Due to use in the test suite, a modified version is located in
  `tests/support/`.
- **BREAKING**: Remove `forge.util.makeLink`, `forge.util.makeRequest`,
  `forge.util.parseFragment`, `forge.util.getQueryVariables`. Replace with
  `URL`, `URLSearchParams`, and custom code as needed.

### Changed
- **BREAKING**: Increase supported Node.js version to 6.13.0 for URL support.
- **BREAKING**: Renamed `master` branch to `main`.
- **BREAKING**: Release process updated to use tooling that prefixes versions
  with `v`. Other tools, scripts, or scanners may need to adapt.
- **BREAKING**: Remove docs related to Bower and
  [forge-dist](https://github.com/digitalbazaar/forge-dist). Install using
  [another method](./README.md#installation).

### Added
- OIDs for `surname`, `title`, and `givenName`.

### Fixed
- **BREAKING**: OID 2.5.4.5 name fixed from `serialName` to `serialNumber`.
  Depending on how applications used this id to name association it could cause
  compatibility issues.

## 0.10.0 - 2020-09-01

### Changed
- **BREAKING**: Node.js 4 no longer supported. The code *may* still work, and
  non-invasive patches to keep it working will be considered. However, more
  modern tools no longer support old Node.js versions making testing difficult.

### Removed
- **BREAKING**: Remove `util.getPath`, `util.setPath`, and `util.deletePath`.
  `util.setPath` had a potential prototype pollution security issue when used
  with unsafe inputs. These functions are not used by `forge` itself. They date
  from an early time when `forge` was targeted at providing general helper
  functions. The library direction changed to be more focused on cryptography.
  Many other excellent libraries are more suitable for general utilities. If
  you need a replacement for these functions, consider `get`, `set`, and `unset`
  from [lodash](https://lodash.com/). But also consider the potential similar
  security issues with those APIs.

## 0.9.2 - 2020-09-01

### Changed
- Added `util.setPath` security note to function docs and to README.

### Notes
- **SECURITY**: The `util.setPath` function has the potential to cause
  prototype pollution if used with unsafe input.
  - This function is **not** used internally by `forge`.
  - The rest of the library is unaffected by this issue.
  - **Do not** use unsafe input with this function.
  - Usage with known input should function as expected. (Including input
    intentionally using potentially problematic keys.)
  - No code changes will be made to address this issue in 0.9.x. The current
    behavior *could* be considered a feature rather than a security issue.
    0.10.0 will be released that removes `util.getPath` and `util.setPath`.
    Consider `get` and `set` from [lodash](https://lodash.com/) if you need
    replacements. But also consider the potential similar security issues with
    those APIs.
  - https://snyk.io/vuln/SNYK-JS-NODEFORGE-598677
  - https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2020-7720

## 0.9.1 - 2019-09-26

### Fixed
- Ensure DES-CBC given IV is long enough for block size.

## 0.9.0 - 2019-09-04

### Added
- Add ed25519.publicKeyFromAsn1 and ed25519.privateKeyFromAsn1 APIs.
- A few OIDs used in EV certs.

### Fixed
- Improve ed25519 NativeBuffer check.

## 0.8.5 - 2019-06-18

### Fixed
- Remove use of `const`.

## 0.8.4 - 2019-05-22

### Changed
- Replace all instances of Node.js `new Buffer` with `Buffer.from` and `Buffer.alloc`.

## 0.8.3 - 2019-05-15

### Fixed
- Use basic character set for code.

## 0.8.2 - 2019-03-18

### Fixed
- Fix tag calculation when continuing an AES-GCM block.

### Changed
- Switch to eslint.

## 0.8.1 - 2019-02-23

### Fixed
- Fix off-by-1 bug with kem random generation.

## 0.8.0 - 2019-01-31

### Fixed
- Handle creation of certificates with `notBefore` and `notAfter` dates less
  than Jan 1, 1950 or greater than or equal to Jan 1, 2050.

### Added
- Add OID 2.5.4.13 "description".
- Add OID 2.16.840.1.113730.1.13 "nsComment".
  - Also handle extension when creating a certificate.
- `pki.verifyCertificateChain`:
  - Add `validityCheckDate` option to allow checking the certificate validity
    period against an arbitrary `Date` or `null` for no check at all. The
    current date is used by default.
- `tls.createConnection`:
  - Add `verifyOptions` option that passes through to
    `pki.verifyCertificateChain`. Can be used for the above `validityCheckDate`
    option.

### Changed
- Support WebCrypto API in web workers.
- `rsa.generateKeyPair`:
  - Use `crypto.generateKeyPair`/`crypto.generateKeyPairSync` on Node.js if
    available (10.12.0+) and not in pure JS mode.
  - Use JS fallback in `rsa.generateKeyPair` if `prng` option specified since
    this isn't supported by current native APIs.
  - Only run key generation comparison tests if keys will be deterministic.
- PhantomJS is deprecated, now using Headless Chrome with Karma.
- **Note**: Using Headless Chrome vs PhantomJS may cause newer JS features to
  slip into releases without proper support for older runtimes and browsers.
  Please report such issues and they will be addressed.
- `pki.verifyCertificateChain`:
  - Signature changed to `(caStore, chain, options)`. Older `(caStore, chain,
    verify)` signature is still supported. New style is to to pass in a
    `verify` option.

## 0.7.6 - 2018-08-14

### Added
- Test on Node.js 10.x.
- Support for PKCS#7 detached signatures.

### Changed
- Improve webpack/browser detection.

## 0.7.5 - 2018-03-30

### Fixed
- Remove use of `const`.

## 0.7.4 - 2018-03-07

### Fixed
- Potential regex denial of service in form.js.

### Added
- Support for ED25519.
- Support for baseN/base58.

## 0.7.3 - 2018-03-05

- Re-publish with npm 5.6.0 due to file timestamp issues.

## 0.7.2 - 2018-02-27

### Added
- Support verification of SHA-384 certificates.
- `1.2.840.10040.4.3'`/`dsa-with-sha1` OID.

### Fixed
- Support importing PKCS#7 data with no certificates. RFC 2315 sec 9.1 states
  certificates are optional.
- `asn1.equals` loop bug.
- Fortuna implementation bugs.

## 0.7.1 - 2017-03-27

### Fixed

- Fix digestLength for hashes based on SHA-512.

## 0.7.0 - 2017-02-07

### Fixed

- Fix test looping bugs so all tests are run.
- Improved ASN.1 parsing. Many failure cases eliminated. More sanity checks.
  Better behavior in default mode of parsing BIT STRINGs. Better handling of
  parsed BIT STRINGs in `toDer()`. More tests.
- Improve X.509 BIT STRING handling by using new capture modes.

### Changed

- Major refactor to use CommonJS plus a browser build system.
- Updated tests, examples, docs.
- Updated dependencies.
- Updated flash build system.
- Improve OID mapping code.
- Change test servers from Python to JavaScript.
- Improve PhantomJS support.
- Move Bower/bundle support to
  [forge-dist](https://github.com/digitalbazaar/forge-dist).
- **BREAKING**: Require minimal digest algorithm dependencies from individual
  modules.
- Enforce currently supported bit param values for byte buffer access. May be
  **BREAKING** for code that depended on unspecified and/or incorrect behavior.
- Improve `asn1.prettyPrint()` BIT STRING display.

### Added

- webpack bundler support via `npm run build`:
  - Builds `.js`, `.min.js`, and basic sourcemaps.
  - Basic build: `forge.js`.
  - Build with extra utils and networking support: `forge.all.js`.
  - Build WebWorker support: `prime.worker.js`.
- Browserify support in package.json.
- Karma browser testing.
- `forge.options` field.
- `forge.options.usePureJavaScript` flag.
- `forge.util.isNodejs` flag (used to select "native" APIs).
- Run PhantomJS tests in Travis-CI.
- Add "Donations" section to README.
- Add IRC to "Contact" section of README.
- Add "Security Considerations" section to README.
- Add pbkdf2 usePureJavaScript test.
- Add rsa.generateKeyPair async and usePureJavaScript tests.
- Add .editorconfig support.
- Add `md.all.js` which includes all digest algorithms.
- Add asn1 `equals()` and `copy()`.
- Add asn1 `validate()` capture options for BIT STRING contents and value.

### Removed

- **BREAKING**: Can no longer call `forge({...})` to create new instances.
- Remove a large amount of old cruft.

### Migration from 0.6.x to 0.7.x

- (all) If you used the feature to create a new forge instance with new
  configuration options you will need to rework your code. That ability has
  been removed due to implementation complexity. The main rare use was to set
  the option to use pure JavaScript. That is now available as a library global
  flag `forge.options.usePureJavaScript`.
- (npm,bower) If you used the default main file there is little to nothing to
  change.
- (npm) If you accessed a sub-resource like `forge/js/pki` you should either
  switch to just using the main `forge` and access `forge.pki` or update to
  `forge/lib/pki`.
- (bower) If you used a sub-resource like `forge/js/pki` you should switch to
  just using `forge` and access `forge.pki`. The bower release bundles
  everything in one minified file.
- (bower) A configured workerScript like
  `/bower_components/forge/js/prime.worker.js` will need to change to
  `/bower_components/forge/dist/prime.worker.min.js`.
- (all) If you used the networking support or flash socket support, you will
  need to use a custom build and/or adjust where files are loaded from. This
  functionality is not included in the bower distribution by default and is
  also now in a different directory.
- (all) The library should now directly support building custom bundles with
  webpack, browserify, or similar.
- (all) If building a custom bundle ensure the correct dependencies are
  included. In particular, note there is now a `md.all.js` file to include all
  digest algorithms. Individual files limit what they include by default to
  allow smaller custom builds. For instance, `pbdkf2.js` has a `sha1` default
  but does not include any algorithm files by default. This allows the
  possibility to include only `sha256` without the overhead of `sha1` and
  `sha512`.

### Notes

- This major update requires updating the version to 0.7.x. The existing
  work-in-progress "0.7.x" branch will be painfully rebased on top of this new
  0.7.x and moved forward to 0.8.x or later as needed.
- 0.7.x is a start of simplifying forge based on common issues and what has
  appeared to be the most common usage. Please file issues with feedback if the
  changes are problematic for your use cases.

## 0.6.x - 2016 and earlier

- See Git commit log or https://github.com/digitalbazaar/forge.
