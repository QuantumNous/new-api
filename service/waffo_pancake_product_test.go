package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalizeWaffoPancakePlanProductAmount(t *testing.T) {
	testCases := []struct {
		name    string
		amount  string
		want    string
		wantErr string
	}{
		{name: "normalizes a whole amount", amount: "1", want: "1.00"},
		{name: "preserves two decimal places", amount: " 0.15 ", want: "0.15"},
		{name: "accepts maximum amount", amount: "9999", want: "9999.00"},
		{name: "rejects blank amount", amount: " ", wantErr: "required"},
		{name: "rejects non-numeric amount", amount: "one dollar", wantErr: "positive decimal"},
		{name: "rejects zero", amount: "0", wantErr: "positive decimal"},
		{name: "rejects negative amount", amount: "-1", wantErr: "positive decimal"},
		{name: "rejects excess precision", amount: "0.001", wantErr: "at most two"},
		{name: "rejects excessive amount", amount: "10000", wantErr: "cannot exceed"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := normalizeWaffoPancakePlanProductAmount(tc.amount)
			if tc.wantErr != "" {
				require.ErrorContains(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}
}

func TestResolveWaffoPancakeCatalogProductPrice(t *testing.T) {
	testCases := []struct {
		name     string
		prices   []WaffoPancakeCatalogPrice
		currency string
		want     WaffoPancakeCatalogPrice
		wantErr  string
	}{
		{
			name: "resolves the only supported currency",
			prices: []WaffoPancakeCatalogPrice{{
				Currency:  "CNY",
				PriceInfo: WaffoPancakeCatalogPriceInfo{Amount: "9.99", TaxCategory: "saas"},
			}},
			want: WaffoPancakeCatalogPrice{
				Currency:  "CNY",
				PriceInfo: WaffoPancakeCatalogPriceInfo{Amount: "9.99", TaxCategory: "saas"},
			},
		},
		{
			name: "uses explicitly selected supported currency",
			prices: []WaffoPancakeCatalogPrice{
				{Currency: "USD", PriceInfo: WaffoPancakeCatalogPriceInfo{Amount: "9.99", TaxCategory: "saas"}},
				{Currency: "CNY", PriceInfo: WaffoPancakeCatalogPriceInfo{Amount: "9.99", TaxCategory: "digital_goods"}},
			},
			currency: "cny",
			want: WaffoPancakeCatalogPrice{
				Currency:  "CNY",
				PriceInfo: WaffoPancakeCatalogPriceInfo{Amount: "9.99", TaxCategory: "digital_goods"},
			},
		},
		{
			name: "requires an explicit currency for multi-currency products",
			prices: []WaffoPancakeCatalogPrice{
				{Currency: "USD", PriceInfo: WaffoPancakeCatalogPriceInfo{Amount: "9.99", TaxCategory: "saas"}},
				{Currency: "CNY", PriceInfo: WaffoPancakeCatalogPriceInfo{Amount: "9.99", TaxCategory: "saas"}},
			},
			wantErr: "multiple currencies",
		},
		{
			name: "rejects unsupported currency",
			prices: []WaffoPancakeCatalogPrice{{
				Currency:  "CNY",
				PriceInfo: WaffoPancakeCatalogPriceInfo{Amount: "9.99", TaxCategory: "saas"},
			}},
			currency: "USD",
			wantErr:  "not supported",
		},
		{
			name:     "rejects a price without tax category",
			prices:   []WaffoPancakeCatalogPrice{{Currency: "CNY", PriceInfo: WaffoPancakeCatalogPriceInfo{Amount: "9.99"}}},
			currency: "CNY",
			wantErr:  "tax category",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := resolveWaffoPancakeCatalogProductPrice(tc.prices, tc.currency)
			if tc.wantErr != "" {
				require.ErrorContains(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}
}

func TestResolveWaffoPancakeCatalogProduct(t *testing.T) {
	product, err := resolveWaffoPancakeCatalogProduct([]WaffoPancakeCatalogProduct{
		{
			ID:     "PROD_active",
			Status: "active",
			Prices: []WaffoPancakeCatalogPrice{{
				Currency:  "CNY",
				PriceInfo: WaffoPancakeCatalogPriceInfo{Amount: "9.99", TaxCategory: "saas"},
			}},
		},
		{ID: "PROD_inactive", Status: "inactive"},
	}, "PROD_active", "")
	require.NoError(t, err)
	require.Equal(t, "9.99", product.Amount)
	require.Equal(t, "CNY", product.Currency)
	require.Equal(t, "saas", product.TaxCategory)

	_, err = resolveWaffoPancakeCatalogProduct([]WaffoPancakeCatalogProduct{
		{ID: "PROD_inactive", Status: "inactive"},
	}, "PROD_inactive", "CNY")
	require.ErrorContains(t, err, "not active")

	_, err = resolveWaffoPancakeCatalogProduct(nil, "PROD_missing", "CNY")
	require.ErrorContains(t, err, "not found")
}
