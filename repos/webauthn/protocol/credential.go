package protocol

import (
	"crypto/sha256"
	"encoding/base64"
	"io"
	"net/http"

	"github.com/go-webauthn/webauthn/metadata"
)

// Credential is the basic credential type from the Credential Management specification that is inherited by WebAuthn's
// PublicKeyCredential type.
//
// Specification: Credential Management §2.2. The Credential Interface (https://www.w3.org/TR/credential-management/#credential)
type Credential struct {
	// ID is The credential’s identifier. The requirements for the
	// identifier are distinct for each type of credential. It might
	// represent a username for username/password tuples, for example.
	ID string `json:"id"`
	// Type is the value of the object’s interface object's [[type]] slot,
	// which specifies the credential type represented by this object.
	// This should be type "public-key" for Webauthn credentials.
	Type string `json:"type"`
}

// ParsedCredential is the parsed PublicKeyCredential interface, inherits from Credential, and contains
// the attributes that are returned to the caller when a new credential is created, or a new assertion is requested.
type ParsedCredential struct {
	ID   string `cbor:"id"`
	Type string `cbor:"type"`
}

type PublicKeyCredential struct {
	Credential

	RawID                   URLEncodedBase64                      `json:"rawId"`
	ClientExtensionResults  AuthenticationExtensionsClientOutputs `json:"clientExtensionResults,omitempty"`
	AuthenticatorAttachment string                                `json:"authenticatorAttachment,omitempty"`
}

type ParsedPublicKeyCredential struct {
	ParsedCredential

	RawID                   []byte                                `json:"rawId"`
	ClientExtensionResults  AuthenticationExtensionsClientOutputs `json:"clientExtensionResults,omitempty"`
	AuthenticatorAttachment AuthenticatorAttachment               `json:"authenticatorAttachment,omitempty"`
}

type CredentialCreationResponse struct {
	PublicKeyCredential

	AttestationResponse AuthenticatorAttestationResponse `json:"response"`
}

type ParsedCredentialCreationData struct {
	ParsedPublicKeyCredential

	Response ParsedAttestationResponse
	Raw      CredentialCreationResponse
}

// ParseCredentialCreationResponse is a non-agnostic function for parsing a registration response from the http library
// from stdlib. It handles some standard cleanup operations.
func ParseCredentialCreationResponse(request *http.Request) (*ParsedCredentialCreationData, error) {
	if request == nil || request.Body == nil {
		return nil, ErrBadRequest.WithDetails("No response given")
	}

	defer func() {
		_, _ = io.Copy(io.Discard, request.Body)
		_ = request.Body.Close()
	}()

	return ParseCredentialCreationResponseBody(request.Body)
}

// ParseCredentialCreationResponseBody is an agnostic version of ParseCredentialCreationResponse. Implementers are
// therefore responsible for managing cleanup.
func ParseCredentialCreationResponseBody(body io.Reader) (pcc *ParsedCredentialCreationData, err error) {
	var ccr CredentialCreationResponse

	if err = decodeBody(body, &ccr); err != nil {
		return nil, ErrBadRequest.WithDetails("Parse error for Registration").WithInfo(err.Error()).WithError(err)
	}

	return ccr.Parse()
}

// ParseCredentialCreationResponseBytes is an alternative version of ParseCredentialCreationResponseBody that just takes
// a byte slice.
func ParseCredentialCreationResponseBytes(data []byte) (pcc *ParsedCredentialCreationData, err error) {
	var ccr CredentialCreationResponse

	if err = decodeBytes(data, &ccr); err != nil {
		return nil, ErrBadRequest.WithDetails("Parse error for Registration").WithInfo(err.Error()).WithError(err)
	}

	return ccr.Parse()
}

// Parse validates and parses the CredentialCreationResponse into a ParsedCredentialCreationData. This receiver
// is unlikely to be expressly guaranteed under the versioning policy. Users looking for this guarantee should see
// ParseCredentialCreationResponseBody instead, and this receiver should only be used if that function is inadequate
// for their use case.
func (ccr CredentialCreationResponse) Parse() (pcc *ParsedCredentialCreationData, err error) {
	if ccr.ID == "" {
		return nil, ErrBadRequest.WithDetails("Parse error for Registration").WithInfo("Missing ID")
	}

	testB64, err := base64.RawURLEncoding.DecodeString(ccr.ID)
	if err != nil || len(testB64) == 0 {
		return nil, ErrBadRequest.WithDetails("Parse error for Registration").WithInfo("ID not base64.RawURLEncoded")
	}

	if ccr.Type == "" {
		return nil, ErrBadRequest.WithDetails("Parse error for Registration").WithInfo("Missing type")
	}

	if ccr.Type != string(PublicKeyCredentialType) {
		return nil, ErrBadRequest.WithDetails("Parse error for Registration").WithInfo("Type not public-key")
	}

	response, err := ccr.AttestationResponse.Parse()
	if err != nil {
		return nil, ErrParsingData.WithDetails("Error parsing attestation response")
	}

	var attachment AuthenticatorAttachment

	switch ccr.AuthenticatorAttachment {
	case "platform":
		attachment = Platform
	case "cross-platform":
		attachment = CrossPlatform
	}

	return &ParsedCredentialCreationData{
		ParsedPublicKeyCredential{
			ParsedCredential{ccr.ID, ccr.Type}, ccr.RawID, ccr.ClientExtensionResults, attachment,
		},
		*response,
		ccr,
	}, nil
}

