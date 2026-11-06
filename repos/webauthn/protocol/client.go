package protocol

import (
	"crypto/subtle"
	"fmt"
	"net/url"
	"strings"
)

// CollectedClientData represents the contextual bindings of both the WebAuthn Relying Party
// and the client. It is a key-value mapping whose keys are strings. Values can be any type
// that has a valid encoding in JSON. Its structure is defined by the following Web IDL.
//
// Specification: §5.8.1. Client Data Used in WebAuthn Signatures (https://www.w3.org/TR/webauthn/#dictdef-collectedclientdata)
type CollectedClientData struct {
	// Type the string "webauthn.create" when creating new credentials,
	// and "webauthn.get" when getting an assertion from an existing credential. The
	// purpose of this member is to prevent certain types of signature confusion attacks
	// (where an attacker substitutes one legitimate signature for another).
	Type         CeremonyType  `json:"type"`
	Challenge    string        `json:"challenge"`
	Origin       string        `json:"origin"`
	TopOrigin    string        `json:"topOrigin,omitempty"`
	CrossOrigin  bool          `json:"crossOrigin,omitempty"`
	TokenBinding *TokenBinding `json:"tokenBinding,omitempty"`

	// Chromium (Chrome) returns a hint sometimes about how to handle clientDataJSON in a safe manner.
	Hint string `json:"new_keys_may_be_added_here,omitempty"`
}

type CeremonyType string

const (
	CreateCeremony CeremonyType = "webauthn.create"
	AssertCeremony CeremonyType = "webauthn.get"
)

type TokenBinding struct {
	Status TokenBindingStatus `json:"status"`
	ID     string             `json:"id,omitempty"`
}

type TokenBindingStatus string

const (
	// Present indicates token binding was used when communicating with the
	// Relying Party. In this case, the id member MUST be present.
	Present TokenBindingStatus = "present"

	// Supported indicates token binding was used when communicating with the
	// negotiated when communicating with the Relying Party.
	Supported TokenBindingStatus = "supported"

	// NotSupported indicates token binding not supported
	// when communicating with the Relying Party.
	NotSupported TokenBindingStatus = "not-supported"
)

// FullyQualifiedOrigin returns the origin per the HTML spec: (scheme)://(host)[:(port)].
func FullyQualifiedOrigin(rawOrigin string) (fqOrigin string, err error) {
	if strings.HasPrefix(rawOrigin, "android:apk-key-hash:") {
		return rawOrigin, nil
	}

	var origin *url.URL

	if origin, err = url.ParseRequestURI(rawOrigin); err != nil {
		return "", err
	}

	if origin.Host == "" {
		return "", fmt.Errorf("url '%s' does not have a host", rawOrigin)
	}

	origin.Path, origin.RawPath, origin.RawQuery, origin.User = "", "", "", nil

	return origin.String(), nil
}

// Verify handles steps 3 through 6 of verifying the registering client data of a
// new credential and steps 7 through 10 of verifying an authentication assertion
// See https://www.w3.org/TR/webauthn/#registering-a-new-credential
// and https://www.w3.org/TR/webauthn/#verifying-assertion
//
// Note: the rpTopOriginsVerify parameter does not accept the TopOriginVerificationMode value of
// TopOriginDefaultVerificationMode as it's expected this value is updated by the config validation process.
func (c *CollectedClientData) Verify(storedChallenge string, ceremony CeremonyType, rpOrigins, rpTopOrigins []string, rpTopOriginsVerify TopOriginVerificationMode) (err error) {
	// Registration Step 3. Verify that the value of C.type is webauthn.create.

	// Assertion Step 7. Verify that the value of C.type is the string webauthn.get.
	if c.Type != ceremony {
		return ErrVerification.WithDetails("Error validating ceremony type").WithInfo(fmt.Sprintf("Expected Value: %s, Received: %s", ceremony, c.Type))
	}

	// Registration Step 4. Verify that the value of C.challenge matches the challenge
	// that was sent to the authenticator in the create() call.

	// Assertion Step 8. Verify that the value of C.challenge matches the challenge
	// that was sent to the authenticator in the PublicKeyCredentialRequestOptions
	// passed to the get() call.

	challenge := c.Challenge
	if subtle.ConstantTimeCompare([]byte(storedChallenge), []byte(challenge)) != 1 {
		return ErrVerification.
			WithDetails("Error validating challenge").
			WithInfo(fmt.Sprintf("Expected b Value: %#v\nReceived b: %#v\n", storedChallenge, challenge))
	}

	// Registration Step 5 & Assertion Step 9. Verify that the value of C.origin matches
	// the Relying Party's origin.

	if !IsOriginInHaystack(c.Origin, rpOrigins) {
		return ErrVerification.
			WithDetails("Error validating origin").
			WithInfo(fmt.Sprintf("Expected Values: %s, Received: %s", rpOrigins, c.Origin))
	}

	if rpTopOriginsVerify != TopOriginIgnoreVerificationMode {
		switch len(c.TopOrigin) {
		case 0:
			break
		default:
			if !c.CrossOrigin {
				return ErrVerification.
					WithDetails("Error validating topOrigin").
					WithInfo("The topOrigin can't have values unless crossOrigin is true.")
			}

			var (
				fqTopOrigin        string
				possibleTopOrigins []string
			)

			switch rpTopOriginsVerify {
			case TopOriginExplicitVerificationMode:
				possibleTopOrigins = rpTopOrigins
			case TopOriginAutoVerificationMode:
				possibleTopOrigins = append(rpTopOrigins, rpOrigins...) //nolint:gocritic // This is intentional.
			case TopOriginImplicitVerificationMode:
				possibleTopOrigins = rpOrigins
			default:
				return ErrNotImplemented.WithDetails("Error handling unknown Top Origin verification mode")
			}

			if !IsOriginInHaystack(c.TopOrigin, possibleTopOrigins) {
				return ErrVerification.
					WithDetails("Error validating top origin").
					WithInfo(fmt.Sprintf("Expected Values: %s, Received: %s", possibleTopOrigins, fqTopOrigin))
			}
		}
	}

	// Registration Step 6 and Assertion Step 10. Verify that the value of C.tokenBinding.status
	// matches the state of Token Binding for the TLS connection over which the assertion was
	// obtained. If Token Binding was used on that TLS connection, also verify that C.tokenBinding.id
	// matches the base64url encoding of the Token Binding ID for the connection.
	if c.TokenBinding != nil {
		if c.TokenBinding.Status == "" {
			return ErrParsingData.WithDetails("Error decoding clientData, token binding present without status")
		}

		if c.TokenBinding.Status != Present && c.TokenBinding.Status != Supported && c.TokenBinding.Status != NotSupported {
			return ErrParsingData.
				WithDetails("Error decoding clientData, token binding present with invalid status").
				WithInfo(fmt.Sprintf("Got: %s", c.TokenBinding.Status))
		}
	}
	// Not yet fully implemented by the spec, browsers, and me.

	return nil
}

