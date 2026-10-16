package webauthn

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/go-webauthn/webauthn/protocol"
)

func TestLogin_FinishLoginFailure(t *testing.T) {
	user := &defaultUser{
		id: []byte("123"),
	}

	session := SessionData{
		UserID: []byte("ABC"),
	}

	webauthn := &WebAuthn{}

	credential, err := webauthn.FinishLogin(user, session, nil)
	if err == nil {
		t.Errorf("FinishLogin() error = nil, want %v", protocol.ErrBadRequest.Type)
	}

	if credential != nil {
		t.Errorf("FinishLogin() credential = %v, want nil", credential)
	}
}

func TestWithLoginRelyingPartyID(t *testing.T) {
	testCases := []struct {
		name              string
		have              *Config
		opts              []LoginOption
		expectedID        string
		expectedChallenge []byte
		err               string
	}{
		{
			name: "OptionDefinedInConfig",
			have: &Config{
				RPID:          "https://example.com",
				RPDisplayName: "Test Display Name",
				RPOrigins:     []string{"https://example.com"},
			},
			opts:       nil,
			expectedID: "https://example.com",
		},
		{
			name: "OptionDefinedInConfigAndOpts",
			have: &Config{
				RPID:          "https://example.com",
				RPDisplayName: "Test Display Name",
				RPOrigins:     []string{"https://example.com"},
			},
			opts:       []LoginOption{WithLoginRelyingPartyID("https://a.example.com")},
			expectedID: "https://a.example.com",
		},
		{
			name: "OptionDefinedInConfigWithNoErrAndInOptsWithError",
			have: &Config{
				RPID:          "https://example.com",
				RPDisplayName: "Test Display Name",
				RPOrigins:     []string{"https://example.com"},
			},
			opts: []LoginOption{WithLoginRelyingPartyID("---::~!!~@#M!@OIK#N!@IOK@@@@@@@@@@")},
			err:  "error generating assertion: the relying party id failed to validate as it's not a valid uri with error: parse \"---::~!!~@\": first path segment in URL cannot contain colon",
		},
		{
			name: "OptionDefinedInOpts",
			have: &Config{
				RPOrigins: []string{"https://example.com"},
			},
			opts:       []LoginOption{WithLoginRelyingPartyID("https://example.com")},
			expectedID: "https://example.com",
		},
		{
			name: "OptionIDNotDefined",
			have: &Config{
				RPOrigins: []string{"https://example.com"},
			},
			opts: nil,
			err:  "error generating assertion: the relying party id must be provided via the configuration or a functional option for a login",
		},
		{
			name: "TooShortWithChallengeOption",
			have: &Config{
				RPID:          "https://example.com",
				RPOrigins:     []string{"https://example.com"},
				RPDisplayName: "Test Display Name",
			},
			opts: []LoginOption{WithChallenge([]byte("1234567890"))},
			err:  "error generating assertion: the challenge must be at least 16 bytes",
		},
		{
			name: "WithChallengeOption",
			have: &Config{
				RPID:          "https://example.com",
				RPOrigins:     []string{"https://example.com"},
				RPDisplayName: "Test Display Name",
			},
			opts:              []LoginOption{WithChallenge([]byte("00000000000000000000000000000000"))},
			expectedID:        "https://example.com",
			expectedChallenge: []byte("00000000000000000000000000000000"),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			w, err := New(tc.have)
			assert.NoError(t, err)

			user := &defaultUser{
				credentials: []Credential{
					{},
				},
			}

			creation, _, err := w.BeginLogin(user, tc.opts...)
			if tc.err != "" {
				assert.EqualError(t, err, tc.err)
			} else {
				assert.NoError(t, err)
				require.NotNil(t, creation)
				assert.Equal(t, tc.expectedID, creation.Response.RelyingPartyID)

				if len(tc.expectedChallenge) > 0 {
					assert.Equal(t, protocol.URLEncodedBase64(tc.expectedChallenge).String(), creation.Response.Challenge.String())
				}
			}
		})
	}
}

