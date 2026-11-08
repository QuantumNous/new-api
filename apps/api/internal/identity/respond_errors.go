package identity

func isAllowedSecurityProofScope(scope string) bool {
	switch scope {
	case SecurityProofScopeChannelKeyRead, SecurityProofScopePasskeyRegister, SecurityProofScopePasskeyDelete,
		SecurityProofScopeAccessTokenGenerate, SecurityProofScopeAccessTokenUpdate, SecurityProofScopeAccessTokenRevoke:
		return true
	default:
		return false
	}
}

const (
	secureVerificationMethod2FA     = "2fa"
	secureVerificationMethodPasskey = "passkey"
)
