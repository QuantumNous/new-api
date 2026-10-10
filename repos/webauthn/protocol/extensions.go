package protocol

// Extensions are discussed in §9. WebAuthn Extensions (https://www.w3.org/TR/webauthn/#extensions).

// For a list of commonly supported extensions, see §10. Defined Extensions
// (https://www.w3.org/TR/webauthn/#sctn-defined-extensions).

type AuthenticationExtensionsClientOutputs map[string]any

const (
	ExtensionAppID        = "appid"
	ExtensionAppIDExclude = "appidExclude"
)
