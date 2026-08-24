package model

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSubscriptionLifecycleSourceKeepsProviderBindingBeforeContractLocks(t *testing.T) {
	recurringSource := readModelSourceForLockOrder(t, "subscription_recurring.go")
	require.NotContains(t, recurringSource, "subscriptionProviderLifecycleReservationContractID")
	requireSourceOrderInFunction(t, recurringSource, "applyProviderSubscriptionSnapshot",
		"lockSubscriptionProviderLifecycleBindingAndContractTx",
		"validateSubscriptionProviderLifecycleReservationCurrentBinding",
	)
	requireSourceOrderInFunction(t, recurringSource, "applyProviderSubscriptionTermination",
		"lockSubscriptionProviderLifecycleBindingAndContractTx",
		"validateSubscriptionProviderLifecycleReservationCurrentBinding",
	)
	requireSourceOrderInFunction(t, recurringSource, "lockSubscriptionProviderLifecycleBindingAndContractTx",
		`lockQuery(tx).Where("id = ?", bindingID).First(binding)`,
		"lockSubscriptionProviderLifecycleReservationContractTx",
	)

	reservationSource := readModelSourceForLockOrder(t, "subscription_lifecycle_reservation.go")
	requireSourceOrderInFunction(t, reservationSource, "reserveSubscriptionProviderLifecycle",
		`lockQuery(tx).Where("id = ? AND user_id = ?", bindingID, userID).First(&reserved)`,
		`lockQuery(tx).Where("id = ? AND user_id = ?", reserved.ContractId, userID).First(&contract)`,
	)
	requireSourceOrderInFunction(t, reservationSource, "consumeCurrentSubscriptionProviderLifecycleReservationTx",
		`lockQuery(tx).Where("id = ?", reservation.BindingId).First(&binding)`,
		`lockQuery(tx).Where("id = ?", contractID).First(&contract)`,
	)

	entitlementSource := readModelSourceForLockOrder(t, "subscription_entitlement.go")
	requireSourceOrderInFunction(t, entitlementSource, "rotateCurrentEntitlementTx",
		"lockEntitlementLifecycleReservationBindingsBeforeContractTx",
		`lockQuery(tx).Where("id = ? AND user_id = ?", input.ContractId, input.UserId)`,
	)
	requireSourceOrderInFunction(t, entitlementSource, "lockEntitlementLifecycleReservationBindingsBeforeContractTx",
		`tx.Select("current_provider_binding_id")`,
		`lockQuery(tx).Where("id = ? AND user_id = ?", bindingID, input.UserId).First(&binding)`,
	)
}

func TestSubscriptionLifecycleSourceUsesDBTimestampForBindingWrites(t *testing.T) {
	recurringSource := readModelSourceForLockOrder(t, "subscription_recurring.go")

	require.NotContains(t, recurringSource, `"last_synced_at":             common.GetTimestamp()`)
	require.NotContains(t, recurringSource, `"updated_at":                 common.GetTimestamp()`)
	requireSourceOrderInFunction(t, recurringSource, "applyProviderSubscriptionSnapshot",
		"now, err := getDBTimestampTxStrict(tx)",
		`"last_synced_at":             now`,
	)
	requireSourceOrderInFunction(t, recurringSource, "applyProviderSubscriptionSnapshot",
		"now, err := getDBTimestampTxStrict(tx)",
		`"updated_at":                 now`,
	)
	requireSourceOrderInFunction(t, recurringSource, "applyProviderSubscriptionTermination",
		"dbNow, err := getDBTimestampTxStrict(tx)",
		`"last_synced_at":             dbNow`,
	)
	requireSourceOrderInFunction(t, recurringSource, "applyProviderSubscriptionTermination",
		"dbNow, err := getDBTimestampTxStrict(tx)",
		`"updated_at":                 dbNow`,
	)
}

func readModelSourceForLockOrder(t *testing.T, fileName string) string {
	t.Helper()
	data, err := os.ReadFile(fileName)
	require.NoError(t, err)
	return string(data)
}

func requireSourceOrderInFunction(t *testing.T, source string, functionName string, first string, second string) {
	t.Helper()
	body := sourceFunctionBodyForLockOrder(t, source, functionName)
	firstIndex := strings.Index(body, first)
	secondIndex := strings.Index(body, second)
	require.NotEqual(t, -1, firstIndex, "%s missing %q", functionName, first)
	require.NotEqual(t, -1, secondIndex, "%s missing %q", functionName, second)
	require.Less(t, firstIndex, secondIndex, "%s must keep %q before %q", functionName, first, second)
}

func sourceFunctionBodyForLockOrder(t *testing.T, source string, functionName string) string {
	t.Helper()
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
