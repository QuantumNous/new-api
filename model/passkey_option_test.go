package model

import (
	"testing"
	"time"
)

func TestPasskeyRemovalConfirmationBindsChangeAndExpires(t *testing.T) {
	oldValues := map[string]string{
		"ServerAddress":          "https://example.com",
		passkeyRPIDOption:        "example.com",
		passkeyLegacyRPIDsOption: "old.example.org",
		passkeyOriginsOption:     "https://example.com,https://old.example.org",
	}
	newValues := map[string]string{
		"ServerAddress":          "https://example.com",
		passkeyRPIDOption:        "example.com",
		passkeyLegacyRPIDsOption: "",
		passkeyOriginsOption:     "https://example.com",
	}
	change := &PasskeyDomainChange{
		Removed:  []string{"old.example.org"},
		Affected: 1,
	}
	token := makePasskeyRemovalConfirmation(oldValues, newValues, change, time.Now().Add(time.Minute))
	if !validPasskeyRemovalConfirmation(token, oldValues, newValues, change) {
		t.Fatal("valid confirmation was rejected")
	}
	if validPasskeyRemovalConfirmation(token+"x", oldValues, newValues, change) {
		t.Fatal("tampered confirmation was accepted")
	}
	expired := makePasskeyRemovalConfirmation(oldValues, newValues, change, time.Now().Add(-time.Second))
	if validPasskeyRemovalConfirmation(expired, oldValues, newValues, change) {
		t.Fatal("expired confirmation was accepted")
	}
}
