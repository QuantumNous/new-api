package webauthn

import (
	"bytes"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/protocol/webauthncose"
)

// BEGIN REGISTRATION
// These objects help us create the CredentialCreationOptions
// that will be passed to the authenticator via the user client.

// RegistrationOption describes a function which modifies the registration
// [*protocol.PublicKeyCredentialCreationOptions] values.
type RegistrationOption func(*protocol.PublicKeyCredentialCreationOptions)

// BeginRegistration generates a new set of registration data to be sent to the client and authenticator. To set a
// conditional mediation requirement for the registration see [WebAuthn.BeginMediatedRegistration].
func (webauthn *WebAuthn) BeginRegistration(user User, opts ...RegistrationOption) (creation *protocol.CredentialCreation, session *SessionData, err error) {
	return webauthn.BeginMediatedRegistration(user, protocol.MediationDefault, opts...)
}

// BeginMediatedRegistration is similar to [WebAuthn.BeginRegistration] however it also allows specifying a credential
// mediation requirement.
func (webauthn *WebAuthn) BeginMediatedRegistration(user User, mediation protocol.CredentialMediationRequirement, opts ...RegistrationOption) (creation *protocol.CredentialCreation, session *SessionData, err error) {
	if err = webauthn.Config.validate(); err != nil {
		return nil, nil, fmt.Errorf(errFmtConfigValidate, err)
	}

	challenge, err := protocol.CreateChallenge()
	if err != nil {
		return nil, nil, err
	}

	var entityUserID any

	if webauthn.Config.EncodeUserIDAsString {
		entityUserID = string(user.WebAuthnID())
	} else {
		entityUserID = protocol.URLEncodedBase64(user.WebAuthnID())
	}

	entityUser := protocol.UserEntity{
		ID:          entityUserID,
		DisplayName: user.WebAuthnDisplayName(),
		CredentialEntity: protocol.CredentialEntity{
			Name: user.WebAuthnName(),
		},
	}

	entityRelyingParty := protocol.RelyingPartyEntity{
		ID: webauthn.Config.RPID,
		CredentialEntity: protocol.CredentialEntity{
			Name: webauthn.Config.RPDisplayName,
		},
	}

	credentialParams := CredentialParametersDefault()

	creation = &protocol.CredentialCreation{
		Response: protocol.PublicKeyCredentialCreationOptions{
			RelyingParty:           entityRelyingParty,
			User:                   entityUser,
			Challenge:              challenge,
			Parameters:             credentialParams,
			AuthenticatorSelection: webauthn.Config.AuthenticatorSelection,
			Attestation:            webauthn.Config.AttestationPreference,
		},
		Mediation: mediation,
	}

	for _, opt := range opts {
		opt(&creation.Response)
	}

	if len(creation.Response.RelyingParty.ID) == 0 {
		return nil, nil, fmt.Errorf("error generating credential creation: the relying party id must be provided via the configuration or a functional option for a creation")
	} else if _, err = url.Parse(creation.Response.RelyingParty.ID); err != nil {
		return nil, nil, fmt.Errorf("error generating credential creation: the relying party id failed to validate as it's not a valid uri with error: %w", err)
	}

	if len(creation.Response.RelyingParty.Name) == 0 {
		return nil, nil, fmt.Errorf("error generating credential creation: the relying party display name must be provided via the configuration or a functional option for a creation")
	}

	if creation.Response.Timeout == 0 {
		switch creation.Response.AuthenticatorSelection.UserVerification {
		case protocol.VerificationDiscouraged:
			creation.Response.Timeout = int(webauthn.Config.Timeouts.Registration.TimeoutUVD.Milliseconds())
		default:
			creation.Response.Timeout = int(webauthn.Config.Timeouts.Registration.Timeout.Milliseconds())
		}
	}

	session = &SessionData{
		Challenge:        challenge.String(),
		RelyingPartyID:   creation.Response.RelyingParty.ID,
		UserID:           user.WebAuthnID(),
		UserVerification: creation.Response.AuthenticatorSelection.UserVerification,
		CredParams:       creation.Response.Parameters,
		Mediation:        creation.Mediation,
	}

	if webauthn.Config.Timeouts.Registration.Enforce {
		session.Expires = time.Now().Add(time.Millisecond * time.Duration(creation.Response.Timeout))
	}

	return creation, session, nil
}

