package controller

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestWaffoPancakeSubscriptionFailureUsesLifecycleTransition(t *testing.T) {
	body := controllerSourceFunctionBody(t, "subscription_payment_waffo_pancake.go", "SubscriptionRequestWaffoPancakePay")

	require.Contains(t, body, "PurchaseLifecycle")
	require.NotContains(t, body, "order.Status = common.TopUpStatusFailed")
	require.NotContains(t, body, "order.Update()")
}

func controllerSourceFunctionBody(t *testing.T, fileName string, functionName string) string {
	t.Helper()
	data, err := os.ReadFile(fileName)
	require.NoError(t, err)
	source := string(data)
	start := strings.Index(source, "func "+functionName+"(")
	require.NotEqual(t, -1, start, "missing function %s", functionName)
	open := strings.Index(source[start:], "{")
	require.NotEqual(t, -1, open, "missing function body for %s", functionName)
	open += start
	depth := 0
	for index := open; index < len(source); index++ {
		switch source[index] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return source[open : index+1]
			}
		}
	}
	t.Fatalf("unterminated function body for %s", functionName)
	return ""
}