type TopOriginVerificationMode int

const (
	// TopOriginDefaultVerificationMode represents the default verification mode for the Top Origin. At this time this
	// mode is the same as TopOriginIgnoreVerificationMode until such a time as the specification becomes stable. This
	// value is intended as a fallback value and implementers should very intentionally pick another option if they want
	// stability.
	TopOriginDefaultVerificationMode TopOriginVerificationMode = iota

	// TopOriginIgnoreVerificationMode ignores verification entirely.
	TopOriginIgnoreVerificationMode

	// TopOriginAutoVerificationMode represents the automatic verification mode for the Top Origin. In this mode the
	// If the Top Origins parameter has values it checks against this, otherwise it checks against the Origins parameter.
	TopOriginAutoVerificationMode

	// TopOriginImplicitVerificationMode represents the implicit verification mode for the Top Origin. In this mode the
	// Top Origin is verified against the allowed Origins values.
	TopOriginImplicitVerificationMode

	// TopOriginExplicitVerificationMode represents the explicit verification mode for the Top Origin. In this mode the
	// Top Origin is verified against the allowed Top Origins values.
	TopOriginExplicitVerificationMode
)

// IsOriginInHaystack checks if the needle is in the haystack using the mechanism to determine origin equality defined
// in HTML5 Section 5.3 and RFC3986 Section 6.2.1.
//
// Specifically if the needle value has the 'http://' or 'https://' prefix (case-insensitive) and can be parsed as a
// URL; we check each item in the haystack to see if it matches the same rules, and then if the scheme and host (with
// a normalized port) components match case-insensitively then they're considered a match.
//
// If the needle value does not have the 'http://' or 'https://' prefix (case-insensitive) or can't be parsed as a URL
// equality is determined using simple string comparison.
//
// It is important to note that this function completely ignores Apple Associated Domains entirely as Apple is using
// an unassigned Well-Known URI in breech of Well-Known Uniform Resource Identifiers (RFC8615).
//
// See (Origin Definition): https://www.w3.org/TR/2011/WD-html5-20110525/origin-0.html
//
// See (Simple String Comparison Definition): https://datatracker.ietf.org/doc/html/rfc3986#section-6.2.1
//
// See (Apple Associated Domains): https://developer.apple.com/documentation/xcode/supporting-associated-domains
//
// See (IANA Well Known URI Assignments): https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml
//
// See (Well-Known Uniform Resource Identifiers): https://datatracker.ietf.org/doc/html/rfc8615
func IsOriginInHaystack(needle string, haystack []string) bool {
	needleURI := parseOriginURI(needle)

	if needleURI != nil {
		for _, hay := range haystack {
			if hayURI := parseOriginURI(hay); hayURI != nil {
				if isOriginEqual(needleURI, hayURI) {
					return true
				}
			}
		}
	} else {
		for _, hay := range haystack {
			if needle == hay {
				return true
			}
		}
	}

	return false
}

func isOriginEqual(a *url.URL, b *url.URL) bool {
	if !strings.EqualFold(a.Scheme, b.Scheme) {
		return false
	}

	if !strings.EqualFold(a.Host, b.Host) {
		return false
	}

	return true
}

func parseOriginURI(raw string) *url.URL {
	if !isPossibleFQDN(raw) {
		return nil
	}

	// We can ignore the error here because it's effectively not a FQDN if this fails.
	uri, _ := url.Parse(raw)

	if uri == nil {
		return nil
	}

	// Normalize the port if necessary.
	switch uri.Scheme {
	case "http":
		if uri.Port() == "80" {
			uri.Host = uri.Hostname()
		}
	case "https":
		if uri.Port() == "443" {
			uri.Host = uri.Hostname()
		}
	}

	return uri
}

func isPossibleFQDN(raw string) bool {
	normalized := strings.ToLower(raw)

	return strings.HasPrefix(normalized, "http://") || strings.HasPrefix(normalized, "https://")
}
