package protocol

import (
	"bytes"
	"encoding/binary"
	"fmt"

	"github.com/go-webauthn/webauthn/protocol/webauthncbor"
)

const (
	minAuthDataLength     = 37
	minAttestedAuthLength = 55
	maxCredentialIDLength = 1023
)

// AuthenticatorResponse represents the IDL with the same name.
//
// Authenticators respond to Relying Party requests by returning an object derived from the AuthenticatorResponse
// interface
//
// Specification: §5.2. Authenticator Responses (https://www.w3.org/TR/webauthn/#iface-authenticatorresponse)
type AuthenticatorResponse struct {
	// From the spec https://www.w3.org/TR/webauthn/#dom-authenticatorresponse-clientdatajson
	// This attribute contains a JSON serialization of the client data passed to the authenticator
	// by the client in its call to either create() or get().
	ClientDataJSON URLEncodedBase64 `json:"clientDataJSON"`
}

// AuthenticatorData represents the IDL with the same name.
//
// The authenticator data structure encodes contextual bindings made by the authenticator. These bindings are controlled
// by the authenticator itself, and derive their trust from the WebAuthn Relying Party's assessment of the security
// properties of the authenticator. In one extreme case, the authenticator may be embedded in the client, and its
// bindings may be no more trustworthy than the client data. At the other extreme, the authenticator may be a discrete
// entity with high-security hardware and software, connected to the client over a secure channel. In both cases, the
// Relying Party receives the authenticator data in the same format, and uses its knowledge of the authenticator to make
// trust decisions.
//
// The authenticator data has a compact but extensible encoding. This is desired since authenticators can be devices
// with limited capabilities and low power requirements, with much simpler software stacks than the client platform.
//
// Specification: §6.1. Authenticator Data (https://www.w3.org/TR/webauthn/#sctn-authenticator-data)
type AuthenticatorData struct {
	RPIDHash []byte                 `json:"rpid"`
	Flags    AuthenticatorFlags     `json:"flags"`
	Counter  uint32                 `json:"sign_count"`
	AttData  AttestedCredentialData `json:"att_data"`
	ExtData  []byte                 `json:"ext_data"`
}

type AttestedCredentialData struct {
	AAGUID       []byte `json:"aaguid"`
	CredentialID []byte `json:"credential_id"`

	// The raw credential public key bytes received from the attestation data. This is the CBOR representation of the
	// credentials public key.
	CredentialPublicKey []byte `json:"public_key"`
}

// CredentialMediationRequirement represents mediation requirements for clients. When making a request via get(options)
// or create(options), developers can set a case-by-case requirement for user mediation by choosing the appropriate
// CredentialMediationRequirement enum value.
//
// See https://www.w3.org/TR/credential-management-1/#mediation-requirements
type CredentialMediationRequirement string

const (
	// MediationDefault lets the browser choose the mediation flow completely as if it wasn't specified at all.
	MediationDefault CredentialMediationRequirement = ""

	// MediationSilent indicates user mediation is suppressed for the given operation. If the operation can be performed
	// without user involvement, wonderful. If user involvement is necessary, then the operation will return null rather
	// than involving the user.
	MediationSilent CredentialMediationRequirement = "silent"

	// MediationOptional indicates if credentials can be handed over for a given operation without user mediation, they
	// will be. If user mediation is required, then the user agent will involve the user in the decision.
	MediationOptional CredentialMediationRequirement = "optional"

	// MediationConditional indicates for get(), discovered credentials are presented to the user in a non-modal dialog
	// along with an indication of the origin which is requesting credentials. If the user makes a gesture outside of
	// the dialog, the dialog closes without resolving or rejecting the Promise returned by the get() method and without
	// causing a user-visible error condition. If the user makes a gesture that selects a credential, that credential is
	// returned to the caller. The prevent silent access flag is treated as being true regardless of its actual value:
	// the conditional behavior always involves user mediation of some sort if applicable credentials are discovered.
	MediationConditional CredentialMediationRequirement = "conditional"

	// MediationRequired indicates the user agent will not hand over credentials without user mediation, even if the
	// prevent silent access flag is unset for an origin.
	MediationRequired CredentialMediationRequirement = "required"
)

// AuthenticatorAttachment represents the IDL enum of the same name, and is used as part of the Authenticator Selection
// Criteria.
//
// This enumeration’s values describe authenticators' attachment modalities. Relying Parties use this to express a
// preferred authenticator attachment modality when calling navigator.credentials.create() to create a credential.
//
// If this member is present, eligible authenticators are filtered to only authenticators attached with the specified
// §5.4.5 Authenticator Attachment Enumeration (enum AuthenticatorAttachment). The value SHOULD be a member of
// AuthenticatorAttachment but client platforms MUST ignore unknown values, treating an unknown value as if the member
// does not exist.
//
// Specification: §5.4.4. Authenticator Selection Criteria (https://www.w3.org/TR/webauthn/#dom-authenticatorselectioncriteria-authenticatorattachment)
//
// Specification: §5.4.5. Authenticator Attachment Enumeration (https://www.w3.org/TR/webauthn/#enum-attachment)
type AuthenticatorAttachment string

