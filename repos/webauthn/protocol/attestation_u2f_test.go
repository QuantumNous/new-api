package protocol

import (
	"crypto/sha256"
	"testing"

	"github.com/go-webauthn/webauthn/metadata"
)

func TestVerifyU2FFormat(t *testing.T) {
	type args struct {
		att            AttestationObject
		clientDataHash []byte
	}

	successAttResponse := attestationTestUnpackResponse(t, u2fTestResponse["success"]).Response.AttestationObject
	successClientDataHash := sha256.Sum256(attestationTestUnpackResponse(t, u2fTestResponse["success"]).Raw.AttestationResponse.ClientDataJSON)

	tests := []struct {
		name    string
		args    args
		want    string
		want1   []any
		wantErr bool
	}{
		{
			"success",
			args{
				successAttResponse,
				successClientDataHash[:],
			},
			string(metadata.BasicFull),
			nil,
			false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, _, err := attestationFormatValidationHandlerFIDOU2F(tt.args.att, tt.args.clientDataHash, nil)
			if (err != nil) != tt.wantErr {
				t.Errorf("attestationFormatValidationHandlerFIDOU2F() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if got != tt.want {
				t.Errorf("attestationFormatValidationHandlerFIDOU2F() got = %v, want %v", got, tt.want)
			}
		})
	}
}

var u2fTestResponse = map[string]string{
	`success`: `{
		"rawId": "7nJsttr4dLSsmrWnaHB3espJ0ua9rsJ2ws-93BFcNOP64g_s_4wLFDvklrNYcg0BCN6ddUjJLxDfDSBreKQLAw",
		"id": "7nJsttr4dLSsmrWnaHB3espJ0ua9rsJ2ws-93BFcNOP64g_s_4wLFDvklrNYcg0BCN6ddUjJLxDfDSBreKQLAw",
		"response": {
		  "clientDataJSON": "eyJjaGFsbGVuZ2UiOiJhTDJ1d0FwZ3d1bUJ6VFlDY29MMF80RFJ2X21mWXlremdxSkJGb0pqX1dDS05aT3B2VVFueWpkd01XSVdLY1k4NDR0eUROTE81cFFQQk1KckhQel8zZyIsImNsaWVudEV4dGVuc2lvbnMiOnt9LCJoYXNoQWxnb3JpdGhtIjoiU0hBLTI1NiIsIm9yaWdpbiI6Imh0dHBzOi8vbG9jYWxob3N0OjQ0MzI5IiwidHlwZSI6IndlYmF1dGhuLmNyZWF0ZSJ9",
		  "attestationObject": "o2NmbXRoZmlkby11MmZnYXR0U3RtdKJjc2lnWEcwRQIgRMxowC__Z-mgVR6netL6C7Q15weqiTCPwwq1EaeJVqMCIQCHb9cCad1VloGhQ60mw7KTJhkx61mfgKKwHUVZf1wR6mN4NWOBWQLCMIICvjCCAaagAwIBAgIEdIb9wjANBgkqhkiG9w0BAQsFADAuMSwwKgYDVQQDEyNZdWJpY28gVTJGIFJvb3QgQ0EgU2VyaWFsIDQ1NzIwMDYzMTAgFw0xNDA4MDEwMDAwMDBaGA8yMDUwMDkwNDAwMDAwMFowbzELMAkGA1UEBhMCU0UxEjAQBgNVBAoMCVl1YmljbyBBQjEiMCAGA1UECwwZQXV0aGVudGljYXRvciBBdHRlc3RhdGlvbjEoMCYGA1UEAwwfWXViaWNvIFUyRiBFRSBTZXJpYWwgMTk1NTAwMzg0MjBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABJVd8633JH0xde_9nMTzGk6HjrrhgQlWYVD7OIsuX2Unv1dAmqWBpQ0KxS8YRFwKE1SKE1PIpOWacE5SO8BN6-2jbDBqMCIGCSsGAQQBgsQKAgQVMS4zLjYuMS40LjEuNDE0ODIuMS4xMBMGCysGAQQBguUcAgEBBAQDAgUgMCEGCysGAQQBguUcAQEEBBIEEPigEfOMCk0VgAYXER-e3H0wDAYDVR0TAQH_BAIwADANBgkqhkiG9w0BAQsFAAOCAQEAMVxIgOaaUn44Zom9af0KqG9J655OhUVBVW-q0As6AIod3AH5bHb2aDYakeIyyBCnnGMHTJtuekbrHbXYXERIn4aKdkPSKlyGLsA_A-WEi-OAfXrNVfjhrh7iE6xzq0sg4_vVJoywe4eAJx0fS-Dl3axzTTpYl71Nc7p_NX6iCMmdik0pAuYJegBcTckE3AoYEg4K99AM_JaaKIblsbFh8-3LxnemeNf7UwOczaGGvjS6UzGVI0Odf9lKcPIwYhuTxM5CaNMXTZQ7xq4_yTfC3kPWtE4hFT34UJJflZBiLrxG4OsYxkHw_n5vKgmpspB3GfYuYTWhkDKiE8CYtyg87mhhdXRoRGF0YVjESZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NBAAAAAAAAAAAAAAAAAAAAAAAAAAAAQO5ybLba-HS0rJq1p2hwd3rKSdLmva7CdsLPvdwRXDTj-uIP7P-MCxQ75JazWHINAQjenXVIyS8Q3w0ga3ikCwOlAQIDJiABIVggUOAo5xqsJoPfJWsU50h7c2S7_llP0KwGI6vJkEj1N48iWCA2TMSeBfhJ84HyMQQgjJvBiA6JnHA0chxSlmuZeT9Xgg"
		},
		"type": "public-key"
	  }`,
}
