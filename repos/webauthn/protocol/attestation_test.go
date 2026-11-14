package protocol

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAttestationVerify(t *testing.T) {
	for i := range testAttestationOptions {
		t.Run(fmt.Sprintf("Running test %d", i), func(t *testing.T) {
			options := CredentialCreation{}

			require.NoError(t, json.Unmarshal([]byte(testAttestationOptions[i]), &options))

			ccr := CredentialCreationResponse{}

			require.NoError(t, json.Unmarshal([]byte(testAttestationResponses[i]), &ccr))

			var pcc ParsedCredentialCreationData

			pcc.ID, pcc.RawID, pcc.Type, pcc.ClientExtensionResults = ccr.ID, ccr.RawID, ccr.Type, ccr.ClientExtensionResults
			pcc.Raw = ccr

			parsedAttestationResponse, err := ccr.AttestationResponse.Parse()
			require.NoError(t, err)

			pcc.Response = *parsedAttestationResponse

			_, err = pcc.Verify(options.Response.Challenge.String(), false, false, options.Response.RelyingParty.ID, []string{options.Response.RelyingParty.Name}, nil, TopOriginIgnoreVerificationMode, nil, options.Response.Parameters)

			require.NoError(t, err)
		})
	}
}

func attestationTestUnpackResponse(t *testing.T, response string) (pcc ParsedCredentialCreationData) {
	ccr := CredentialCreationResponse{}

	require.NoError(t, json.Unmarshal([]byte(response), &ccr))

	pcc.ID, pcc.RawID, pcc.Type, pcc.ClientExtensionResults = ccr.ID, ccr.RawID, ccr.Type, ccr.ClientExtensionResults
	pcc.Raw = ccr

	parsedAttestationResponse, err := ccr.AttestationResponse.Parse()
	require.NoError(t, err)

	pcc.Response = *parsedAttestationResponse

	return pcc
}

func TestPackedAttestationVerification(t *testing.T) {
	t.Run("Testing Self Packed", func(t *testing.T) {
		pcc := attestationTestUnpackResponse(t, testAttestationResponses[0])

		// Test Packed Verification. Unpack args.
		clientDataHash := sha256.Sum256(pcc.Raw.AttestationResponse.ClientDataJSON)

		_, _, err := attestationFormatValidationHandlerPacked(pcc.Response.AttestationObject, clientDataHash[:], nil)
		require.NoError(t, err)
	})
}

var testAttestationOptions = []string{
	// Direct Self Attestation with EC256 - MacOS.
	`{"publicKey": {
		"challenge": "rWiex8xDOPfiCgyFu4BLW6vVOmXKgPwHrlMCgEs9SBA",
		"rp": {
		"name": "http://localhost:9005",
		"id": "localhost"
		},
		"user": {
			"name": "self",
			"displayName": "self",
			"id": "2iEAAAAAAAAAAA=="
		},
		"pubKeyCredParams": [
			{
				"type": "public-key",
				"alg": -7
			}
		],
		"authenticatorSelection": {
		"authenticatorAttachment": "cross-platform",
		"userVerification": "preferred"
		},
		"timeout": 60000,
		"attestation": "direct"
	}}`,
	// Direct Attestation with EC256.
	`{"publicKey": {
		"challenge": "-Ri5NZTzJ8b6mvW3TVScLotEoALfgBa2Bn4YSaIObHc",
		"rp": {
		"name": "https://webauthn.io",
		"id": "webauthn.io"
		},
		"user": {
			"name": "flort",
			"displayName": "flort",
			"id": "1DMAAAAAAAAAAA=="
		},
		"pubKeyCredParams": [
			{
				"type": "public-key",
				"alg": -7
			}
		],
		"authenticatorSelection": {
		"authenticatorAttachment": "cross-platform",
		"userVerification": "preferred"
		},
		"timeout": 60000,
		"attestation": "direct"
	}}`,
	// None Attestation with EC256.
	`{
		"publicKey": {
		  "challenge": "sVt4ScceMzqFSnfAq8hgLzblvo3fa4_aFVEcIESHIJ0",
		  "rp": {
			"name": "https://webauthn.io",
			"id": "webauthn.io"
		  },
		  "user": {
			"name": "testuser1",
			"displayName": "testuser1",
			"id": "1zMAAAAAAAAAAA=="
		  },
		  "pubKeyCredParams": [
			{
			  "type": "public-key",
			  "alg": -7
			}
		  ],
		  "authenticatorSelection": {
			"authenticatorAttachment": "cross-platform",
			"userVerification": "preferred"
		  },
		  "timeout": 60000,
		  "attestation": "none"
		}
	  }`,
	`{
		"publicKey": {
			"rp": {
				"name": "https://gramthanos.github.io",
				"id": "gramthanos.github.io"
			},
			"user": {
				"name": "john.smith@email.com",
				"displayName": "J. Smith",
				"id": "am9obi5zbWl0aEBlbWFpbC5jb20="
			},
			"challenge": "Dw4NDAsKCQgHBgUEAwIBAA==",
			"pubKeyCredParams": [
				{"type": "public-key", "alg": -7},
				{"type": "public-key", "alg": -37},
				{"type": "public-key", "alg": -257},
				{"type": "public-key", "alg": -8}
			],
			"timeout": 120000,
			"attestation": "direct"
		}
	}`,
}

