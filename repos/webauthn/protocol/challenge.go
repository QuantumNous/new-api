package protocol

import (
	"crypto/rand"
)

// ChallengeLength - Length of bytes to generate for a challenge.
const ChallengeLength = 32

// CreateChallenge creates a new challenge that should be signed and returned by the authenticator. The spec recommends
// using at least 16 bytes with 100 bits of entropy. We use 32 bytes.
func CreateChallenge() (challenge URLEncodedBase64, err error) {
	challenge = make([]byte, ChallengeLength)

	if _, err = rand.Read(challenge); err != nil {
		return nil, err
	}

	return challenge, nil
}
