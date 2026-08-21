package protocol

import (
	"bytes"
	"encoding/base64"
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/go-webauthn/webauthn/protocol/webauthncbor"
)

func TestParseCredentialRequestResponse(t *testing.T) {
	byteID, _ := base64.RawURLEncoding.DecodeString("AI7D5q2P0LS-Fal9ZT7CHM2N5BLbUunF92T8b6iYC199bO2kagSuU05-5dZGqb1SP0A0lyTWng")
	byteAAGUID, _ := base64.RawURLEncoding.DecodeString("rc4AAjW8xgpkiwsl8fBVAw")
	byteRPIDHash, _ := base64.RawURLEncoding.DecodeString("dKbqkhPJnC90siSSsyDPQCYqlMGpUKA5fyklC2CEHvA")
	byteAuthData, _ := base64.RawURLEncoding.DecodeString("dKbqkhPJnC90siSSsyDPQCYqlMGpUKA5fyklC2CEHvBFXJJiGa3OAAI1vMYKZIsLJfHwVQMANwCOw-atj9C0vhWpfWU-whzNjeQS21Lpxfdk_G-omAtffWztpGoErlNOfuXWRqm9Uj9ANJck1p6lAQIDJiABIVggKAhfsdHcBIc0KPgAcRyAIK_-Vi-nCXHkRHPNaCMBZ-4iWCBxB8fGYQSBONi9uvq0gv95dGWlhJrBwCsj_a4LJQKVHQ")
	byteSignature, _ := base64.RawURLEncoding.DecodeString("MEUCIBtIVOQxzFYdyWQyxaLR0tik1TnuPhGVhXVSNgFwLmN5AiEAnxXdCq0UeAVGWxOaFcjBZ_mEZoXqNboY5IkQDdlWZYc")
	byteUserHandle, _ := base64.RawURLEncoding.DecodeString("0ToAAAAAAAAAAA")
	byteCredentialPubKey, _ := base64.RawURLEncoding.DecodeString("pQMmIAEhWCAoCF-x0dwEhzQo-ABxHIAgr_5WL6cJceREc81oIwFn7iJYIHEHx8ZhBIE42L26-rSC_3l0ZaWEmsHAKyP9rgslApUdAQI")
	byteClientDataJSON, _ := base64.RawURLEncoding.DecodeString("eyJjaGFsbGVuZ2UiOiJFNFBUY0lIX0hmWDFwQzZTaWdrMVNDOU5BbGdlenROMDQzOXZpOHpfYzlrIiwibmV3X2tleXNfbWF5X2JlX2FkZGVkX2hlcmUiOiJkbyBub3QgY29tcGFyZSBjbGllbnREYXRhSlNPTiBhZ2FpbnN0IGEgdGVtcGxhdGUuIFNlZSBodHRwczovL2dvby5nbC95YWJQZXgiLCJvcmlnaW4iOiJodHRwczovL3dlYmF1dGhuLmlvIiwidHlwZSI6IndlYmF1dGhuLmdldCJ9")

	type args struct {
		responseName string
	}

	testCases := []struct {
		name       string
		args       args
		expected   *ParsedCredentialAssertionData
		errString  string
		errType    string
		errDetails string
		errInfo    string
	}{
		{
			name: "ShouldParseCredentialAssertion",
			args: args{
				"success",
			},
			expected: &ParsedCredentialAssertionData{
				ParsedPublicKeyCredential: ParsedPublicKeyCredential{
					ParsedCredential: ParsedCredential{
						ID:   "AI7D5q2P0LS-Fal9ZT7CHM2N5BLbUunF92T8b6iYC199bO2kagSuU05-5dZGqb1SP0A0lyTWng",
						Type: string(PublicKeyCredentialType),
					},
					RawID: byteID,
					ClientExtensionResults: map[string]any{
						"appID": "example.com",
					},
				},
				Response: ParsedAssertionResponse{
					CollectedClientData: CollectedClientData{
						Type:      CeremonyType("webauthn.get"),
						Challenge: "E4PTcIH_HfX1pC6Sigk1SC9NAlgeztN0439vi8z_c9k",
						Origin:    "https://webauthn.io",
						Hint:      "do not compare clientDataJSON against a template. See https://goo.gl/yabPex",
					},
					AuthenticatorData: AuthenticatorData{
						RPIDHash: byteRPIDHash,
						Counter:  1553097241,
						Flags:    0x045,
						AttData: AttestedCredentialData{
							AAGUID:              byteAAGUID,
							CredentialID:        byteID,
							CredentialPublicKey: byteCredentialPubKey,
						},
					},
					Signature:  byteSignature,
					UserHandle: byteUserHandle,
				},
				Raw: CredentialAssertionResponse{
					PublicKeyCredential: PublicKeyCredential{
						Credential: Credential{
							Type: string(PublicKeyCredentialType),
							ID:   "AI7D5q2P0LS-Fal9ZT7CHM2N5BLbUunF92T8b6iYC199bO2kagSuU05-5dZGqb1SP0A0lyTWng",
						},
						RawID: byteID,
						ClientExtensionResults: map[string]any{
							"appID": "example.com",
						},
					},
					AssertionResponse: AuthenticatorAssertionResponse{
						AuthenticatorResponse: AuthenticatorResponse{
							ClientDataJSON: byteClientDataJSON,
						},
						AuthenticatorData: byteAuthData,
						Signature:         byteSignature,
						UserHandle:        byteUserHandle,
					},
				},
			},
			errString: "",
		},
		{
			name: "ShouldHandleTrailingData",
			args: args{
				"trailingData",
			},
			expected:   nil,
			errString:  "Parse error for Assertion",
			errType:    "invalid_request",
			errDetails: "Parse error for Assertion",
			errInfo:    "The body contains trailing data",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			body := io.NopCloser(bytes.NewReader([]byte(testAssertionResponses[tc.args.responseName])))

			actual, err := ParseCredentialRequestResponseBody(body)

			if tc.errString != "" {
				assert.EqualError(t, err, tc.errString)

				AssertIsProtocolError(t, err, tc.errType, tc.errDetails, tc.errInfo)

				return
			}

			require.NoError(t, err)

			assert.Equal(t, tc.expected.ClientExtensionResults, actual.ClientExtensionResults)
			assert.Equal(t, tc.expected.ID, actual.ID)
			assert.Equal(t, tc.expected.ParsedCredential, actual.ParsedCredential)
			assert.Equal(t, tc.expected.ParsedPublicKeyCredential, actual.ParsedPublicKeyCredential)
			assert.Equal(t, tc.expected.Raw, actual.Raw)
			assert.Equal(t, tc.expected.RawID, actual.RawID)

			assert.Equal(t, tc.expected.Response.CollectedClientData, actual.Response.CollectedClientData)

			var (
				pkExpected, pkActual any
			)

			assert.NoError(t, webauthncbor.Unmarshal(tc.expected.Response.AuthenticatorData.AttData.CredentialPublicKey, &pkExpected))
			assert.NoError(t, webauthncbor.Unmarshal(actual.Response.AuthenticatorData.AttData.CredentialPublicKey, &pkActual))

			assert.Equal(t, pkExpected, pkActual)
			assert.NotEqual(t, nil, pkExpected)
			assert.NotEqual(t, nil, pkActual)
		})
	}
}