const (
	// Platform represents a platform authenticator is attached using a client device-specific transport, called
	// platform attachment, and is usually not removable from the client device. A public key credential bound to a
	// platform authenticator is called a platform credential.
	Platform AuthenticatorAttachment = "platform"

	// CrossPlatform represents a roaming authenticator is attached using cross-platform transports, called
	// cross-platform attachment. Authenticators of this class are removable from, and can "roam" among, client devices.
	// A public key credential bound to a roaming authenticator is called a roaming credential.
	CrossPlatform AuthenticatorAttachment = "cross-platform"
)

// ResidentKeyRequirement represents the IDL of the same name.
//
// This enumeration’s values describe the Relying Party's requirements for client-side discoverable credentials
// (formerly known as resident credentials or resident keys).
//
// Specifies the extent to which the Relying Party desires to create a client-side discoverable credential. For
// historical reasons the naming retains the deprecated “resident” terminology. The value SHOULD be a member of
// ResidentKeyRequirement but client platforms MUST ignore unknown values, treating an unknown value as if the member
// does not exist. If no value is given then the effective value is required if requireResidentKey is true or
// discouraged if it is false or absent.
//
// Specification: §5.4.4. Authenticator Selection Criteria (https://www.w3.org/TR/webauthn/#dom-authenticatorselectioncriteria-residentkey)
//
// Specification: §5.4.6. Resident Key Requirement Enumeration (https://www.w3.org/TR/webauthn/#enumdef-residentkeyrequirement)
type ResidentKeyRequirement string

const (
	// ResidentKeyRequirementDiscouraged indicates the Relying Party prefers creating a server-side credential, but will
	// accept a client-side discoverable credential. This is the default.
	ResidentKeyRequirementDiscouraged ResidentKeyRequirement = "discouraged"

	// ResidentKeyRequirementPreferred indicates to the client we would prefer a discoverable credential.
	ResidentKeyRequirementPreferred ResidentKeyRequirement = "preferred"

	// ResidentKeyRequirementRequired indicates the Relying Party requires a client-side discoverable credential, and is
	// prepared to receive an error if a client-side discoverable credential cannot be created.
	ResidentKeyRequirementRequired ResidentKeyRequirement = "required"
)

// AuthenticatorTransport represents the IDL enum with the same name.
//
// Authenticators may implement various transports for communicating with clients. This enumeration defines hints as to
// how clients might communicate with a particular authenticator in order to obtain an assertion for a specific
// credential. Note that these hints represent the WebAuthn Relying Party's best belief as to how an authenticator may
// be reached. A Relying Party will typically learn of the supported transports for a public key credential via
// getTransports().
//
// Specification: §5.8.4. Authenticator Transport Enumeration (https://www.w3.org/TR/webauthn/#enumdef-authenticatortransport)
type AuthenticatorTransport string

const (
	// USB indicates the respective authenticator can be contacted over removable USB.
	USB AuthenticatorTransport = "usb"

	// NFC indicates the respective authenticator can be contacted over Near Field Communication (NFC).
	NFC AuthenticatorTransport = "nfc"

	// BLE indicates the respective authenticator can be contacted over Bluetooth Smart (Bluetooth Low Energy / BLE).
	BLE AuthenticatorTransport = "ble"

	// SmartCard indicates the respective authenticator can be contacted over ISO/IEC 7816 smart card with contacts.
	//
	// WebAuthn Level 3.
	SmartCard AuthenticatorTransport = "smart-card"

	// Hybrid indicates the respective authenticator can be contacted using a combination of (often separate)
	// data-transport and proximity mechanisms. This supports, for example, authentication on a desktop computer using
	// a smartphone.
	//
	// WebAuthn Level 3.
	Hybrid AuthenticatorTransport = "hybrid"

	// Internal indicates the respective authenticator is contacted using a client device-specific transport, i.e., it
	// is a platform authenticator. These authenticators are not removable from the client device.
	Internal AuthenticatorTransport = "internal"
)

// UserVerificationRequirement is a representation of the UserVerificationRequirement IDL enum.
//
// A WebAuthn Relying Party may require user verification for some of its operations but not for others,
// and may use this type to express its needs.
//
// Specification: §5.8.6. User Verification Requirement Enumeration (https://www.w3.org/TR/webauthn/#enum-userVerificationRequirement)
type UserVerificationRequirement string

