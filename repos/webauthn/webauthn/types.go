package webauthn

import (
	"fmt"
	"net/url"
	"time"

	"github.com/go-webauthn/webauthn/metadata"
	"github.com/go-webauthn/webauthn/protocol"
)

// New creates a new WebAuthn object given the proper Config.
func New(config *Config) (*WebAuthn, error) {
	if err := config.validate(); err != nil {
		return nil, fmt.Errorf(errFmtConfigValidate, err)
	}

	return &WebAuthn{
		config,
	}, nil
}

// WebAuthn is the primary interface of this package and contains the request handlers that should be called.
type WebAuthn struct {
	Config *Config
}

// Config represents the WebAuthn configuration.
type Config struct {
	// RPID configures the Relying Party Server ID. This should generally be the origin without a scheme and port.
	RPID string

	// RPDisplayName configures the display name for the Relying Party Server. This can be any string.
	RPDisplayName string

	// RPOrigins configures the list of Relying Party Server Origins that are permitted. The provided origins can either
	// be fully qualified origins or strings for simple string comparison. The strings are matched using canonical
	// origin matching semantics specifically if they start with 'http://' or 'https://' if the provided origin has a
	// case-insensitive equal scheme and host component they are equal, otherwise simple string comparison is utilized
	// to determine equality.
	RPOrigins []string

	// RPTopOrigins configures the list of Relying Party Server Top Origins that are permitted. The provided origins can
	// either be fully qualified origins or strings for simple string comparison. The strings are matched using
	// canonical origin matching semantics specifically if they start with 'http://' or 'https://' if the provided
	// origin has a case-insensitive equal scheme and host component they are equal, otherwise simple string comparison
	// is utilized to determine equality.
	RPTopOrigins []string

	// RPTopOriginVerificationMode determines the verification mode for the Top Origin value. By default the
	// TopOriginIgnoreVerificationMode is used however this is going to change at such a time as WebAuthn Level 3
	// becomes recommended, implementers should explicitly set this value if they want stability.
	RPTopOriginVerificationMode protocol.TopOriginVerificationMode

	// AttestationPreference sets the default attestation conveyance preferences.
	AttestationPreference protocol.ConveyancePreference

	// AuthenticatorSelection sets the default authenticator selection options.
	AuthenticatorSelection protocol.AuthenticatorSelection

	// Debug enables various debug options.
	Debug bool

	// EncodeUserIDAsString ensures the user.id value during registrations is encoded as a raw UTF8 string. This is
	// useful when you only use printable ASCII characters for the random user.id but the browser library does not
	// decode the URL Safe Base64 data.
	EncodeUserIDAsString bool

	// Timeouts configures various timeouts.
	Timeouts TimeoutsConfig

	// MDS is a metadata.Provider and enables various metadata validations if configured.
	MDS metadata.Provider

	validated bool
}

// TimeoutsConfig represents the WebAuthn timeouts configuration.
type TimeoutsConfig struct {
	Login        TimeoutConfig
	Registration TimeoutConfig
}

// TimeoutConfig represents the WebAuthn timeouts configuration for either registration or login..
type TimeoutConfig struct {
	// Enforce the timeouts at the Relying Party / Server. This means if enabled and the user takes too long that even
	// if the browser does not enforce the timeout the Relying Party / Server will.
	Enforce bool

	// Timeout is the timeout for logins/registrations when the UserVerificationRequirement is set to anything other
	// than discouraged.
	Timeout time.Duration

	// TimeoutUVD is the timeout for logins/registrations when the UserVerificationRequirement is set to discouraged.
	TimeoutUVD time.Duration
}

