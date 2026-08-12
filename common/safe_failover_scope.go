package common

// IsScopedGPTTestSafeFailover deliberately accepts exactly one test surface.
// If an operator supplies either selector it must match; supplying both makes
// the scope their intersection. Empty selectors never broaden the scope.
func IsScopedGPTTestSafeFailover(model, group string, tokenID int) bool {
	if !SafeFailoverGPTTestEnabled || model != "gpt-5.5" {
		return false
	}
	if SafeFailoverGPTTestGroup == "" && SafeFailoverGPTTestTokenID <= 0 {
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
