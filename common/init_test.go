package common

import "testing"

func TestResolveSecretsFromEnvRejectsMissingSecrets(t *testing.T) {
	_, _, err := resolveSecretsFromEnv("", "")
	if err == nil {
		t.Fatal("expected missing secrets to fail")
	}
}

func TestResolveSecretsFromEnvRejectsDefaultSessionSecret(t *testing.T) {
	_, _, err := resolveSecretsFromEnv("random_string", "")
	if err == nil {
		t.Fatal("expected default session secret to fail")
	}
}

func TestResolveSecretsFromEnvRejectsDefaultCryptoSecret(t *testing.T) {
	_, _, err := resolveSecretsFromEnv("", "random_string")
	if err == nil {
		t.Fatal("expected default crypto secret to fail")
	}
}

func TestResolveSecretsFromEnvUsesSessionSecretForCryptoFallback(t *testing.T) {
	sessionSecret, cryptoSecret, err := resolveSecretsFromEnv("session-secret", "")
	if err != nil {
		t.Fatalf("expected session secret fallback to succeed, got %v", err)
	}
	if sessionSecret != "session-secret" || cryptoSecret != "session-secret" {
		t.Fatalf("unexpected secrets: session=%q crypto=%q", sessionSecret, cryptoSecret)
	}
}

func TestResolveSecretsFromEnvUsesCryptoSecretForSessionFallback(t *testing.T) {
	sessionSecret, cryptoSecret, err := resolveSecretsFromEnv("", "crypto-secret")
	if err != nil {
		t.Fatalf("expected crypto secret fallback to succeed, got %v", err)
	}
	if sessionSecret != "crypto-secret" || cryptoSecret != "crypto-secret" {
		t.Fatalf("unexpected secrets: session=%q crypto=%q", sessionSecret, cryptoSecret)
	}
}

func TestResolveSecretsFromEnvPreservesDistinctSecrets(t *testing.T) {
	sessionSecret, cryptoSecret, err := resolveSecretsFromEnv("session-secret", "crypto-secret")
	if err != nil {
		t.Fatalf("expected explicit secrets to succeed, got %v", err)
	}
	if sessionSecret != "session-secret" || cryptoSecret != "crypto-secret" {
		t.Fatalf("unexpected secrets: session=%q crypto=%q", sessionSecret, cryptoSecret)
	}
}
