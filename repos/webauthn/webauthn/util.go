package webauthn

import "bytes"

func isByteArrayInSlice(needle []byte, haystack ...[]byte) (valid bool) {
	for _, hay := range haystack {
		if bytes.Equal(needle, hay) {
			return true
		}
	}

	return false
}

func isCredentialsAllowedMatchingOwned(allowedCredentialIDs [][]byte, credentials []Credential) (valid bool) {
	var credential Credential

allowed:
	for _, allowedCredentialID := range allowedCredentialIDs {
		for _, credential = range credentials {
			if bytes.Equal(credential.ID, allowedCredentialID) {
				continue allowed
			}
		}

		return false
	}

	return true
}