// WithCredentialParameters adjusts the credential parameters in the registration options.
func WithCredentialParameters(credentialParams []protocol.CredentialParameter) RegistrationOption {
	return func(cco *protocol.PublicKeyCredentialCreationOptions) {
		cco.Parameters = credentialParams
	}
}

// WithExclusions adjusts the non-default parameters regarding credentials to exclude from registration.
func WithExclusions(excludeList []protocol.CredentialDescriptor) RegistrationOption {
	return func(cco *protocol.PublicKeyCredentialCreationOptions) {
		cco.CredentialExcludeList = excludeList
	}
}

// WithAuthenticatorSelection adjusts the non-default parameters regarding the authenticator to select during
// registration.
func WithAuthenticatorSelection(authenticatorSelection protocol.AuthenticatorSelection) RegistrationOption {
	return func(cco *protocol.PublicKeyCredentialCreationOptions) {
		cco.AuthenticatorSelection = authenticatorSelection
	}
}

// WithResidentKeyRequirement sets both the resident key and require resident key protocol options.
func WithResidentKeyRequirement(requirement protocol.ResidentKeyRequirement) RegistrationOption {
	return func(cco *protocol.PublicKeyCredentialCreationOptions) {
		cco.AuthenticatorSelection.ResidentKey = requirement

		switch requirement {
		case protocol.ResidentKeyRequirementRequired:
			cco.AuthenticatorSelection.RequireResidentKey = protocol.ResidentKeyRequired()
		default:
			cco.AuthenticatorSelection.RequireResidentKey = protocol.ResidentKeyNotRequired()
		}
	}
}

// WithPublicKeyCredentialHints adjusts the non-default hints for credential types to select during registration.
//
// WebAuthn Level 3.
func WithPublicKeyCredentialHints(hints []protocol.PublicKeyCredentialHints) RegistrationOption {
	return func(cco *protocol.PublicKeyCredentialCreationOptions) {
		cco.Hints = hints
	}
}

// WithConveyancePreference adjusts the non-default parameters regarding whether the authenticator should attest to the
// credential.
func WithConveyancePreference(preference protocol.ConveyancePreference) RegistrationOption {
	return func(cco *protocol.PublicKeyCredentialCreationOptions) {
		cco.Attestation = preference
	}
}

// WithAttestationFormats adjusts the non-default formats for credential types to select during registration.
//
// WebAuthn Level 3.
func WithAttestationFormats(formats []protocol.AttestationFormat) RegistrationOption {
	return func(cco *protocol.PublicKeyCredentialCreationOptions) {
		cco.AttestationFormats = formats
	}
}

// WithExtensions adjusts the extension parameter in the registration options.
func WithExtensions(extension protocol.AuthenticationExtensions) RegistrationOption {
	return func(cco *protocol.PublicKeyCredentialCreationOptions) {
		cco.Extensions = extension
	}
}

// WithAppIdExcludeExtension automatically includes the specified appid if the CredentialExcludeList contains a credential
// with the type `fido-u2f`.
func WithAppIdExcludeExtension(appid string) RegistrationOption {
	return func(cco *protocol.PublicKeyCredentialCreationOptions) {
		for _, credential := range cco.CredentialExcludeList {
			if credential.AttestationType == protocol.CredentialTypeFIDOU2F {
				if cco.Extensions == nil {
					cco.Extensions = map[string]any{}
				}

				cco.Extensions[protocol.ExtensionAppIDExclude] = appid
			}
		}
	}
}

