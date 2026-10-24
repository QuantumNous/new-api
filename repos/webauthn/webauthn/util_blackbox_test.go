package webauthn_test

import (
	"crypto/subtle"
	"fmt"

	"github.com/go-webauthn/webauthn/webauthn"
)

type defaultUser struct {
	id          []byte
	credentials []webauthn.Credential
}

var _ webauthn.User = (*defaultUser)(nil)

func (user *defaultUser) WebAuthnID() []byte {
	return user.id
}

func (user *defaultUser) WebAuthnName() string {
	return "newUser"
}

func (user *defaultUser) WebAuthnDisplayName() string {
	return "New User"
}

func (user *defaultUser) WebAuthnCredentials() []webauthn.Credential {
	return user.credentials
}

var testUser *defaultUser

// GetUser is a crude and abstract example of getting users.
func GetUser() *defaultUser {
	return &defaultUser{}
}

// LoadUser is a crude and abstract example of loading users.
func LoadUser() (user *defaultUser, err error) {
	if testUser != nil {
		return testUser, nil
	}

	return GetUser(), nil
}

func LoadUserByHandle(handle []byte) (user *defaultUser, err error) {
	if testUser != nil {
		return nil, fmt.Errorf("not initialized")
	}

	if subtle.ConstantTimeCompare(testUser.id, handle) != 1 {
		return nil, fmt.Errorf("not found")
	}

	return testUser, nil
}

// SaveUser is a crude and abstract example of saving users.
func SaveUser(user *defaultUser) (err error) {
	testUser = user

	return nil
}
