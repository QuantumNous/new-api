package protocol

// CredentialEntity represents the PublicKeyCredentialEntity IDL and it describes a user account, or a WebAuthn Relying
// Party with which a public key credential is associated.
//
// Specification: §5.4.1. Public Key Entity Description (https://www.w3.org/TR/webauthn/#dictionary-pkcredentialentity)
type CredentialEntity struct {
	// A human-palatable name for the entity. Its function depends on what the PublicKeyCredentialEntity represents:
	//
	// When inherited by PublicKeyCredentialRpEntity it is a human-palatable identifier for the Relying Party,
	// intended only for display. For example, "ACME Corporation", "Wonderful Widgets, Inc." or "ОАО Примертех".
	//
	// When inherited by PublicKeyCredentialUserEntity, it is a human-palatable identifier for a user account. It is
	// intended only for display, i.e., aiding the user in determining the difference between user accounts with similar
	// displayNames. For example, "alexm", "alex.p.mueller@example.com" or "+14255551234".
	Name string `json:"name"`
}

// The RelyingPartyEntity represents the PublicKeyCredentialRpEntity IDL and is used to supply additional Relying Party
// attributes when creating a new credential.
//
// Specification: §5.4.2. Relying Party Parameters for Credential Generation (https://www.w3.org/TR/webauthn/#dictionary-rp-credential-params)
type RelyingPartyEntity struct {
	CredentialEntity

	// A unique identifier for the Relying Party entity, which sets the RP ID.
	ID string `json:"id"`
}

// The UserEntity represents the PublicKeyCredentialUserEntity IDL and is used to supply additional user account
// attributes when creating a new credential.
//
// Specification: §5.4.3 User Account Parameters for Credential Generation (https://www.w3.org/TR/webauthn/#dictdef-publickeycredentialuserentity)
type UserEntity struct {
	CredentialEntity
	// A human-palatable name for the user account, intended only for display.
	// For example, "Alex P. Müller" or "田中 倫". The Relying Party SHOULD let
	// the user choose this, and SHOULD NOT restrict the choice more than necessary.
	DisplayName string `json:"displayName"`

	// ID is the user handle of the user account entity. To ensure secure operation,
	// authentication and authorization decisions MUST be made on the basis of this id
	// member, not the displayName nor name members. See Section 6.1 of
	// [RFC8266](https://www.w3.org/TR/webauthn/#biblio-rfc8266).
	ID any `json:"id"`
}
