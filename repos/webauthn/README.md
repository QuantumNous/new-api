# WebAuthn Library

[![GoDoc](https://godoc.org/github.com/go-webauthn/webauthn?status.svg)](https://godoc.org/github.com/go-webauthn/webauthn)
[![Go Report Card](https://goreportcard.com/badge/github.com/go-webauthn/webauthn)](https://goreportcard.com/report/github.com/go-webauthn/webauthn)


This library is meant to handle [Web Authentication](https://www.w3.org/TR/webauthn) for Go apps that wish to implement 
a multi-factor authentication, passwordless, or usernameless solution for users. This library conforms as much as
possible to the guidelines and implementation procedures outlined by the relevant specifications and is conformance
tested against the conformance tools.

## Go Version Support Policy

This library; unless otherwise explicitly expressed; will officially support versions of go which are currently
supported by the go maintainers (usually 3 minor versions) with a brief transition time (usually 1 patch release of go,
for example if go 1.21.0 is released, we will likely still support go 1.17 until go 1.21.1 is released). These specific
rules apply at the time of a published release.

This library in our opinion handles a critical element of security in a dependent project and we aim to avoid backwards
compatibility at the cost of security wherever possible. We also consider this especially important in a language like
go where their backwards compatibility when upgrading the compile tools is usually flawless.

This policy means that users who wish to build this with older versions of go may find there are features being used
which are not available in that version. The current intentionally supported versions of go are as follows:

- go 1.25
- go 1.24
- ~~go 1.23~~ (not supported by golang.org/x/crypto v0.42.0)

## Status

This library is still version 0, as per Semantic Versioning 2.0 rules there may be breaking changes without warning. 
While we strive to avoid such changes and strive to notify users they may be unavoidable.

## Quickstart

`go get github.com/go-webauthn/webauthn` and initialize it in your application with basic configuration values. 

Make sure your `user` model is able to handle the interface functions laid out in `webauthn/types.go`. This means also 
supporting the storage and retrieval of the credential and authenticator structs in `webauthn/credential.go` and 
`webauthn/authenticator.go`, respectively.

## Notable Changes

The notable breaking changes made by this library are documented in the [breaking changes](BREAKING.md) documentation.

## Documentation

The intent is to move all documentation into the [go docs], and this is the location we'd recommend checking.

## Examples

The examples are documented in the [go docs]. 

## Credential Record

The WebAuthn Level 3 specification describes the Credential Record which includes several required and optional elements
that you should store for. See [§ 4 Terminology](https://www.w3.org/TR/webauthn-3/#credential-record) for details.

This section describes this element.

The fields listed in the specification have corresponding fields in the [webauthn.Credential] struct. See the below
table for more information. We also include JSON mappings for those that wish to just store these values as JSON.

|    Specification Field    |       Library Field        |         JSON Field         |                                           Notes                                           |
|:-------------------------:|:--------------------------:|:--------------------------:|:-----------------------------------------------------------------------------------------:|
|           type            |            N/A             |            N/A             |                       This field is always `publicKey` for WebAuthn                       |
|            id             |             ID             |             id             |                                                                                           |
|         publicKey         |         PublicKey          |         publicKey          |                                                                                           |
|     attestationFormat     |      AttestationType       |      attestationType       |           This field is currently named incorrectly and this will be corrected.           |
|         signCount         |  Authenticator.SignCount   |  authenticator.signCount   |                                                                                           |
|        transports         |         Transport          |         transport          |                                                                                           |
|       uvInitialized       |     Flags.UserVerified     |     flags.userVerified     |                                                                                           |
|      backupEligible       |    Flags.BackupEligible    |    flags.backupEligible    |                                                                                           |
|        backupState        |     Flags.BackupState      |     flags.backupState      |                                                                                           |
|     attestationObject     |     Attestation.Object     |     attestation.object     | This field is a composite of the attestationObject and the relevant values to validate it |
| attestationClientDataJSON | Attestation.ClientDataJSON | attestation.clientDataJSON |                                                                                           |

### Flags

It's important to note that the recommendations and requirements for flag storage have changed over the course of the
evolution of the WebAuthn specification. We at the present time only make the flags classified like this available for
easy storage however we also make the Protocol Value available. At such a time as these recommendations or requirements
change we will adapt accordingly. The Protocol Value is a raw representation of the flags and as such is resistant to
breaking changes whereas the other flags or lack thereof may not be. 

Implementers are therefore encouraged to use
[func (CredentialFlags) ProtocolValue](https://pkg.go.dev/github.com/go-webauthn/webauthn/webauthn#CredentialFlags.ProtocolValue)
to retrieve the raw value and 
[webauthn.NewCredentialFlags](https://pkg.go.dev/github.com/go-webauthn/webauthn/webauthn#NewCredentialFlags) to 
restore it; and instead of using the individual flags to store the value store the Protocol Value, and only store the
individual flags as a means to perform compliance related decisions.

### Storage

It is also important to note that restoring the [webauthn.Credential] with the correct values will likely affect the
validity of the [webauthn.Credential], i.e. if some values are not restored the [webauthn.Credential] may fail
validation in this scenario.

### Verification

As long as the [webauthn.Credential] struct has exactly the same values when restored the [Credential Verify] function 
can be leveraged to verify the credential against the [metadata.Provider]. This can be either done during registration,
on every login, or with a audit schedule.

In addition to using the [Credential Verify] function the 
[webauthn.Config](https://pkg.go.dev/github.com/go-webauthn/webauthn/webauthn#Config) can contain a provider which will
process all registrations automatically.

At this time no tooling exists to verify the credential automatically outside the registration flow. Implementation of
this is considered domain logic and beyond the scope of what we provide documentation for; we just provide the necessary
tooling to implement this yourself.

## Acknowledgements

We graciously acknowledge the original authors of this library [github.com/duo-labs/webauthn] for their amazing
implementation. In particular we'd like to acknowledge [Nick Steele](https://github.com/nicksteele) who not only created
the original library, but maintained it, and has been an active member of the WebAuthn Working Group quite some time. 
Without their amazing work this library could not exist.

[github.com/duo-labs/webauthn]: https://github.com/duo-labs/webauthn
[webauthn.Credential]: https://pkg.go.dev/github.com/go-webauthn/webauthn/webauthn#Credential
[metadata.Provider]: https://pkg.go.dev/github.com/go-webauthn/webauthn/metadata#Provider
[Credential Verify]: https://pkg.go.dev/github.com/go-webauthn/webauthn/webauthn#Credential.Verify
[go docs]: https://pkg.go.dev/github.com/go-webauthn/webauthn/webauthn