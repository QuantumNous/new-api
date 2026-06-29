package setting

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPaymentStripeDoesNotImportEncodingJson(t *testing.T) {
	source, err := os.ReadFile(filepath.Join(".", "payment_stripe.go"))
	require.NoError(t, err)

	require.NotContains(t, string(source), `"encoding/json"`)
}

func TestStripeTopUpPriceIDForAmountUsesJsonWrapperParsedMap(t *testing.T) {
	originalTopUpPriceIds := StripeTopUpPriceIds
	t.Cleanup(func() {
		StripeTopUpPriceIds = originalTopUpPriceIds
	})

	StripeTopUpPriceIds = `{"10":" price_10 ","20":"price_20"}`

	require.Equal(t, "price_10", StripeTopUpPriceIDForAmount(10))
	require.Equal(t, "price_20", StripeTopUpPriceIDForAmount(20))
	require.Empty(t, StripeTopUpPriceIDForAmount(200))
}