// Verify the Client and Attestation data.
//
// Specification: §7.1. Registering a New Credential (https://www.w3.org/TR/webauthn/#sctn-registering-a-new-credential)
func (pcc *ParsedCredentialCreationData) Verify(storedChallenge string, verifyUser bool, verifyUserPresence bool, relyingPartyID string, rpOrigins, rpTopOrigins []string, rpTopOriginsVerify TopOriginVerificationMode, mds metadata.Provider, credParams []CredentialParameter) (clientDataHash []byte, err error) {
	// Handles steps 3 through 6 - Verifying the Client Data against the Relying Party's stored data.
	if err = pcc.Response.CollectedClientData.Verify(storedChallenge, CreateCeremony, rpOrigins, rpTopOrigins, rpTopOriginsVerify); err != nil {
		return nil, err
	}

	// Step 7. Compute the hash of response.clientDataJSON using SHA-256.
	sum := sha256.Sum256(pcc.Raw.AttestationResponse.ClientDataJSON)
	clientDataHash = sum[:]

	// Step 8. Perform CBOR decoding on the attestationObject field of the AuthenticatorAttestationResponse
	// structure to obtain the attestation statement format fmt, the authenticator data authData, and the
	// attestation statement attStmt.

	// We do the above step while parsing and decoding the CredentialCreationResponse
	// Handle steps 9 through 14 - This verifies the attestation object.
	if err = pcc.Response.AttestationObject.Verify(relyingPartyID, clientDataHash, verifyUser, verifyUserPresence, mds, credParams); err != nil {
		return clientDataHash, err
	}

	// Step 15. If validation is successful, obtain a list of acceptable trust anchors (attestation root
	// certificates or ECDAA-Issuer public keys) for that attestation type and attestation statement
	// format fmt, from a trusted source or from policy. For example, the FIDO Metadata Service provides
	// one way to obtain such information, using the AAGUID in the attestedCredentialData in authData.
	// [https://fidoalliance.org/specs/fido-v2.0-id-20180227/fido-metadata-service-v2.0-id-20180227.html]

	// TODO: There are no valid AAGUIDs yet or trust sources supported. We could implement policy for the RP in
	// the future, however.

	// Step 16. Assess the attestation trustworthiness using outputs of the verification procedure in step 14, as follows:
	// - If self attestation was used, check if self attestation is acceptable under Relying Party policy.
	// - If ECDAA was used, verify that the identifier of the ECDAA-Issuer public key used is included in
	//   the set of acceptable trust anchors obtained in step 15.
	// - Otherwise, use the X.509 certificates returned by the verification procedure to verify that the
	//   attestation public key correctly chains up to an acceptable root certificate.

	// TODO: We're not supporting trust anchors, self-attestation policy, or acceptable root certs yet.

	// Step 17. Check that the credentialId is not yet registered to any other user. If registration is
	// requested for a credential that is already registered to a different user, the Relying Party SHOULD
	// fail this registration ceremony, or it MAY decide to accept the registration, e.g. while deleting
	// the older registration.

	// TODO: We can't support this in the code's current form, the Relying Party would need to check for this
	// against their database.

	// Step 18 If the attestation statement attStmt verified successfully and is found to be trustworthy, then
	// register the new credential with the account that was denoted in the options.user passed to create(), by
	// associating it with the credentialId and credentialPublicKey in the attestedCredentialData in authData, as
	// appropriate for the Relying Party's system.

	// Step 19. If the attestation statement attStmt successfully verified but is not trustworthy per step 16 above,
	// the Relying Party SHOULD fail the registration ceremony.

	// TODO: Not implemented for the reasons mentioned under Step 16.

	return clientDataHash, nil
}

// GetAppID takes a AuthenticationExtensions object or nil. It then performs the following checks in order:
//
// 1. Check that the Session Data's AuthenticationExtensions has been provided and if it hasn't return an error.
// 2. Check that the AuthenticationExtensionsClientOutputs contains the extensions output and return an empty string if it doesn't.
// 3. Check that the Credential AttestationType is `fido-u2f` and return an empty string if it isn't.
// 4. Check that the AuthenticationExtensionsClientOutputs contains the appid key and if it doesn't return an empty string.
// 5. Check that the AuthenticationExtensionsClientOutputs appid is a bool and if it isn't return an error.
// 6. Check that the appid output is true and if it isn't return an empty string.
// 7. Check that the Session Data has an appid extension defined and if it doesn't return an error.
// 8. Check that the appid extension in Session Data is a string and if it isn't return an error.
// 9. Return the appid extension value from the Session data.
func (ppkc ParsedPublicKeyCredential) GetAppID(authExt AuthenticationExtensions, credentialAttestationType string) (appID string, err error) {
	var (
		value, clientValue interface{}
		enableAppID, ok    bool
	)

	if authExt == nil {
		return "", nil
	}

	if ppkc.ClientExtensionResults == nil {
		return "", nil
	}

	// If the credential does not have the correct attestation type it is assumed to NOT be a fido-u2f credential.
	// https://www.w3.org/TR/webauthn/#sctn-fido-u2f-attestation
	if credentialAttestationType != CredentialTypeFIDOU2F {
		return "", nil
	}

	if clientValue, ok = ppkc.ClientExtensionResults[ExtensionAppID]; !ok {
		return "", nil
	}

	if enableAppID, ok = clientValue.(bool); !ok {
		return "", ErrBadRequest.WithDetails("Client Output appid did not have the expected type")
	}

	if !enableAppID {
		return "", nil
	}

	if value, ok = authExt[ExtensionAppID]; !ok {
		return "", ErrBadRequest.WithDetails("Session Data does not have an appid but Client Output indicates it should be set")
	}

	if appID, ok = value.(string); !ok {
		return "", ErrBadRequest.WithDetails("Session Data appid did not have the expected type")
	}

	return appID, nil
}

const (
	CredentialTypeFIDOU2F = "fido-u2f"
)
