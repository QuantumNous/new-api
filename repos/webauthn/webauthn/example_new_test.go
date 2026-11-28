package webauthn_test

import "github.com/go-webauthn/webauthn/webauthn"

// Example_newRelyingParty demonstrates initializing a relying party.
func Example_newRelyingParty() {
	config := &webauthn.Config{
		RPDisplayName: "Go WebAuthn",
		RPID:          "app.awesome-go-webauthn.com",
		RPOrigins:     []string{"https://app.awesome-go-webauthn.com"},
	}

	handler, err := webauthn.New(config)
	if err != nil {
		panic(err)
	}

	_ = handler
}
