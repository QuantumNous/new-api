package common

// IsScopedGPTTestSafeFailover deliberately accepts exactly one test surface.
// If an operator supplies either selector it must match; supplying both makes
// the scope their intersection. Empty selectors never broaden the scope.
func IsScopedGPTTestSafeFailover(model, group string, tokenID int) bool {
	if !SafeFailoverGPTTestEnabled || model != "gpt-5.5" {
		return false
	}
	// Production verification always binds both identities. Accepting one
	// selector would allow an administrator's typo to widen the test surface.
	if SafeFailoverGPTTestGroup == "" || SafeFailoverGPTTestTokenID <= 0 {
		return false
	}
	if SafeFailoverGPTTestGroup != "" && group != SafeFailoverGPTTestGroup {
		return false
	}
	if SafeFailoverGPTTestTokenID > 0 && tokenID != SafeFailoverGPTTestTokenID {
		return false
	}
	return true
}