const (
	// VerificationRequired User verification is required to create/release a credential.
	VerificationRequired UserVerificationRequirement = "required"

	// VerificationPreferred User verification is preferred to create/release a credential.
	VerificationPreferred UserVerificationRequirement = "preferred" // This is the default.

	// VerificationDiscouraged The authenticator should not verify the user for the credential.
	VerificationDiscouraged UserVerificationRequirement = "discouraged"
)

// AuthenticatorFlags A byte of information returned during during ceremonies in the
// authenticatorData that contains bits that give us information about the
// whether the user was present and/or verified during authentication, and whether
// there is attestation or extension data present. Bit 0 is the least significant bit.
//
// Specification: §6.1. Authenticator Data - Flags (https://www.w3.org/TR/webauthn/#flags)
type AuthenticatorFlags byte

// The bits that do not have flags are reserved for future use.
const (
	// FlagUserPresent Bit 00000001 in the byte sequence. Tells us if user is present. Also referred to as the UP flag.
	FlagUserPresent AuthenticatorFlags = 1 << iota // Referred to as UP.

	// FlagRFU1 is a reserved for future use flag.
	FlagRFU1

	// FlagUserVerified Bit 00000100 in the byte sequence. Tells us if user is verified
	// by the authenticator using a biometric or PIN. Also referred to as the UV flag.
	FlagUserVerified

	// FlagBackupEligible Bit 00001000 in the byte sequence. Tells us if a backup is eligible for device. Also referred
	// to as the BE flag.
	FlagBackupEligible // Referred to as BE.

	// FlagBackupState Bit 00010000 in the byte sequence. Tells us if a backup state for device. Also referred to as the
	// BS flag.
	FlagBackupState

	// FlagRFU2 is a reserved for future use flag.
	FlagRFU2

	// FlagAttestedCredentialData Bit 01000000 in the byte sequence. Indicates whether
	// the authenticator added attested credential data. Also referred to as the AT flag.
	FlagAttestedCredentialData

	// FlagHasExtensions Bit 10000000 in the byte sequence. Indicates if the authenticator data has extensions. Also
	// referred to as the ED flag.
	FlagHasExtensions
)

// UserPresent returns if the UP flag was set.
func (flag AuthenticatorFlags) UserPresent() bool {
	return flag.HasUserPresent()
}

// UserVerified returns if the UV flag was set.
func (flag AuthenticatorFlags) UserVerified() bool {
	return flag.HasUserVerified()
}

// HasUserPresent returns if the UP flag was set.
func (flag AuthenticatorFlags) HasUserPresent() bool {
	return (flag & FlagUserPresent) == FlagUserPresent
}

// HasUserVerified returns if the UV flag was set.
func (flag AuthenticatorFlags) HasUserVerified() bool {
	return (flag & FlagUserVerified) == FlagUserVerified
}

// HasAttestedCredentialData returns if the AT flag was set.
func (flag AuthenticatorFlags) HasAttestedCredentialData() bool {
	return (flag & FlagAttestedCredentialData) == FlagAttestedCredentialData
}

// HasExtensions returns if the ED flag was set.
func (flag AuthenticatorFlags) HasExtensions() bool {
	return (flag & FlagHasExtensions) == FlagHasExtensions
}

// HasBackupEligible returns if the BE flag was set.
func (flag AuthenticatorFlags) HasBackupEligible() bool {
	return (flag & FlagBackupEligible) == FlagBackupEligible
}

// HasBackupState returns if the BS flag was set.
func (flag AuthenticatorFlags) HasBackupState() bool {
	return (flag & FlagBackupState) == FlagBackupState
}