func TestFinishLoginFailure(t *testing.T) {
	const (
		credentialID = "AI7D5q2P0LS-Fal9ZT7CHM2N5BLbUunF92T8b6iYC199bO2kagSuU05-5dZGqb1SP0A0lyTWng" //nolint:gosec
		userHandle   = "0ToAAAAAAAAAAA"
	)

	var (
		byteUserHandle, _       = base64.RawURLEncoding.DecodeString(userHandle)
		byteID, _               = base64.RawURLEncoding.DecodeString(credentialID)
		byteCredentialPubKey, _ = base64.RawURLEncoding.DecodeString("pQMmIAEhWCAoCF-x0dwEhzQo-ABxHIAgr_5WL6cJceREc81oIwFn7iJYIHEHx8ZhBIE42L26-rSC_3l0ZaWEmsHAKyP9rgslApUdAQI")
		byteAAGUID, _           = base64.RawURLEncoding.DecodeString("rc4AAjW8xgpkiwsl8fBVAw")
	)

	credentials := []Credential{
		{
			ID:        byteID,
			PublicKey: byteCredentialPubKey,
			Authenticator: Authenticator{
				AAGUID: byteAAGUID,
			},
		},
	}

	user := &defaultUser{
		id:          byteUserHandle,
		credentials: credentials,
	}

	session := SessionData{
		UserID:               byteUserHandle,
		Challenge:            "E4PTcIH_HfX1pC6Sigk1SC9NAlgeztN0439vi8z_c9k",
		AllowedCredentialIDs: [][]byte{[]byte("test"), byteID},
	}

	webauthn := &WebAuthn{
		Config: &Config{
			RPDisplayName: "test_rp",
			RPOrigins:     []string{"https://webauthn.io"},
			RPID:          "webauthn.io",
		},
	}

	reqBody := io.NopCloser(bytes.NewReader([]byte(fmt.Sprintf(`{
			"id":"%[1]s",
			"rawId":"%[1]s",
			"type":"public-key",
			"response":{
				"authenticatorData":"dKbqkhPJnC90siSSsyDPQCYqlMGpUKA5fyklC2CEHvBFXJJiGa3OAAI1vMYKZIsLJfHwVQMANwCOw-atj9C0vhWpfWU-whzNjeQS21Lpxfdk_G-omAtffWztpGoErlNOfuXWRqm9Uj9ANJck1p6lAQIDJiABIVggKAhfsdHcBIc0KPgAcRyAIK_-Vi-nCXHkRHPNaCMBZ-4iWCBxB8fGYQSBONi9uvq0gv95dGWlhJrBwCsj_a4LJQKVHQ",
				"clientDataJSON":"eyJjaGFsbGVuZ2UiOiJFNFBUY0lIX0hmWDFwQzZTaWdrMVNDOU5BbGdlenROMDQzOXZpOHpfYzlrIiwibmV3X2tleXNfbWF5X2JlX2FkZGVkX2hlcmUiOiJkbyBub3QgY29tcGFyZSBjbGllbnREYXRhSlNPTiBhZ2FpbnN0IGEgdGVtcGxhdGUuIFNlZSBodHRwczovL2dvby5nbC95YWJQZXgiLCJvcmlnaW4iOiJodHRwczovL3dlYmF1dGhuLmlvIiwidHlwZSI6IndlYmF1dGhuLmdldCJ9",
				"signature":"MEUCIBtIVOQxzFYdyWQyxaLR0tik1TnuPhGVhXVSNgFwLmN5AiEAnxXdCq0UeAVGWxOaFcjBZ_mEZoXqNboY5IkQDdlWZYc",
				"userHandle":"%[2]s"
			}
		}`, credentialID, userHandle,
	))))
	httpReq := &http.Request{Body: reqBody}

	_, err := webauthn.FinishLogin(user, session, httpReq)

	require.Equal(t, err, protocol.ErrBadRequest.WithDetails("User does not own all credentials from the allowed credential list"))
}