// Validate that the config flags in Config are properly set.
func (config *Config) validate() (err error) {
	if config.validated {
		return nil
	}

	if len(config.RPID) != 0 {
		if _, err = url.Parse(config.RPID); err != nil {
			return fmt.Errorf(errFmtFieldNotValidURI, "RPID", err)
		}
	}

	defaultTimeoutConfig := defaultTimeout
	defaultTimeoutUVDConfig := defaultTimeoutUVD

	if config.Timeouts.Login.Timeout.Milliseconds() == 0 {
		config.Timeouts.Login.Timeout = defaultTimeoutConfig
	}

	if config.Timeouts.Login.TimeoutUVD.Milliseconds() == 0 {
		config.Timeouts.Login.TimeoutUVD = defaultTimeoutUVDConfig
	}

	if config.Timeouts.Registration.Timeout.Milliseconds() == 0 {
		config.Timeouts.Registration.Timeout = defaultTimeoutConfig
	}

	if config.Timeouts.Registration.TimeoutUVD.Milliseconds() == 0 {
		config.Timeouts.Registration.TimeoutUVD = defaultTimeoutUVDConfig
	}

	if len(config.RPOrigins) == 0 {
		return fmt.Errorf("must provide at least one value to the 'RPOrigins' field")
	}

	switch config.RPTopOriginVerificationMode {
	case protocol.TopOriginDefaultVerificationMode:
		config.RPTopOriginVerificationMode = protocol.TopOriginIgnoreVerificationMode
	case protocol.TopOriginExplicitVerificationMode:
		if len(config.RPTopOrigins) == 0 {
			return fmt.Errorf("must provide at least one value to the 'RPTopOrigins' field when 'RPTopOriginVerificationMode' field is set to protocol.TopOriginExplicitVerificationMode")
		}
	}

	config.validated = true

	return nil
}

func (c *Config) GetRPID() string {
	return c.RPID
}

func (c *Config) GetOrigins() []string {
	return c.RPOrigins
}

func (c *Config) GetTopOrigins() []string {
	return c.RPTopOrigins
}

func (c *Config) GetTopOriginVerificationMode() protocol.TopOriginVerificationMode {
	return c.RPTopOriginVerificationMode
}

func (c *Config) GetMetaDataProvider() metadata.Provider {
	return c.MDS
}

type ConfigProvider interface {
	GetRPID() string
	GetOrigins() []string
	GetTopOrigins() []string
	GetTopOriginVerificationMode() protocol.TopOriginVerificationMode
	GetMetaDataProvider() metadata.Provider
}

// User is an interface with the Relying Party's User entry and provides the fields and methods needed for WebAuthn
// registration operations.
type User interface {
	// WebAuthnID provides the user handle of the user account. A user handle is an opaque byte sequence with a maximum
	// size of 64 bytes, and is not meant to be displayed to the user.
	//
	// To ensure secure operation, authentication and authorization decisions MUST be made on the basis of this id
	// member, not the displayName nor name members. See Section 6.1 of [RFC8266].
	//
	// It's recommended this value is completely random and uses the entire 64 bytes.
	//
	// Specification: §5.4.3. User Account Parameters for Credential Generation (https://w3c.github.io/webauthn/#dom-publickeycredentialuserentity-id)
	WebAuthnID() []byte

	// WebAuthnName provides the name attribute of the user account during registration and is a human-palatable name for the user
	// account, intended only for display. For example, "Alex Müller" or "田中倫". The Relying Party SHOULD let the user
	// choose this, and SHOULD NOT restrict the choice more than necessary.
	//
	// Specification: §5.4.3. User Account Parameters for Credential Generation (https://w3c.github.io/webauthn/#dictdef-publickeycredentialuserentity)
	WebAuthnName() string

	// WebAuthnDisplayName provides the name attribute of the user account during registration and is a human-palatable
	// name for the user account, intended only for display. For example, "Alex Müller" or "田中倫". The Relying Party
	// SHOULD let the user choose this, and SHOULD NOT restrict the choice more than necessary.
	//
	// Specification: §5.4.3. User Account Parameters for Credential Generation (https://www.w3.org/TR/webauthn/#dom-publickeycredentialuserentity-displayname)
	WebAuthnDisplayName() string

	// WebAuthnCredentials provides the list of Credential objects owned by the user.
	WebAuthnCredentials() []Credential
}

// SessionData is the data that should be stored by the Relying Party for the duration of the web authentication
// ceremony.
type SessionData struct {
	Challenge            string    `json:"challenge"`
	RelyingPartyID       string    `json:"rpId"`
	UserID               []byte    `json:"user_id"`
	AllowedCredentialIDs [][]byte  `json:"allowed_credentials,omitempty"`
	Expires              time.Time `json:"expires"`

	UserVerification protocol.UserVerificationRequirement    `json:"userVerification"`
	Extensions       protocol.AuthenticationExtensions       `json:"extensions,omitempty"`
	CredParams       []protocol.CredentialParameter          `json:"credParams,omitempty"`
	Mediation        protocol.CredentialMediationRequirement `json:"mediation,omitempty"`
}
