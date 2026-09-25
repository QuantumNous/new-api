package metadata

// PasskeyAuthenticator is a type that represents the schema from the Passkey Developer AAGUID listing.
//
// See: https://github.com/passkeydeveloper/passkey-authenticator-aaguids
type PasskeyAuthenticator map[string]PassKeyAuthenticatorAAGUID

// PassKeyAuthenticatorAAGUID is a type that represents the individual schema entry from the Passkey Developer AAGUID
// listing. Used with [PasskeyAuthenticator].
//
// See: https://github.com/passkeydeveloper/passkey-authenticator-aaguids
type PassKeyAuthenticatorAAGUID struct {
	Name      string `json:"name"`
	IconDark  string `json:"icon_dark,omitempty"`
	IconLight string `json:"icon_light,omitempty"`
}