// WithRegistrationRelyingPartyID sets the relying party id for the registration.
func WithRegistrationRelyingPartyID(id string) RegistrationOption {
	return func(cco *protocol.PublicKeyCredentialCreationOptions) {
		cco.RelyingParty.ID = id
	}
}

// WithRegistrationRelyingPartyName sets the relying party name for the registration.
func WithRegistrationRelyingPartyName(name string) RegistrationOption {
	return func(cco *protocol.PublicKeyCredentialCreationOptions) {
		cco.RelyingParty.Name = name
	}
}

// FinishRegistration takes the response from the authenticator and client and verify the credential against the user's
// credentials and session data.
//
// As with all Finish functions this function requires a [*http.Request] but you can perform the same steps with the
// [protocol.ParseCredentialCreationResponseBody] or [protocol.ParseCredentialCreationResponseBytes] which require an
// [io.Reader] or byte array respectively, you can also use an arbitrary [*protocol.ParsedCredentialCreationData] which is
// returned from all of these functions i.e. by implementing a custom parser. The [User], [*SessionData], and
// [*protocol.ParsedCredentialCreationData] can then be used with the [WebAuthn.CreateCredential] function.
func (webauthn *WebAuthn) FinishRegistration(user User, session SessionData, request *http.Request) (credential *Credential, err error) {
	parsedResponse, err := protocol.ParseCredentialCreationResponse(request)
	if err != nil {
		return nil, err
	}

	return webauthn.CreateCredential(user, session, parsedResponse)
}

// CreateCredential verifies a parsed response against the user's credentials and session data.
//
// If you wish to skip performing the step required to parse the [*protocol.ParsedCredentialCreationData] and
// you're using net/http then you can use [WebAuthn.FinishRegistration] instead.
func (webauthn *WebAuthn) CreateCredential(user User, session SessionData, parsedResponse *protocol.ParsedCredentialCreationData) (credential *Credential, err error) {
	if !bytes.Equal(user.WebAuthnID(), session.UserID) {
		return nil, protocol.ErrBadRequest.WithDetails("ID mismatch for User and Session")
	}

	if !session.Expires.IsZero() && session.Expires.Before(time.Now()) {
		return nil, protocol.ErrBadRequest.WithDetails("Session has Expired")
	}

	shouldVerifyUser := session.UserVerification == protocol.VerificationRequired
	shouldVerifyUserPresence := session.Mediation != protocol.MediationConditional

	var clientDataHash []byte

	if clientDataHash, err = parsedResponse.Verify(session.Challenge, shouldVerifyUser, shouldVerifyUserPresence, webauthn.Config.RPID, webauthn.Config.RPOrigins, webauthn.Config.RPTopOrigins, webauthn.Config.RPTopOriginVerificationMode, webauthn.Config.MDS, session.CredParams); err != nil {
		return nil, err
	}

	return NewCredential(clientDataHash, parsedResponse)
}

// CredentialParametersDefault is the default [protocol.CredentialParameter] list.
func CredentialParametersDefault() []protocol.CredentialParameter {
	return []protocol.CredentialParameter{
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgES256,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgES384,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgES512,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgRS256,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgRS384,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgRS512,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgPS256,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgPS384,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgPS512,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgEdDSA,
		},
	}
}

// CredentialParametersRecommendedL3 is explicitly the Level 3 recommended [protocol.CredentialParameter] list.
func CredentialParametersRecommendedL3() []protocol.CredentialParameter {
	return []protocol.CredentialParameter{
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgEdDSA,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgES256,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgRS256,
		},
	}
}

// CredentialParametersExtendedL3 is the Level 3 recommended [protocol.CredentialParameter] list with all of the other
// parameters supported by the library.
func CredentialParametersExtendedL3() []protocol.CredentialParameter {
	return []protocol.CredentialParameter{
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgEdDSA,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgES256,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgES384,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgES512,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgRS256,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgRS384,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgRS512,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgPS256,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgPS384,
		},
		{
			Type:      protocol.PublicKeyCredentialType,
			Algorithm: webauthncose.AlgPS512,
		},
	}
}
