// Package webauthn contains the API functionality of the library. After creating and configuring a webauthn object,
// users can call the object to create and validate web authentication credentials.
//
// This documentation section highlights key functions within the library which are recommended and often have
// examples attached. Functions which are discouraged due to their lack of functionality are expressly not documented
// here, and you're on your own with these functions. Generally speaking, if the function is not documented here, it is
// either used by another function documented here, and it hides one of the arguments or return values, or it is lower
// level logic only intended for advanced use cases.
//
// The [New] function is a key function in creating a new instance of a WebAuthn Relying Party which is required to
// perform most actions.
//
// To start the credential creation ceremony, the [WebAuthn.BeginMediatedRegistration] or [WebAuthn.BeginRegistration]
// functions are used which returns [*SessionData] and a [*protocol.CredentialCreation] struct which can be easily
// serialized as JSON for the frontend library/logic. The [*SessionData] must be saved in a way which allows the
// implementer to restore it later. This [*SessionData] should be safely anchored to a user agent without allowing the
// user agent to modify the contents (i.e. opaque session cookie).
//
// To finish the credential creation ceremony, the [WebAuthn.FinishRegistration] function can be used. This function
// requires a [*http.Request] and performs all the necessary and requested validations. If you have other requirements,
// you can use [protocol.ParseCredentialCreationResponseBody] or [protocol.ParseCredentialCreationResponseBytes] which
// require an [io.Reader] or byte array respectively, then use [WebAuthn.CreateCredential] to
// perform validations against the [*protocol.ParsedCredentialCreationData] and saved [*SessionData] and finalize the
// process. For complete customizability, just produce the [*protocol.ParsedCredentialCreationData] with a custom parser
// and provide it to [WebAuthn.CreateCredential].
//
// To start a Passkey login ceremony, the [WebAuthn.BeginDiscoverableMediatedLogin] or [WebAuthn.BeginDiscoverableLogin]
// functions are used which returns [*SessionData] and a [*protocol.CredentialAssertion] struct which can easily be
// serialized as JSON for the frontend library/logic. The [*SessionData] should be safely handled as previously described.
//
// To finish a Passkey login ceremony, the [WebAuthn.FinishPasskeyLogin] function can be used. This function requires a
// [*http.Request] and performs all the necessary validations. If you have other requirements, you can use the
// [protocol.ParseCredentialRequestResponseBody] or [protocol.ParseCredentialRequestResponseBytes] which require an
// [io.Reader] or byte array respectively, then use [WebAuthn.ValidatePasskeyLogin] to perform validations against the
// [*protocol.ParsedCredentialAssertionData] and saved [*SessionData] and finalize the process. For complete customizabilty,
// just produce the [protocol.ParsedCredentialAssertionData] with a custom parser and provide it to
// [WebAuthn.ValidatePasskeyLogin].
//
// To start a Multi-Factor login ceremony, the [WebAuthn.BeginMediatedLogin] or [WebAuthn.BeginLogin]
// functions are used which returns [SessionData] and a [*protocol.CredentialAssertion] struct which can easily be
// serialized as JSON for the frontend library/logic. The [*SessionData] should be safely handled as previously described.
//
// To finish a Multi-Factor login ceremony, the [WebAuthn.FinishLogin] function can be used. This function requires a
// [*http.Request] and performs all the necessary validations. If you have other requirements, you can use the
// [protocol.ParseCredentialRequestResponseBody] or [protocol.ParseCredentialRequestResponseBytes] which require an
// [io.Reader] or byte array respectively, then use [WebAuthn.ValidateLogin] to perform validations against the
// [*protocol.ParsedCredentialAssertionData] and saved [*SessionData] and finalize the process. For complete customizabilty,
// just produce the [protocol.ParsedCredentialAssertionData] with a custom parser and provide it to
// [WebAuthn.ValidateLogin].
package webauthn