// Unmarshal will take the raw Authenticator Data and marshals it into AuthenticatorData for further validation.
// The authenticator data has a compact but extensible encoding. This is desired since authenticators can be
// devices with limited capabilities and low power requirements, with much simpler software stacks than the client platform.
// The authenticator data structure is a byte array of 37 bytes or more, and is laid out in this table:
// https://www.w3.org/TR/webauthn/#table-authData
func (a *AuthenticatorData) Unmarshal(rawAuthData []byte) (err error) {
	if minAuthDataLength > len(rawAuthData) {
		return ErrBadRequest.
			WithDetails("Authenticator data length too short").
			WithInfo(fmt.Sprintf("Expected data greater than %d bytes. Got %d bytes", minAuthDataLength, len(rawAuthData)))
	}

	a.RPIDHash = rawAuthData[:32]
	a.Flags = AuthenticatorFlags(rawAuthData[32])
	a.Counter = binary.BigEndian.Uint32(rawAuthData[33:37])

	remaining := len(rawAuthData) - minAuthDataLength

	if a.Flags.HasAttestedCredentialData() {
		if len(rawAuthData) > minAttestedAuthLength {
			if err = a.unmarshalAttestedData(rawAuthData); err != nil {
				return err
			}

			attDataLen := len(a.AttData.AAGUID) + 2 + len(a.AttData.CredentialID) + len(a.AttData.CredentialPublicKey)
			remaining -= attDataLen
		} else {
			return ErrBadRequest.WithDetails("Attested credential flag set but data is missing")
		}
	} else {
		if !a.Flags.HasExtensions() && len(rawAuthData) != 37 {
			return ErrBadRequest.WithDetails("Attested credential flag not set")
		}
	}

	if a.Flags.HasExtensions() {
		if remaining != 0 {
			a.ExtData = rawAuthData[len(rawAuthData)-remaining:]
			remaining -= len(a.ExtData)
		} else {
			return ErrBadRequest.WithDetails("Extensions flag set but extensions data is missing")
		}
	}

	if remaining != 0 {
		return ErrBadRequest.WithDetails("Leftover bytes decoding AuthenticatorData")
	}

	return nil
}

// If Attestation Data is present, unmarshall that into the appropriate public key structure.
func (a *AuthenticatorData) unmarshalAttestedData(rawAuthData []byte) (err error) {
	a.AttData.AAGUID = rawAuthData[37:53]

	idLength := binary.BigEndian.Uint16(rawAuthData[53:55])
	if len(rawAuthData) < int(55+idLength) {
		return ErrBadRequest.WithDetails("Authenticator attestation data length too short")
	}

	if idLength > maxCredentialIDLength {
		return ErrBadRequest.WithDetails("Authenticator attestation data credential id length too long")
	}

	a.AttData.CredentialID = rawAuthData[55 : 55+idLength]

	a.AttData.CredentialPublicKey, err = unmarshalCredentialPublicKey(rawAuthData[55+idLength:])
	if err != nil {
		return ErrBadRequest.WithDetails(fmt.Sprintf("Could not unmarshal Credential Public Key: %v", err)).WithError(err)
	}

	return nil
}

// Unmarshall the credential's Public Key into CBOR encoding.
func unmarshalCredentialPublicKey(keyBytes []byte) (rawBytes []byte, err error) {
	var m any

	if err = webauthncbor.Unmarshal(keyBytes, &m); err != nil {
		return nil, err
	}

	if rawBytes, err = webauthncbor.Marshal(m); err != nil {
		return nil, err
	}

	return rawBytes, nil
}

// ResidentKeyRequired - Require that the key be private key resident to the client device.
func ResidentKeyRequired() *bool {
	required := true

	return &required
}

// ResidentKeyNotRequired - Do not require that the private key be resident to the client device.
func ResidentKeyNotRequired() *bool {
	required := false
	return &required
}

// Verify on AuthenticatorData handles Steps 13 through 15 & 17 for Registration
// and Steps 15 through 18 for Assertion.
func (a *AuthenticatorData) Verify(rpIdHash []byte, appIDHash []byte, userVerificationRequired bool, userPresenceRequired bool) (err error) {
	// Registration Step 13 & Assertion Step 15
	// Verify that the RP ID hash in authData is indeed the SHA-256
	// hash of the RP ID expected by the RP.
	if !bytes.Equal(a.RPIDHash, rpIdHash) && !bytes.Equal(a.RPIDHash, appIDHash) {
		return ErrVerification.WithInfo(fmt.Sprintf("RP Hash mismatch. Expected %x and Received %x", a.RPIDHash, rpIdHash))
	}

	// Registration Step 15 & Assertion Step 16
	// Verify that the User Present bit of the flags in authData is set.
	if userPresenceRequired && !a.Flags.UserPresent() {
		return ErrVerification.WithInfo("User presence required but flag not set by authenticator")
	}

	// Registration Step 15 & Assertion Step 17
	// If user verification is required for this assertion, verify that
	// the User Verified bit of the flags in authData is set.
	if userVerificationRequired && !a.Flags.UserVerified() {
		return ErrVerification.WithInfo("User verification required but flag not set by authenticator")
	}

	// Registration Step 17 & Assertion Step 18
	// Verify that the values of the client extension outputs in clientExtensionResults
	// and the authenticator extension outputs in the extensions in authData are as
	// expected, considering the client extension input values that were given as the
	// extensions option in the create() call. In particular, any extension identifier
	// values in the clientExtensionResults and the extensions in authData MUST be also be
	// present as extension identifier values in the extensions member of options, i.e., no
	// extensions are present that were not requested. In the general case, the meaning
	// of "are as expected" is specific to the Relying Party and which extensions are in use.

	// This is not yet fully implemented by the spec or by browsers.

	return nil
}