func TestParsedCredentialAssertionData_Verify(t *testing.T) {
	type fields struct {
		ParsedPublicKeyCredential ParsedPublicKeyCredential
		Response                  ParsedAssertionResponse
		Raw                       CredentialAssertionResponse
	}

	type args struct {
		storedChallenge    URLEncodedBase64
		relyingPartyID     string
		relyingPartyOrigin []string
		verifyUser         bool
		credentialBytes    []byte
	}

	tests := []struct {
		name    string
		fields  fields
		args    args
		wantErr bool
	}{
		// TODO: Add test cases.
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := &ParsedCredentialAssertionData{
				ParsedPublicKeyCredential: tt.fields.ParsedPublicKeyCredential,
				Response:                  tt.fields.Response,
				Raw:                       tt.fields.Raw,
			}

			if err := p.Verify(tt.args.storedChallenge.String(), tt.args.relyingPartyID, tt.args.relyingPartyOrigin, nil, TopOriginIgnoreVerificationMode, "", tt.args.verifyUser, false, tt.args.credentialBytes); (err != nil) != tt.wantErr {
				t.Errorf("ParsedCredentialAssertionData.Verify() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

var testAssertionResponses = map[string]string{
	// None Attestation - MacOS TouchID.
	`success`: `{
		"id":"AI7D5q2P0LS-Fal9ZT7CHM2N5BLbUunF92T8b6iYC199bO2kagSuU05-5dZGqb1SP0A0lyTWng",
		"rawId":"AI7D5q2P0LS-Fal9ZT7CHM2N5BLbUunF92T8b6iYC199bO2kagSuU05-5dZGqb1SP0A0lyTWng",
		"clientExtensionResults":{"appID":"example.com"},
		"type":"public-key",
		"response":{
			"authenticatorData":"dKbqkhPJnC90siSSsyDPQCYqlMGpUKA5fyklC2CEHvBFXJJiGa3OAAI1vMYKZIsLJfHwVQMANwCOw-atj9C0vhWpfWU-whzNjeQS21Lpxfdk_G-omAtffWztpGoErlNOfuXWRqm9Uj9ANJck1p6lAQIDJiABIVggKAhfsdHcBIc0KPgAcRyAIK_-Vi-nCXHkRHPNaCMBZ-4iWCBxB8fGYQSBONi9uvq0gv95dGWlhJrBwCsj_a4LJQKVHQ",
			"clientDataJSON":"eyJjaGFsbGVuZ2UiOiJFNFBUY0lIX0hmWDFwQzZTaWdrMVNDOU5BbGdlenROMDQzOXZpOHpfYzlrIiwibmV3X2tleXNfbWF5X2JlX2FkZGVkX2hlcmUiOiJkbyBub3QgY29tcGFyZSBjbGllbnREYXRhSlNPTiBhZ2FpbnN0IGEgdGVtcGxhdGUuIFNlZSBodHRwczovL2dvby5nbC95YWJQZXgiLCJvcmlnaW4iOiJodHRwczovL3dlYmF1dGhuLmlvIiwidHlwZSI6IndlYmF1dGhuLmdldCJ9",
			"signature":"MEUCIBtIVOQxzFYdyWQyxaLR0tik1TnuPhGVhXVSNgFwLmN5AiEAnxXdCq0UeAVGWxOaFcjBZ_mEZoXqNboY5IkQDdlWZYc",
			"userHandle":"0ToAAAAAAAAAAA"}
		}
	`,
	`trailingData`: `{
		"id":"AI7D5q2P0LS-Fal9ZT7CHM2N5BLbUunF92T8b6iYC199bO2kagSuU05-5dZGqb1SP0A0lyTWng",
		"rawId":"AI7D5q2P0LS-Fal9ZT7CHM2N5BLbUunF92T8b6iYC199bO2kagSuU05-5dZGqb1SP0A0lyTWng",
		"clientExtensionResults":{"appID":"example.com"},
		"type":"public-key",
		"response":{
			"authenticatorData":"dKbqkhPJnC90siSSsyDPQCYqlMGpUKA5fyklC2CEHvBFXJJiGa3OAAI1vMYKZIsLJfHwVQMANwCOw-atj9C0vhWpfWU-whzNjeQS21Lpxfdk_G-omAtffWztpGoErlNOfuXWRqm9Uj9ANJck1p6lAQIDJiABIVggKAhfsdHcBIc0KPgAcRyAIK_-Vi-nCXHkRHPNaCMBZ-4iWCBxB8fGYQSBONi9uvq0gv95dGWlhJrBwCsj_a4LJQKVHQ",
			"clientDataJSON":"eyJjaGFsbGVuZ2UiOiJFNFBUY0lIX0hmWDFwQzZTaWdrMVNDOU5BbGdlenROMDQzOXZpOHpfYzlrIiwibmV3X2tleXNfbWF5X2JlX2FkZGVkX2hlcmUiOiJkbyBub3QgY29tcGFyZSBjbGllbnREYXRhSlNPTiBhZ2FpbnN0IGEgdGVtcGxhdGUuIFNlZSBodHRwczovL2dvby5nbC95YWJQZXgiLCJvcmlnaW4iOiJodHRwczovL3dlYmF1dGhuLmlvIiwidHlwZSI6IndlYmF1dGhuLmdldCJ9",
			"signature":"MEUCIBtIVOQxzFYdyWQyxaLR0tik1TnuPhGVhXVSNgFwLmN5AiEAnxXdCq0UeAVGWxOaFcjBZ_mEZoXqNboY5IkQDdlWZYc",
			"userHandle":"0ToAAAAAAAAAAA"}
		}

trailing
	`,
}