var testAttestationResponses = []string{
	// Self Attestation with EC256 - MacOS.
	`{ 
		"id": "AOx6vFGGITtlwjhqFFvAkJmBzSzfwE1dBa1fVR_Ltq5L35FJRNdgkXe84v3-0TEVNCSp",
		"rawId": "AOx6vFGGITtlwjhqFFvAkJmBzSzfwE1dBa1fVR_Ltq5L35FJRNdgkXe84v3-0TEVNCSp",
		"response": {
			"attestationObject": "o2NmbXRmcGFja2VkZ2F0dFN0bXSiY2FsZyZjc2lnWEcwRQIhAJgdgw5x8JzE4JfR6x1RBO8eCHNE8eW_L1VTV03zpyL5AiBv8eUzua3XSS3bPYC7m8eXzJhcaRyeGe7UcuqIrDSvC2hhdXRoRGF0YVi3SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NFXJE5zK3OAAI1vMYKZIsLJfHwVQMAMwDserxRhiE7ZcI4ahRbwJCZgc0s38BNXQWtX1Ufy7auS9-RSUTXYJF3vOL9_tExFTQkqaUBAgMmIAEhWCCm9OYidwiIoH9SwVQqUAnH8Gj5ZJ2_qr8gjbg41q4M1SJYIA07XKpHSgS1mE7R1MjotVIQqyHi9WAxGwHQsCteVK2V",
			"clientDataJSON": "eyJjaGFsbGVuZ2UiOiJyV2lleDh4RE9QZmlDZ3lGdTRCTFc2dlZPbVhLZ1B3SHJsTUNnRXM5U0JBIiwib3JpZ2luIjoiaHR0cDovL2xvY2FsaG9zdDo5MDA1IiwidHlwZSI6IndlYmF1dGhuLmNyZWF0ZSJ9"
		},
		"type": "public-key"
	}`,
	// Direct Attestation with EC256 - Titan.
	`{ 
		"id": "FOxcmsqPLNCHtyILvbNkrtHMdKAeqSJXYZDbeFd0kc5Enm8Kl6a0Jp0szgLilDw1S4CjZhe9Z2611EUGbjyEmg",
		"rawId": "FOxcmsqPLNCHtyILvbNkrtHMdKAeqSJXYZDbeFd0kc5Enm8Kl6a0Jp0szgLilDw1S4CjZhe9Z2611EUGbjyEmg",
		"response": {
			"attestationObject": "o2NmbXRoZmlkby11MmZnYXR0U3RtdKJjc2lnWEYwRAIgfyIhwZj-fkEVyT1GOK8chDHJR2chXBLSRg6bTCjODmwCIHH6GXI_BQrcR-GHg5JfazKVQdezp6_QWIFfT4ltTCO2Y3g1Y4FZAlMwggJPMIIBN6ADAgECAgQSNtF_MA0GCSqGSIb3DQEBCwUAMC4xLDAqBgNVBAMTI1l1YmljbyBVMkYgUm9vdCBDQSBTZXJpYWwgNDU3MjAwNjMxMCAXDTE0MDgwMTAwMDAwMFoYDzIwNTAwOTA0MDAwMDAwWjAxMS8wLQYDVQQDDCZZdWJpY28gVTJGIEVFIFNlcmlhbCAyMzkyNTczNDEwMzI0MTA4NzBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABNNlqR5emeDVtDnA2a-7h_QFjkfdErFE7bFNKzP401wVE-QNefD5maviNnGVk4HJ3CsHhYuCrGNHYgTM9zTWriGjOzA5MCIGCSsGAQQBgsQKAgQVMS4zLjYuMS40LjEuNDE0ODIuMS41MBMGCysGAQQBguUcAgEBBAQDAgUgMA0GCSqGSIb3DQEBCwUAA4IBAQAiG5uzsnIk8T6-oyLwNR6vRklmo29yaYV8jiP55QW1UnXdTkEiPn8mEQkUac-Sn6UmPmzHdoGySG2q9B-xz6voVQjxP2dQ9sgbKd5gG15yCLv6ZHblZKkdfWSrUkrQTrtaziGLFSbxcfh83vUjmOhDLFC5vxV4GXq2674yq9F2kzg4nCS4yXrO4_G8YWR2yvQvE2ffKSjQJlXGO5080Ktptplv5XN4i5lS-AKrT5QRVbEJ3B4g7G0lQhdYV-6r4ZtHil8mF4YNMZ0-RaYPxAaYNWkFYdzOZCaIdQbXRZefgGfbMUiAC2gwWN7fiPHV9eu82NYypGU32OijG9BjhGt_aGF1dGhEYXRhWMR0puqSE8mcL3SyJJKzIM9AJiqUwalQoDl_KSULYIQe8EEAAAAAAAAAAAAAAAAAAAAAAAAAAABAFOxcmsqPLNCHtyILvbNkrtHMdKAeqSJXYZDbeFd0kc5Enm8Kl6a0Jp0szgLilDw1S4CjZhe9Z2611EUGbjyEmqUBAgMmIAEhWCD_ap3Q9zU8OsGe967t48vyRxqn8NfFTk307mC1WsH2ISJYIIcqAuW3MxhU0uDtaSX8-Ftf_zeNJLdCOEjZJGHsrLxH",
			"clientDataJSON": "eyJjaGFsbGVuZ2UiOiItUmk1TlpUeko4YjZtdlczVFZTY0xvdEVvQUxmZ0JhMkJuNFlTYUlPYkhjIiwib3JpZ2luIjoiaHR0cHM6Ly93ZWJhdXRobi5pbyIsInR5cGUiOiJ3ZWJhdXRobi5jcmVhdGUifQ"
		},
		"type": "public-key"
	}`,
	// None Attestation with EC256 - Titan.
	`{
		"id": "6Jry73M_WVWDoXLsGxRsBVVHpPWDpNy1ETGXUEvJLdTAn5Ew6nDGU6W8iO3ZkcLEqr-CBwvx0p2WAxzt8RiwQQ",
		"rawId": "6Jry73M_WVWDoXLsGxRsBVVHpPWDpNy1ETGXUEvJLdTAn5Ew6nDGU6W8iO3ZkcLEqr-CBwvx0p2WAxzt8RiwQQ",
		"response": {
			"attestationObject": "o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YVjEdKbqkhPJnC90siSSsyDPQCYqlMGpUKA5fyklC2CEHvBBAAAAAAAAAAAAAAAAAAAAAAAAAAAAQOia8u9zP1lVg6Fy7BsUbAVVR6T1g6TctRExl1BLyS3UwJ-RMOpwxlOlvIjt2ZHCxKq_ggcL8dKdlgMc7fEYsEGlAQIDJiABIVgg--n_QvZithDycYmnifk6vMHiwBP6kugn2PlsnvkrcSgiWCBAlBYm2B-rMtQlp5MxGTLoGDHoktxb0p364Hy2BH9U2Q",
			"clientDataJSON": "eyJjaGFsbGVuZ2UiOiJzVnQ0U2NjZU16cUZTbmZBcThoZ0x6Ymx2bzNmYTRfYUZWRWNJRVNISUowIiwib3JpZ2luIjoiaHR0cHM6Ly93ZWJhdXRobi5pbyIsInR5cGUiOiJ3ZWJhdXRobi5jcmVhdGUifQ"
		},
		"type": "public-key"
	}`, `{
		"type": "public-key",
		"id": "GramThanos8pyTMpdk0qJLv3eLhUP3EXIXjD-uyqD0gab1pdvGy1ig77ZLl_ZU_vnd2296FoIZ67pZqTChpSJPq_oqUhjmr5Osv_LLiY7YGsAafMUdIb_LKOdwc6sfXyy_Ygl3_w-vl3tU9EPGyzgtI7hTBeMXnSIaOV6CUUf6d9op4JyxEDJr-roWxRMJPfnVAMLvv4lF_Cpd6Of0o75nDcCtEsTiynINihIwee1gmg0BAVKh3seWoNqXMpiXgPWc9Jt8ibjN9O-bsag3tELVs9uOoe-NZEmwbph0jJh_Y6e2H5Nwkp7WghST0P6krTL_sUlbpmDolhfFut0YljLrOrz_llW-WHySwvaAG2vzgvxA",
		"rawId": "GramThanos8pyTMpdk0qJLv3eLhUP3EXIXjD-uyqD0gab1pdvGy1ig77ZLl_ZU_vnd2296FoIZ67pZqTChpSJPq_oqUhjmr5Osv_LLiY7YGsAafMUdIb_LKOdwc6sfXyy_Ygl3_w-vl3tU9EPGyzgtI7hTBeMXnSIaOV6CUUf6d9op4JyxEDJr-roWxRMJPfnVAMLvv4lF_Cpd6Of0o75nDcCtEsTiynINihIwee1gmg0BAVKh3seWoNqXMpiXgPWc9Jt8ibjN9O-bsag3tELVs9uOoe-NZEmwbph0jJh_Y6e2H5Nwkp7WghST0P6krTL_sUlbpmDolhfFut0YljLrOrz_llW-WHySwvaAG2vzgvxA",
		"response": {
			"clientDataJSON": "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiRHc0TkRBc0tDUWdIQmdVRUF3SUJBQSIsIm9yaWdpbiI6Imh0dHBzOi8vZ3JhbXRoYW5vcy5naXRodWIuaW8iLCJjcm9zc09yaWdpbiI6ZmFsc2UsInZpcnR1YWxfYXV0aGVudGljYXRvciI6IkdyYW1UaGFub3MgJiBVbml2ZXJzaXR5IG9mIFBpcmFldXMifQ",
			"attestationObject": "o2NmbXRmcGFja2VkZ2F0dFN0bXSjY2FsZyZjc2lnWEYwRAIgaTjQj-hC9GH1fCbOT_8m4wdVJBZMG0252iBEwIGKWkUCIApZyPGh_ihn57GRKN-qTVCwgBqe4V40LL-r9_Y2pRXiY3g1Y4FZAgUwggIBMIIBpqADAgECAgVixtGpsjAKBggqhkjOPQQDAjBQMQswCQYDVQQGEwJHUjESMBAGA1UECgwJVU5JUEkgU1NMMS0wKwYDVQQDEyRVTklQSSBGSURPMiBWaXJ0dWFsIEF1dGhlbnRpY2F0b3IgQ0EwIhgPMjAyMDEyMzEyMjAwMDBaGA8yMTIwMTIzMTIyMDAwMFowcTELMAkGA1UEBhMCR1IxEjAQBgNVBAoMCVVOSVBJIFNTTDEiMCAGA1UECwwZQXV0aGVudGljYXRvciBBdHRlc3RhdGlvbjEqMCgGA1UEAwwhVU5JUEkgRklETzIgVmlydHVhbCBBdXRoZW50aWNhdG9yMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE_l8G-E0tTiXogmgXZZ0nRUMc7NO5-sowWP0lZhX8GZbU_n2TPO1J-39UbRABHUK_2J-ZbzcDAu2oy_nazsz4CqNIMEYwIQYLKwYBBAGC5RwBAQQEEgQQCJhwWMrcS4G24TDeUNy-ljATBgsrBgEEAYLlHAIBAQQEAwIFIDAMBgNVHRMBAf8EAjAAMAoGCCqGSM49BAMCA0kAMEYCIQDsyXh97GlMAcRq8khd4U-26d1E92a0lupZUGNBlki_MQIhAJFqO_qmBakyeD1esP4v3gIWsYKmHpiwJ64UKlid5NobaGF1dGhEYXRhWQGWou-FTChrR7AO-C0KXtsaxN1QIX4DOq_aCmYeKeUXnlZFAAAAAQiYcFjK3EuBtuEw3lDcvpYBEhq2pk4Wp6LPKckzKXZNKiS793i4VD9xFyF4w_rsqg9IGm9aXbxstYoO-2S5f2VP753dtvehaCGeu6WakwoaUiT6v6KlIY5q-TrL_yy4mO2BrAGnzFHSG_yyjncHOrH18sv2IJd_8Pr5d7VPRDxss4LSO4UwXjF50iGjleglFH-nfaKeCcsRAya_q6FsUTCT351QDC77-JRfwqXejn9KO-Zw3ArRLE4spyDYoSMHntYJoNAQFSod7HlqDalzKYl4D1nPSbfIm4zfTvm7GoN7RC1bPbjqHvjWRJsG6YdIyYf2Onth-TcJKe1oIUk9D-pK0y_7FJW6Zg6JYXxbrdGJYy6zq8_5ZVvlh8ksL2gBtr84L8SlAQIDJiABIVgg_l8G-E0tTiXogmgXZZ0nRUMc7NO5-sowWP0lZhX8GZYiWCDU_n2TPO1J-39UbRABHUK_2J-ZbzcDAu2oy_nazsz4Cg"
		}
	}`,
}
