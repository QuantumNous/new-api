package service

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// hwPricingTestSetup brings the pricing tables and options into the shared test
// database and clears the HisarWeb pricing state, so every test starts from a
// known point.
func hwPricingTestSetup(t *testing.T) {
	t.Helper()
	require.NoError(t, model.DB.AutoMigrate(&model.Option{}, &model.HwPriceSnapshot{}))
	require.NoError(t, model.DB.Exec("DELETE FROM hw_price_snapshots").Error)
	hwDeletePricingOptions(t)
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	saved := map[string]string{}
	for _, key := range []string{HwOptionPriceListURL, HwOptionFxURL, HwOptionTryPerUsd, HwOptionTryPerUsdDate} {
		saved[key] = hwOptionValue(key)
		delete(common.OptionMap, key)
	}
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		for key, value := range saved {
			common.OptionMap[key] = value
		}
		common.OptionMapRWMutex.Unlock()
		model.DB.Exec("DELETE FROM hw_price_snapshots")
		hwDeletePricingOptions(t)
	})
}

// hwDeletePricingOptions removes the persisted pricing options of this suite.
func hwDeletePricingOptions(t *testing.T) {
	t.Helper()
	require.NoError(t, model.DB.Where("key IN ?", []string{
		HwOptionPriceListURL, HwOptionFxURL, HwOptionTryPerUsd, HwOptionTryPerUsdDate,
	}).Delete(&model.Option{}).Error)
}

// hwSetOption puts one option into the option map for the duration of the test.
func hwSetOption(t *testing.T, key string, value string) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	common.OptionMap[key] = value
	common.OptionMapRWMutex.Unlock()
}

// hwTestPriceListBody is a miniature of the open price list with the real
// notation (prices per token in scientific notation). It lists every sold model,
// because the extraction refuses a list that lost one, plus a retired name and a
// model outside the catalog that must not reach the snapshot.
const hwTestPriceListBody = `{
  "claude-opus-5-5": {"input_cost_per_token": 4e-06, "output_cost_per_token": 2e-05, "mode": "chat"},
  "claude-sonnet-5-5": {"input_cost_per_token": 2e-06, "output_cost_per_token": 1e-05, "mode": "chat"},
  "claude-haiku-5-5": {"input_cost_per_token": 1e-07, "output_cost_per_token": 5e-07, "mode": "chat"},
  "claude-fable-5-1": {"input_cost_per_token": 1e-05, "output_cost_per_token": 5e-05, "mode": "chat"},
  "gemini-3.8-flash": {"input_cost_per_token": 7.5e-07, "output_cost_per_token": 3.75e-06, "mode": "chat"},
  "gpt-6-luna": {"input_cost_per_token": 1e-07, "output_cost_per_token": 5e-07, "mode": "chat"},
  "gpt-6.1-sol": {"input_cost_per_token": 2e-06, "output_cost_per_token": 1e-05, "mode": "chat"},
  "gpt-6-astra": {"input_cost_per_token": 1e-05, "output_cost_per_token": 5e-05, "mode": "chat"},
  "gemini-3.8-flash-cyber": {"input_cost_per_token": 1.5e-06, "output_cost_per_token": 7.5e-06, "mode": "chat"},
  "grok-4": {"input_cost_per_token": 2e-06, "output_cost_per_token": 6e-06, "mode": "chat"},
  "grok-4-fast": {"input_cost_per_token": 2e-06, "output_cost_per_token": 6e-06, "mode": "chat"},
  "claude-haiku-4-5": {"input_cost_per_token": 1e-06, "output_cost_per_token": 5e-06, "mode": "chat"},
  "some-other-model": {"input_cost_per_token": 3e-06, "output_cost_per_token": 1.5e-05, "mode": "chat"}
}`

// hwTestFxBody mirrors the TCMB daily bulletin: Date is MM/DD/YYYY, Tarih is
// DD.MM.YYYY, the USD forex-selling rate is the one we take.
const hwTestFxBody = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="19.10.2026" Date="10/19/2026" Bulten_No="2026/197">
	<Currency Kod="AUD" CurrencyCode="AUD">
		<Isim>AVUSTRALYA DOLARI</Isim>
		<ForexSelling>34.6716</ForexSelling>
	</Currency>
	<Currency Kod="USD" CurrencyCode="USD">
		<Isim>ABD DOLARI</Isim>
		<CurrencyName>US DOLLAR</CurrencyName>
		<ForexBuying>49.4632</ForexBuying>
		<ForexSelling>49.5523</ForexSelling>
	</Currency>
</Tarih_Date>
`

func hwStartTestServer(t *testing.T, handler http.HandlerFunc) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	return server
}

// TestHwPriceSnapshotFetchStoresSourceTimeAndRateDate pins the snapshot
// content of one successful fetch: both source URLs, the fetch time, the rate
// validity date, the rate itself, and the sold models' prices in micro-dollars.
func TestHwPriceSnapshotFetchStoresSourceTimeAndRateDate(t *testing.T) {
	hwPricingTestSetup(t)
	priceServer := hwStartTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(hwTestPriceListBody))
	})
	fxServer := hwStartTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/xml")
		_, _ = w.Write([]byte(hwTestFxBody))
	})
	fetchedAt := time.Date(2026, 10, 20, 6, 30, 0, 0, time.UTC)

	snapshot, err := HwFetchPriceSnapshot(context.Background(), priceServer.Client(), priceServer.URL, fxServer.URL, fetchedAt)
	require.NoError(t, err)

	assert.Equal(t, priceServer.URL, snapshot.PriceSourceUrl)
	assert.Equal(t, fxServer.URL, snapshot.FxSourceUrl)
	assert.Equal(t, fetchedAt.Unix(), snapshot.FetchedAt)
	assert.Equal(t, "2026-10-19", snapshot.FxDate)
	assert.Equal(t, "49.5523", snapshot.TryPerUsd)
	assert.Equal(t, 13, snapshot.ListedCount)
	prices, err := snapshot.HwSnapshotModelPrices()
	require.NoError(t, err)
	assert.Equal(t, model.HwModelPrice{InputMicroUsd: 2_000_000, OutputMicroUsd: 10_000_000}, prices["claude-sonnet-5-5"])
	assert.NotContains(t, prices, "claude-haiku-4-5", "a retired model is not sold, whatever the list says")
	assert.Equal(t, model.HwModelPrice{InputMicroUsd: 100_000, OutputMicroUsd: 500_000}, prices["claude-haiku-5-5"])
	assert.NotContains(t, prices, "some-other-model", "only sold models belong in the snapshot")
}

// TestHwPriceRefreshFailedFetchKeepsOldSnapshotAndMarksStale pins the failure
// path: a failed refresh leaves the previous snapshot in place, with its dates,
// and marks it stale instead of replacing anything.
func TestHwPriceRefreshFailedFetchKeepsOldSnapshotAndMarksStale(t *testing.T) {
	hwPricingTestSetup(t)
	priceServer := hwStartTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(hwTestPriceListBody))
	})
	fxServer := hwStartTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(hwTestFxBody))
	})
	hwSetOption(t, HwOptionPriceListURL, priceServer.URL)
	hwSetOption(t, HwOptionFxURL, fxServer.URL)

	firstFetch := time.Date(2026, 10, 19, 6, 0, 0, 0, time.UTC)
	require.NoError(t, HwRefreshPriceSnapshot(context.Background(), priceServer.Client(), firstFetch))
	original, err := model.HwLatestPriceSnapshot()
	require.NoError(t, err)
	require.Equal(t, int64(0), original.StaleAt)

	// The price source now fails; the rate source keeps working, which proves
	// the cycle fails as a whole and keeps the old data.
	failingServer := hwStartTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	})
	hwSetOption(t, HwOptionPriceListURL, failingServer.URL)

	err = HwRefreshPriceSnapshot(context.Background(), failingServer.Client(), time.Date(2026, 10, 20, 6, 0, 0, 0, time.UTC))
	require.Error(t, err)

	after, err := model.HwLatestPriceSnapshot()
	require.NoError(t, err)
	assert.Equal(t, original.Id, after.Id, "the old snapshot must stay the current one")
	assert.Equal(t, original.FetchedAt, after.FetchedAt)
	assert.Equal(t, original.FxDate, after.FxDate)
	assert.Equal(t, original.TryPerUsd, after.TryPerUsd)
	assert.Greater(t, after.StaleAt, int64(0), "the old snapshot must be marked stale")
}

// TestHwPriceRefreshRejectsInvalidRate refuses a zero, negative, or non-numeric
// rate: no snapshot is written and no rate is published.
func TestHwPriceRefreshRejectsInvalidRate(t *testing.T) {
	hwPricingTestSetup(t)
	priceServer := hwStartTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(hwTestPriceListBody))
	})
	hwSetOption(t, HwOptionPriceListURL, priceServer.URL)

	for name, rate := range map[string]string{
		"zero":         "0",
		"negative":     "-3.5",
		"not-a-number": "abc",
		"empty":        "",
	} {
		t.Run(name, func(t *testing.T) {
			fxBody := `<?xml version="1.0"?><Tarih_Date Tarih="19.10.2026" Date="10/19/2026">` +
				`<Currency Kod="USD" CurrencyCode="USD"><ForexSelling>` + rate + `</ForexSelling></Currency></Tarih_Date>`
			fxServer := hwStartTestServer(t, func(w http.ResponseWriter, r *http.Request) {
				_, _ = w.Write([]byte(fxBody))
			})
			_, err := HwFetchPriceSnapshot(context.Background(), fxServer.Client(), priceServer.URL, fxServer.URL, time.Now())
			require.Error(t, err)
		})
	}
	var count int64
	require.NoError(t, model.DB.Model(&model.HwPriceSnapshot{}).Count(&count).Error)
	assert.Equal(t, int64(0), count, "no snapshot may be written from an invalid rate")
	assert.Equal(t, "", hwOptionValue(HwOptionTryPerUsd), "no rate may be published from an invalid rate")
}

// TestHwTryPriceExactKurus pins the TRY conversion: dollar value x rate x 1.2
// (20 % KDV included), rounded to whole kuruş, with decimal arithmetic only.
// The expectations were computed independently with exact decimal math.
func TestHwTryPriceExactKurus(t *testing.T) {
	cases := []struct {
		usd     string
		rate    string
		wantTry string
	}{
		{"1", "10", "12"},
		{"0.0375", "1", "0.05"}, // 0.045 rounds half away from zero to 0.05
		{"0.0125", "1", "0.02"}, // 0.015 rounds up
		{"0.123456", "49.5523", "7.34"},
		{"12345.6789", "49.5523", "734108.14"},
		{"0.0000001", "49.5523", "0"}, // below one kuruş rounds to zero
		{"1000.005", "34.5678", "41481.57"},
		{"7", "49.5523", "416.24"},
	}
	for _, tc := range cases {
		got, err := HwTryPrice(decimal.RequireFromString(tc.usd), decimal.RequireFromString(tc.rate))
		require.NoError(t, err, "usd=%s rate=%s", tc.usd, tc.rate)
		assert.Equal(t, tc.wantTry, got.String(), "usd=%s rate=%s", tc.usd, tc.rate)
	}

	_, err := HwTryPrice(decimal.NewFromInt(1), decimal.Zero)
	assert.ErrorIs(t, err, ErrHwInvalidRate)
	_, err = HwTryPrice(decimal.NewFromInt(-1), decimal.NewFromInt(10))
	assert.ErrorIs(t, err, ErrHwNegativeUsdValue)
}

// TestHwApplyTryRateOptionOnlyNewerValid pins the option update rule: a valid,
// strictly newer rate replaces the published one; an equal or older date
// changes nothing, and an invalid rate is refused.
func TestHwApplyTryRateOptionOnlyNewerValid(t *testing.T) {
	hwPricingTestSetup(t)

	require.NoError(t, hwApplyTryRateOption(decimal.NewFromInt(40), "2026-10-18"))
	assert.Equal(t, "40", hwOptionValue(HwOptionTryPerUsd))
	assert.Equal(t, "2026-10-18", hwOptionValue(HwOptionTryPerUsdDate))

	// Older date: the published rate stays.
	require.NoError(t, hwApplyTryRateOption(decimal.NewFromInt(41), "2026-10-17"))
	assert.Equal(t, "40", hwOptionValue(HwOptionTryPerUsd))
	assert.Equal(t, "2026-10-18", hwOptionValue(HwOptionTryPerUsdDate))

	// Same date: no rewrite, so a repeated fetch of the same bulletin is a no-op.
	require.NoError(t, hwApplyTryRateOption(decimal.NewFromInt(42), "2026-10-18"))
	assert.Equal(t, "40", hwOptionValue(HwOptionTryPerUsd))

	// Newer date: both options move.
	require.NoError(t, hwApplyTryRateOption(decimal.NewFromFloat(43.25), "2026-10-19"))
	assert.Equal(t, "43.25", hwOptionValue(HwOptionTryPerUsd))
	assert.Equal(t, "2026-10-19", hwOptionValue(HwOptionTryPerUsdDate))

	// An invalid rate is refused and changes nothing.
	require.ErrorIs(t, hwApplyTryRateOption(decimal.Zero, "2026-10-20"), ErrHwInvalidRate)
	assert.Equal(t, "43.25", hwOptionValue(HwOptionTryPerUsd))

	// The published pair is also persisted as options.
	for key, want := range map[string]string{HwOptionTryPerUsd: "43.25", HwOptionTryPerUsdDate: "2026-10-19"} {
		var stored model.Option
		require.NoError(t, model.DB.Where("key = ?", key).First(&stored).Error)
		assert.Equal(t, want, stored.Value)
	}
}

const hwTestFxBodyWithEur = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="19.10.2026" Date="10/19/2026" Bulten_No="2026/197">
	<Currency Kod="EUR" CurrencyCode="EUR"><ForexSelling>57.5</ForexSelling></Currency>
	<Currency Kod="USD" CurrencyCode="USD"><ForexSelling>49.5523</ForexSelling></Currency>
</Tarih_Date>
`

// The EUR per USD rate is the cross rate of the two lira rates in the same
// bulletin, rounded to six decimals; a missing or broken EUR line is an error
// of its own and never touches the lira.
func TestHwParseTcmbEurPerUsd(t *testing.T) {
	usdTry := decimal.RequireFromString("49.5523")
	rate, err := hwParseTcmbEurPerUsd([]byte(hwTestFxBodyWithEur), usdTry)
	require.NoError(t, err)
	assert.Equal(t, "0.861779", rate.String())

	_, err = hwParseTcmbEurPerUsd([]byte(hwTestFxBody), usdTry)
	assert.ErrorIs(t, err, errHwEurRateMissing, "no EUR line")
	_, err = hwParseTcmbEurPerUsd([]byte("not xml"), usdTry)
	assert.ErrorIs(t, err, errHwEurRateMissing)
	for _, selling := range []string{"abc", "0", "-3"} {
		body := strings.Replace(hwTestFxBodyWithEur, "57.5", selling, 1)
		_, err = hwParseTcmbEurPerUsd([]byte(body), usdTry)
		assert.ErrorIs(t, err, errHwEurRateInvalid, selling)
	}
	_, err = hwParseTcmbEurPerUsd([]byte(hwTestFxBodyWithEur), decimal.Zero)
	assert.ErrorIs(t, err, errHwEurRateInvalid)
}

func hwEurTestCleanOptions(t *testing.T) {
	t.Helper()
	require.NoError(t, model.DB.AutoMigrate(&model.Option{}))
	keys := []string{model.HwEurPerUsdOption, model.HwEurPerUsdDateOption, model.HwEurPresetBaseOption}
	clean := func() {
		model.DB.Where("key IN ?", keys).Delete(&model.Option{})
		common.OptionMapRWMutex.Lock()
		for _, key := range keys {
			delete(common.OptionMap, key)
		}
		common.OptionMapRWMutex.Unlock()
	}
	clean()
	t.Cleanup(clean)
}

// Same guard as the lira rate (valid, strictly newer), and the preset base rate
// follows only a move of more than 3 percent so the presets do not jump daily.
func TestHwApplyEurRateOptionDateRuleAndPresetBase(t *testing.T) {
	hwPricingTestSetup(t)
	hwEurTestCleanOptions(t)

	require.NoError(t, hwApplyEurRateOption(decimal.RequireFromString("0.86"), "2026-10-18"))
	assert.Equal(t, "0.86", hwOptionValue(model.HwEurPerUsdOption))
	assert.Equal(t, "2026-10-18", hwOptionValue(model.HwEurPerUsdDateOption))
	assert.Equal(t, "0.86", hwOptionValue(model.HwEurPresetBaseOption), "the first rate is the base")

	// Older and equal dates change nothing.
	require.NoError(t, hwApplyEurRateOption(decimal.RequireFromString("0.90"), "2026-10-17"))
	require.NoError(t, hwApplyEurRateOption(decimal.RequireFromString("0.90"), "2026-10-18"))
	assert.Equal(t, "0.86", hwOptionValue(model.HwEurPerUsdOption))

	// A small move updates the rate but keeps the base.
	require.NoError(t, hwApplyEurRateOption(decimal.RequireFromString("0.87"), "2026-10-19"))
	assert.Equal(t, "0.87", hwOptionValue(model.HwEurPerUsdOption))
	assert.Equal(t, "0.86", hwOptionValue(model.HwEurPresetBaseOption))

	// More than 3 percent away from the base moves the base too.
	require.NoError(t, hwApplyEurRateOption(decimal.RequireFromString("0.90"), "2026-10-20"))
	assert.Equal(t, "0.9", hwOptionValue(model.HwEurPresetBaseOption))
	assert.Equal(t, "2026-10-20", hwOptionValue(model.HwEurPerUsdDateOption))

	require.ErrorIs(t, hwApplyEurRateOption(decimal.Zero, "2026-10-21"), ErrHwInvalidRate)
	assert.Equal(t, "0.9", hwOptionValue(model.HwEurPerUsdOption))
}

func hwCurrencyTestOptions(t *testing.T, values map[string]string) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	saved := map[string]string{}
	present := map[string]bool{}
	for key, value := range values {
		saved[key], present[key] = common.OptionMap[key]
		common.OptionMap[key] = value
	}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		defer common.OptionMapRWMutex.Unlock()
		for key := range values {
			if present[key] {
				common.OptionMap[key] = saved[key]
			} else {
				delete(common.OptionMap, key)
			}
		}
	})
}

func TestHwCurrencyRateAndRange(t *testing.T) {
	now := time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)
	hwCurrencyTestOptions(t, map[string]string{
		model.HwTryPerUsdOption:     "40",
		model.HwEurPerUsdOption:     "0.8",
		model.HwEurPerUsdDateOption: "2026-10-17", // seven days old: still fresh
		model.HwMinTopUpTryOption:   "",
		model.HwMaxTopUpTryOption:   "",
	})

	for currency, want := range map[string]string{"USD": "1", "TRY": "40", "EUR": "0.8"} {
		rate, err := hwCurrencyRate(currency, now)
		require.NoError(t, err, currency)
		assert.Equal(t, want, rate.String(), currency)
	}
	_, err := hwCurrencyRate("GBP", now)
	assert.ErrorIs(t, err, ErrHwCurrencyUnsupported)
	_, err = hwCurrencyRate("EUR", now.Add(25*time.Hour))
	assert.ErrorIs(t, err, ErrHwTopUpRateMissing, "older than seven days")

	// 100..20000 lira, converted through the dollar: the minimum rounds up, the
	// maximum down.
	for currency, want := range map[string][2]int{"TRY": {100, 20000}, "EUR": {2, 400}, "USD": {3, 500}} {
		minAmount, maxAmount, err := HwTopUpRange(currency, now)
		require.NoError(t, err, currency)
		assert.Equal(t, want, [2]int{minAmount, maxAmount}, currency)
	}
	_, _, err = HwTopUpRange("EUR", now.Add(25*time.Hour))
	assert.ErrorIs(t, err, ErrHwTopUpRateMissing)

	hwCurrencyTestOptions(t, map[string]string{model.HwEurPerUsdOption: ""})
	_, err = hwCurrencyRate("EUR", now)
	assert.ErrorIs(t, err, ErrHwTopUpRateMissing, "no rate")
}

// The first-purchase discount cap is 1000 lira in every currency: the other
// currencies convert it through the dollar, so a customer paying in euro gets the
// same value, and a missing lira rate stops the conversion instead of guessing.
func TestHwDiscountCapKeepsTheLiraValueInEveryCurrency(t *testing.T) {
	now := time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)
	hwCurrencyTestOptions(t, map[string]string{
		model.HwTryPerUsdOption:     "40",
		model.HwEurPerUsdOption:     "0.8",
		model.HwEurPerUsdDateOption: "2026-10-24",
	})

	for currency, want := range map[string]string{"TRY": "1000", "USD": "25", "EUR": "20"} {
		rate, err := hwCurrencyRate(currency, now)
		require.NoError(t, err, currency)
		capAmount, err := hwDiscountCap(currency, rate, now)
		require.NoError(t, err, currency)
		assert.Equal(t, want, capAmount.String(), currency)
	}

	hwCurrencyTestOptions(t, map[string]string{model.HwTryPerUsdOption: ""})
	_, err := hwDiscountCap("EUR", decimal.RequireFromString("0.8"), now)
	assert.ErrorIs(t, err, ErrHwTopUpRateMissing, "no lira rate")
}

func TestHwNormalizeCurrencyDefaultsToLira(t *testing.T) {
	for input, want := range map[string]string{"": "TRY", "  ": "TRY", "eur": "EUR", " usd ": "USD", "TRY": "TRY", "gbp": "GBP"} {
		assert.Equal(t, want, HwNormalizeCurrency(input), "%q", input)
	}
	assert.Equal(t, "EUR", HwRequestCurrency(HwTopUpRequest{Currency: "eur"}))
	assert.Equal(t, "TRY", HwRequestCurrency(HwTopUpRequest{}))
}

func TestHwTidyFloorAndPresets(t *testing.T) {
	for in, want := range map[string]int{
		"7.9": 7, "19.99": 19, "20": 20, "22": 20, "97": 95, "99.9": 95, "100": 100,
		"234": 230, "999": 990, "1234": 1200, "9999": 9950, "12345": 12000,
	} {
		assert.Equal(t, want, hwTidyFloor(decimal.RequireFromString(in)), in)
	}
	one := decimal.NewFromInt(1)
	assert.Equal(t, []int{250, 500, 1000, 2000, 5000}, hwPresets("TRY", one, 100, 20000))
	assert.Equal(t, []int{10, 25, 50, 100, 250}, hwPresets("USD", one, 3, 500))
	// 10, 25, 50, 100 and 250 dollar at 0.86: 8, 21 (20), 43 (40), 86 (85), 215 (210).
	assert.Equal(t, []int{8, 20, 40, 85, 210}, hwPresets("EUR", decimal.RequireFromString("0.86"), 2, 400))
	// Presets outside the bounds drop out.
	assert.Equal(t, []int{40, 85}, hwPresets("EUR", decimal.RequireFromString("0.86"), 30, 100))
}

func TestHwCurrenciesStatus(t *testing.T) {
	hwStripeTestSetup(t)
	now := time.Now()
	hwStripeTestSetEurRate(t, "0.8", now)
	hwCurrencyTestOptions(t, map[string]string{model.HwEurPresetBaseOption: "0.86"})

	status := HwCurrencies(now)
	assert.Equal(t, []string{"TRY", "EUR", "USD"}, status.Currencies)
	assert.Equal(t, map[string]string{"TRY": "40", "EUR": "0.8", "USD": "1"}, status.Rates)
	assert.Equal(t, HwCurrencyBounds{Min: 100, Max: 20000, Presets: []int{250, 500, 1000, 2000, 5000}}, status.TopUp["TRY"])
	assert.Equal(t, HwCurrencyBounds{Min: 2, Max: 400, Presets: []int{8, 20, 40, 85, 210}}, status.TopUp["EUR"], "presets follow the stored base rate")
	assert.Equal(t, HwCurrencyBounds{Min: 3, Max: 500, Presets: []int{10, 25, 50, 100, 250}}, status.TopUp["USD"])

	// A stale EUR rate drops only EUR.
	stale := HwCurrencies(now.Add(8 * 24 * time.Hour))
	assert.Equal(t, []string{"TRY", "USD"}, stale.Currencies)
	assert.NotContains(t, stale.Rates, "EUR")

	// Without Stripe only the lira is sold.
	t.Setenv(HwStripeSecretKeyEnv, "")
	assert.Equal(t, []string{"TRY"}, HwCurrencies(now).Currencies)
}

// A rate that is dated after today (or cannot be read) would stay "newer" than
// every real bulletin, so publishing refuses it and leaves the options alone.
func TestHwApplyRateOptionsRefuseFutureAndUnreadableDates(t *testing.T) {
	hwPricingTestSetup(t)
	hwEurTestCleanOptions(t)
	require.NoError(t, hwApplyTryRateOption(decimal.NewFromInt(40), "2026-10-18"))
	require.NoError(t, hwApplyEurRateOption(decimal.RequireFromString("0.86"), "2026-10-18"))

	tomorrow := time.Now().UTC().Add(24 * time.Hour).Format("2006-01-02")
	for _, date := range []string{tomorrow, "2099-01-01", "18.10.2026", "", "garbage"} {
		require.ErrorIs(t, hwApplyTryRateOption(decimal.NewFromInt(99), date), ErrHwInvalidRate, "TRY %q", date)
		require.ErrorIs(t, hwApplyEurRateOption(decimal.RequireFromString("0.5"), date), ErrHwInvalidRate, "EUR %q", date)
	}
	assert.Equal(t, "40", hwOptionValue(HwOptionTryPerUsd))
	assert.Equal(t, "2026-10-18", hwOptionValue(HwOptionTryPerUsdDate))
	assert.Equal(t, "0.86", hwOptionValue(model.HwEurPerUsdOption))
	assert.Equal(t, "2026-10-18", hwOptionValue(model.HwEurPerUsdDateOption))

	today := time.Now().UTC().Format("2006-01-02")
	require.NoError(t, hwApplyTryRateOption(decimal.NewFromInt(41), today), "today is allowed")
	assert.Equal(t, "41", hwOptionValue(HwOptionTryPerUsd))
}

func TestHwRateDateUsable(t *testing.T) {
	now := time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)
	for _, tc := range []struct {
		date     string
		required bool
		want     bool
	}{
		{"2026-10-24", true, true},
		{"2026-10-17", true, true},   // seven days: still fresh
		{"2026-10-16", true, false},  // eight days: stale
		{"2026-10-25", true, false},  // tomorrow
		{"2099-01-01", false, false}, // far future, even when a date is optional
		{"24.10.2026", false, false},
		{"", true, false},
		{"", false, true}, // a hand-set rate has no date
	} {
		assert.Equal(t, tc.want, hwRateDateUsable(tc.date, now, tc.required), "%q required=%v", tc.date, tc.required)
	}
}

// The lira follows the same age and future rules as the euro: a stale or future
// dated rate reads as "rate missing" and TRY is not sold. A rate without a date
// (set by hand) stays usable.
func TestHwTryRateNeedsAFreshDate(t *testing.T) {
	now := time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)
	for _, tc := range []struct {
		name, date string
		ok         bool
	}{
		{"fresh", "2026-10-23", true},
		{"seven days old", "2026-10-17", true},
		{"stale", "2026-10-16", false},
		{"in the future", "2026-10-25", false},
		{"unreadable", "soon", false},
		{"no date at all", "", true},
	} {
		hwCurrencyTestOptions(t, map[string]string{
			model.HwTryPerUsdOption: "40",
			HwOptionTryPerUsdDate:   tc.date,
		})
		rate, err := hwCurrencyRate("TRY", now)
		if tc.ok {
			require.NoError(t, err, tc.name)
			assert.Equal(t, "40", rate.String(), tc.name)
		} else {
			assert.ErrorIs(t, err, ErrHwTopUpRateMissing, tc.name)
		}
		// The other limits are converted through the lira, so they follow it.
		_, _, rangeErr := HwTopUpRange("USD", now)
		assert.Equal(t, tc.ok, rangeErr == nil, tc.name)
	}
}

// A stale lira rate takes TRY out of the list the shop sells in. The euro and
// dollar limits and the discount cap are worked out through the lira, so they
// wait for a fresh lira rate too (both come from the same bulletin).
func TestHwCurrenciesDropsTryWithAStaleRate(t *testing.T) {
	hwStripeTestSetup(t)
	now := time.Now()
	hwStripeTestSetEurRate(t, "0.8", now)
	hwCurrencyTestOptions(t, map[string]string{
		model.HwTryPerUsdOption: "40",
		HwOptionTryPerUsdDate:   now.UTC().Add(-8 * 24 * time.Hour).Format("2006-01-02"),
	})
	status := HwCurrencies(now)
	assert.NotContains(t, status.Currencies, "TRY")
	assert.NotContains(t, status.Rates, "TRY")
	assert.Empty(t, status.Currencies)
}

// TestHwApplySnapshotModelRatiosIsAtomic keeps the input ratio and the output
// ratio of the catalog in step: both are published by one write, so a failing
// write leaves the old input ratio next to the old output ratio instead of a mix
// of today's input price and yesterday's output ratio.
func TestHwApplySnapshotModelRatiosIsAtomic(t *testing.T) {
	setupHwSeedDefaultsTest(t)
	require.NoError(t, model.UpdateOption("ModelRatio", `{"claude-opus-5-5":1}`))
	require.NoError(t, model.UpdateOption("CompletionRatio", `{"claude-opus-5-5":5}`))

	// The snapshot prices Opus at three times the old input price and at another
	// output ratio, so both ratios change and both writes are needed.
	snapshot := &model.HwPriceSnapshot{
		Models: `{"claude-opus-5-5":{"in":12000000,"out":24000000}}`,
	}

	// A database that refuses the write carrying the new output ratio, after the
	// new input ratio was already accepted: the cycle must not leave the new
	// input ratio next to the old output ratio.
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register("hw_atomic_ratios", func(tx *gorm.DB) {
		values, ok := tx.Statement.Dest.(map[string]any)
		if !ok {
			return
		}
		if text, ok := values["value"].(string); ok && strings.Contains(text, `"claude-opus-5-5":2`) {
			tx.AddError(errors.New("injected ratio write failure"))
		}
	}))
	err := HwApplySnapshotModelRatios(snapshot)
	require.NoError(t, model.DB.Callback().Update().Remove("hw_atomic_ratios"))
	require.Error(t, err, "the output ratio write fails")

	inputRatio, ok, _ := ratio_setting.GetModelRatio("claude-opus-5-5")
	require.True(t, ok)
	assert.Equal(t, 1.0, inputRatio, "the input ratio stays as it was")
	assert.Equal(t, 5.0, ratio_setting.GetCompletionRatio("claude-opus-5-5"), "the output ratio stays as it was")
	assert.JSONEq(t, `{"claude-opus-5-5":1}`, hwStoredRatioOption(t, "ModelRatio"))
	assert.JSONEq(t, `{"claude-opus-5-5":5}`, hwStoredRatioOption(t, "CompletionRatio"))

	// Without an injected fault both ratios move together.
	require.NoError(t, HwApplySnapshotModelRatios(snapshot))
	inputRatio, ok, _ = ratio_setting.GetModelRatio("claude-opus-5-5")
	require.True(t, ok)
	assert.Equal(t, 3.0, inputRatio)
	assert.Equal(t, 2.0, ratio_setting.GetCompletionRatio("claude-opus-5-5"))
}

// hwStoredRatioOption reads one ratio option back from the options table.
func hwStoredRatioOption(t *testing.T, key string) string {
	t.Helper()
	var stored model.Option
	require.NoError(t, model.DB.Where("key = ?", key).First(&stored).Error)
	return stored.Value
}

func hwComparePriceSnapshot(t *testing.T, tryPerUsd string, prices map[string]model.HwModelPrice) *model.HwPriceSnapshot {
	t.Helper()
	encoded, err := common.Marshal(prices)
	require.NoError(t, err)
	return &model.HwPriceSnapshot{TryPerUsd: tryPerUsd, Models: string(encoded)}
}

func TestHwComparePriceIsExactAndRejectsUnusableInput(t *testing.T) {
	prices := map[string]model.HwModelPrice{"claude-sonnet-5-5": {InputMicroUsd: 2_000_000, OutputMicroUsd: 10_000_000}}
	snapshot := hwComparePriceSnapshot(t, "40", prices)

	got, err := HwComparePrice(snapshot, HwComparePriceInput{Model: "claude-sonnet-5-5", InputTokens: 1_000_000, OutputTokens: 1_000_000})
	require.NoError(t, err)
	// 1M input x $2 + 1M output x $10 = $12, x 40 TRY x 1.2 KDV = 576 TRY.
	assert.True(t, got.OfficialUsd.Equal(decimal.NewFromInt(12)), got.OfficialUsd.String())
	assert.True(t, got.OfficialTry.Equal(decimal.NewFromInt(576)), got.OfficialTry.String())
	assert.True(t, got.TryPerUsd.Equal(decimal.NewFromInt(40)))
	assert.True(t, got.FirstPurchaseTry.IsPositive())
	assert.True(t, got.FirstPurchaseTry.LessThanOrEqual(got.RepeatPurchaseTry), "the first purchase is never dearer than a repeat")
	assert.True(t, got.RepeatPurchaseTry.LessThan(got.OfficialTry), "our price is below the official price")
	assert.True(t, got.SavingsFirstTry.Equal(got.OfficialTry.Sub(got.FirstPurchaseTry)))
	assert.True(t, got.SavingsRepeatTry.Equal(got.OfficialTry.Sub(got.RepeatPurchaseTry)))

	valid := HwComparePriceInput{Model: "claude-sonnet-5-5", InputTokens: 10, OutputTokens: 10}
	for name, tc := range map[string]struct {
		snapshot *model.HwPriceSnapshot
		input    HwComparePriceInput
		want     error
	}{
		"model not sold":   {snapshot, HwComparePriceInput{Model: "gpt-nothing", InputTokens: 1}, ErrHwModelNotSold},
		"no snapshot":      {nil, valid, ErrHwNoPriceData},
		"model missing":    {hwComparePriceSnapshot(t, "40", map[string]model.HwModelPrice{}), valid, ErrHwNoPriceData},
		"zero price":       {hwComparePriceSnapshot(t, "40", map[string]model.HwModelPrice{"claude-sonnet-5-5": {InputMicroUsd: 0, OutputMicroUsd: 10}}), valid, ErrHwNoPriceData},
		"invalid rate":     {hwComparePriceSnapshot(t, "0", prices), valid, ErrHwInvalidRate},
		"unparseable rate": {hwComparePriceSnapshot(t, "abc", prices), valid, ErrHwInvalidRate},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := HwComparePrice(tc.snapshot, tc.input)
			assert.ErrorIs(t, err, tc.want)
		})
	}

	for name, input := range map[string]HwComparePriceInput{
		"negative input":  {Model: "claude-sonnet-5-5", InputTokens: -1},
		"negative output": {Model: "claude-sonnet-5-5", OutputTokens: -1},
		"input too big":   {Model: "claude-sonnet-5-5", InputTokens: HwMaxTokensPerMonth + 1},
		"output too big":  {Model: "claude-sonnet-5-5", OutputTokens: HwMaxTokensPerMonth + 1},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := HwComparePrice(snapshot, input)
			require.Error(t, err)
			assert.NotErrorIs(t, err, ErrHwModelNotSold)
		})
	}

	_, err = HwComparePrice(&model.HwPriceSnapshot{TryPerUsd: "40", Models: "not json"}, valid)
	require.Error(t, err, "an unreadable price list is an error, not an empty one")
}

// Log lines carry the class and never the error text, because a transport error
// can quote the URL with its query string.
func TestHwPricingErrorClassNeverCarriesTheErrorText(t *testing.T) {
	assert.Equal(t, "nil", hwPricingErrorClass(nil))
	assert.Equal(t, "timeout", hwPricingErrorClass(context.DeadlineExceeded))
	assert.Equal(t, "timeout", hwPricingErrorClass(context.Canceled))
	assert.Equal(t, "timeout", hwPricingErrorClass(errors.Join(errors.New("get"), context.DeadlineExceeded)))
	assert.Equal(t, "fetch", hwPricingErrorClass(errors.New(`Get "https://rates.example/?key=secret": EOF`)))
}

// The open price list publishes per-token prices as decimal text, often in
// scientific notation; the conversion to micro-dollars per million tokens must
// be exact and must refuse anything that is not a clean, non-negative number.
func TestHwMicroUsdPerMillionReadsPublishedPricesExactly(t *testing.T) {
	for raw, want := range map[string]int64{
		"4e-06":     4_000_000,
		"0.000002":  2_000_000,
		"1e-07":     100_000,
		" 5e-06 ":   5_000_000,
		"0":         0,
		"2.5e-07":   250_000,
		"0.0000015": 1_500_000,
	} {
		got, err := hwMicroUsdPerMillion([]byte(raw))
		require.NoError(t, err, raw)
		assert.Equal(t, want, got, raw)
	}

	for _, raw := range []string{"", "null", "abc", `"4e-06"`, "-1e-06"} {
		_, err := hwMicroUsdPerMillion([]byte(raw))
		assert.Error(t, err, raw)
	}
}

func TestHwParsePriceListKeepsPricesAsRawTextAndRejectsBadJSON(t *testing.T) {
	list, err := hwParsePriceList([]byte(`{"m1":{"input_cost_per_token":4e-06,"output_cost_per_token":2.0e-05,"mode":"chat"},"m2":{"mode":"embedding"}}`))
	require.NoError(t, err)
	require.Len(t, list, 2)
	assert.Equal(t, "chat", list["m1"].Mode)
	in, err := hwMicroUsdPerMillion(list["m1"].InputCostPerToken)
	require.NoError(t, err)
	out, err := hwMicroUsdPerMillion(list["m1"].OutputCostPerToken)
	require.NoError(t, err)
	assert.EqualValues(t, 4_000_000, in)
	assert.EqualValues(t, 20_000_000, out)
	_, err = hwMicroUsdPerMillion(list["m2"].InputCostPerToken)
	assert.Error(t, err, "an entry without a price is not usable")

	_, err = hwParsePriceList([]byte(`not json`))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not valid JSON")
}

// The model ratio is what the billing engine multiplies tokens by, so it must
// follow the list price with the standing discount applied once.
func TestHwRatiosFollowTheListPriceWithTheDiscountAppliedOnce(t *testing.T) {
	payable := float64(100-HwListPriceDiscountPercent) / 100
	assert.InDelta(t, payable, hwModelRatioFromInputPrice(2_000_000), 1e-12, "ratio 1 is two dollars per million tokens before the discount")
	assert.InDelta(t, 2*payable, hwModelRatioFromInputPrice(4_000_000), 1e-12)
	assert.Zero(t, hwModelRatioFromInputPrice(0))

	assert.InDelta(t, 5.0, hwCompletionRatioFromPrice(model.HwModelPrice{InputMicroUsd: 2_000_000, OutputMicroUsd: 10_000_000}), 1e-12)
	assert.Zero(t, hwCompletionRatioFromPrice(model.HwModelPrice{InputMicroUsd: 0, OutputMicroUsd: 10_000_000}), "no input price gives no ratio")
	assert.Zero(t, hwCompletionRatioFromPrice(model.HwModelPrice{InputMicroUsd: -1, OutputMicroUsd: 10_000_000}))
}

// The bulletin carries the date twice, in two regional formats; either one is
// enough, a malformed one is skipped and the result is always YYYY-MM-DD.
func TestHwTcmbFxDateAcceptsEitherFormat(t *testing.T) {
	for _, tc := range []struct{ date, tarih, want string }{
		{"10/26/2026", "", "2026-10-26"},
		{"", "26.10.2026", "2026-10-26"},
		{" 10/26/2026 ", "27.10.2026", "2026-10-26"},
		{"garbage", "26.10.2026", "2026-10-26"},
	} {
		got, err := hwTcmbFxDate(tc.date, tc.tarih)
		require.NoError(t, err, tc.date+"|"+tc.tarih)
		assert.Equal(t, tc.want, got)
	}

	for _, tc := range []struct{ date, tarih string }{{"", ""}, {"26.10.2026", "10/26/2026"}, {"13/40/2026", "40.13.2026"}} {
		_, err := hwTcmbFxDate(tc.date, tc.tarih)
		assert.Error(t, err, tc.date+"|"+tc.tarih)
	}
}

// TestHwPriceRefreshPublishesTheEuroRateWithoutRiskingTheLiraRate proves the
// two rates have different weights: the lira rate is what every order is priced
// on, so a bulletin without a usable euro line still refreshes it, while a
// bulletin with one publishes both.
func TestHwPriceRefreshPublishesTheEuroRateWithoutRiskingTheLiraRate(t *testing.T) {
	hwPricingTestSetup(t)
	priceServer := hwStartTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(hwTestPriceListBody))
	})
	hwSetOption(t, HwOptionPriceListURL, priceServer.URL)
	refreshWith := func(t *testing.T, fxBody string) {
		t.Helper()
		hwEurTestCleanOptions(t)
		fxServer := hwStartTestServer(t, func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(fxBody))
		})
		hwSetOption(t, HwOptionFxURL, fxServer.URL)
		hwSetOption(t, HwOptionTryPerUsd, "")
		hwSetOption(t, HwOptionTryPerUsdDate, "")
		require.NoError(t, HwRefreshPriceSnapshot(context.Background(), priceServer.Client(), time.Date(2026, 10, 20, 6, 0, 0, 0, time.UTC)))
	}

	t.Run("a usable euro line is published next to the lira rate", func(t *testing.T) {
		refreshWith(t, hwTestFxBodyWithEur)
		assert.Equal(t, "49.5523", hwOptionValue(HwOptionTryPerUsd))
		assert.Equal(t, "2026-10-19", hwOptionValue(HwOptionTryPerUsdDate))
		assert.Equal(t, "0.861779", hwOptionValue(model.HwEurPerUsdOption), "the cross rate of the two lira rates")
		assert.Equal(t, "2026-10-19", hwOptionValue(model.HwEurPerUsdDateOption))
	})
	t.Run("a bulletin without a euro line still refreshes the lira rate", func(t *testing.T) {
		refreshWith(t, hwTestFxBody)
		assert.Equal(t, "49.5523", hwOptionValue(HwOptionTryPerUsd))
		assert.Equal(t, "2026-10-19", hwOptionValue(HwOptionTryPerUsdDate))
		assert.Empty(t, hwOptionValue(model.HwEurPerUsdOption), "no euro rate is invented")
		snapshot, err := model.HwLatestPriceSnapshot()
		require.NoError(t, err)
		assert.Empty(t, snapshot.EurPerUsd)
	})
}

// TestHwNewCatalogModelsKeepsOnlyNewerChatModelsOfSoldFamilies pins the strict
// filter of the daily new-model check: only a newer or same-generation chat
// model of a sold family, under its plain name, is a candidate. Older
// generations, dated and "latest" variants of sold names, routed or regional
// keys, :free, retired and unsold families never are.
func TestHwNewCatalogModelsKeepsOnlyNewerChatModelsOfSoldFamilies(t *testing.T) {
	list, err := hwParsePriceList([]byte(`{
  "claude-opus-6": {"input_cost_per_token": 5e-06, "output_cost_per_token": 2.5e-05, "mode": "chat"},
  "gpt-6.2-sol": {"input_cost_per_token": 2e-06, "output_cost_per_token": 1e-05, "mode": "chat"},
  "gemini-3.8-pro": {"input_cost_per_token": 2e-06, "output_cost_per_token": 1.2e-05, "mode": "chat"},
  "grok-4.1-fast": {"input_cost_per_token": 2e-07, "output_cost_per_token": 5e-07, "mode": "chat"},
  "claude-opus-5-5": {"input_cost_per_token": 4e-06, "output_cost_per_token": 2e-05, "mode": "chat"},
  "claude-opus-5-5-20261001": {"input_cost_per_token": 4e-06, "output_cost_per_token": 2e-05, "mode": "chat"},
  "claude-opus-5-5-latest": {"input_cost_per_token": 4e-06, "output_cost_per_token": 2e-05, "mode": "chat"},
  "grok-4-0709": {"input_cost_per_token": 3e-06, "output_cost_per_token": 1.5e-05, "mode": "chat"},
  "claude-opus-4-1": {"input_cost_per_token": 1.5e-05, "output_cost_per_token": 7.5e-05, "mode": "chat"},
  "gemini-2.5-flash": {"input_cost_per_token": 3e-07, "output_cost_per_token": 2.5e-06, "mode": "chat"},
  "gpt-5.6-luna": {"input_cost_per_token": 1e-07, "output_cost_per_token": 5e-07, "mode": "chat"},
  "bedrock/claude-opus-6": {"input_cost_per_token": 5e-06, "output_cost_per_token": 2.5e-05, "mode": "chat"},
  "us.anthropic.claude-opus-6": {"input_cost_per_token": 5e-06, "output_cost_per_token": 2.5e-05, "mode": "chat"},
  "openrouter/gpt-6.2-sol:free": {"input_cost_per_token": 0, "output_cost_per_token": 0, "mode": "chat"},
  "gpt-6-image": {"input_cost_per_token": 5e-06, "output_cost_per_token": 4e-05, "mode": "image_generation"},
  "mistral-large-4": {"input_cost_per_token": 2e-06, "output_cost_per_token": 6e-06, "mode": "chat"},
  "gpt-6.3-nova": {"input_cost_per_token": null, "output_cost_per_token": 1e-05, "mode": "chat"}
}`))
	require.NoError(t, err)

	found := hwNewCatalogModels(list)
	names := make([]string, 0, len(found))
	for _, candidate := range found {
		names = append(names, candidate.Name)
	}
	// gpt-6.2-sol is a candidate again since the gpt generation 6 family returned
	// on 3 Nov 2026. gemini-3.8-pro is not one: gemini-3.8-flash-cyber was the
	// last sold gemini name and left the catalog on 29 Oct 2026 (HIS-5810), so
	// the family has no floor in hwSoldModels to compare against.
	assert.Equal(t, []string{"claude-opus-6", "gpt-6.2-sol", "grok-4.1-fast"}, names)
	assert.Equal(t, model.HwModelPrice{InputMicroUsd: 5_000_000, OutputMicroUsd: 25_000_000}, found[0].Price)
}

// TestHwReportNewModelsFilesOneCardPerNewModelOnce proves the daily check
// reports a new model once, to the Modelverkenner, with the official price and
// the proposed price at HwListPriceDiscountPercent below it, and that a model
// already reported is not reported again on the next day.
func TestHwReportNewModelsFilesOneCardPerNewModelOnce(t *testing.T) {
	hwPricingTestSetup(t)
	clean := func() {
		model.DB.Where("key = ?", HwOptionReportedNewModels).Delete(&model.Option{})
		common.OptionMapRWMutex.Lock()
		delete(common.OptionMap, HwOptionReportedNewModels)
		common.OptionMapRWMutex.Unlock()
	}
	clean()
	t.Cleanup(clean)
	var cards []hwBureauIssueRequest
	board := hwStartTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		var card hwBureauIssueRequest
		require.NoError(t, common.DecodeJson(r.Body, &card))
		cards = append(cards, card)
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"identifier":"HIS-2"}`))
	})
	config := HwBureauCardConfig{BaseURL: board.URL, CompanyID: "c1"}
	day1, err := hwParsePriceList([]byte(`{"claude-opus-6": {"input_cost_per_token": 5e-06, "output_cost_per_token": 2.5e-05, "mode": "chat"}}`))
	require.NoError(t, err)

	require.NoError(t, hwReportNewModels(context.Background(), HwBureauCardConfig{}, day1))
	assert.Empty(t, cards, "no board, no card")

	require.NoError(t, hwReportNewModels(context.Background(), config, day1))
	require.NoError(t, hwReportNewModels(context.Background(), config, day1))
	require.Len(t, cards, 1, "a model is reported once")
	assert.Equal(t, HwBureauAgentModelverkenner, cards[0].AssigneeAgentID)
	assert.Contains(t, cards[0].Description, "claude-opus-6: officieel $5 / $25, voorstel HisarWeb $2.5 / $12.5")

	// A second model of a sold family is a fresh card, and the first is not
	// repeated. grok-4.1-fast is newer than the sold grok-4-fast, so the grok
	// family still has a floor in hwSoldModels; gemini-3.8-pro is deliberately
	// not used here, because no gemini name is sold since HIS-5810.
	day2, err := hwParsePriceList([]byte(`{
  "claude-opus-6": {"input_cost_per_token": 5e-06, "output_cost_per_token": 2.5e-05, "mode": "chat"},
  "grok-4.1-fast": {"input_cost_per_token": 2e-07, "output_cost_per_token": 5e-07, "mode": "chat"}
}`))
	require.NoError(t, err)
	require.NoError(t, hwReportNewModels(context.Background(), config, day2))
	require.Len(t, cards, 2)
	assert.Contains(t, cards[1].Description, "grok-4.1-fast")
	assert.NotContains(t, cards[1].Description, "claude-opus-6")
}

// TestHwWebModelPricesMatchTheCatalog keeps the price table of the site
// (web/src/features/hw/data/model-prices.ts) in step with hwSoldModels: the
// same model ids both ways, the official column equal to the catalog list
// price, and the HisarWeb column HwListPriceDiscountPercent below it. A model
// without an official list price (official: null) still sells at half the
// catalog price.
func TestHwWebModelPricesMatchTheCatalog(t *testing.T) {
	source, err := os.ReadFile("../web/src/features/hw/data/model-prices.ts")
	require.NoError(t, err)
	text := string(source)
	start := strings.Index(text, "export const MODEL_PRICES: readonly ModelPrice[] = [")
	require.GreaterOrEqual(t, start, 0, "MODEL_PRICES table not found")
	end := strings.Index(text[start:], "\n]\n")
	require.Greater(t, end, 0, "end of MODEL_PRICES not found")
	table := text[start : start+end]

	usd := func(value string) decimal.Decimal {
		parsed, err := decimal.NewFromString(value)
		require.NoError(t, err)
		return parsed
	}
	entry := regexp.MustCompile(`model: '([^']+)'[\s\S]*?official: (null|\{ input: ([\d.]+), output: ([\d.]+) \})[\s\S]*?hisarweb: \{ input: ([\d.]+), output: ([\d.]+) \}`)
	matches := entry.FindAllStringSubmatch(table, -1)
	require.Equal(t, strings.Count(table, "model: '"), len(matches), "every MODEL_PRICES entry must parse")

	web := make(map[string]bool, len(matches))
	for _, m := range matches {
		name := m[1]
		web[name] = true
		sold, ok := hwFindSoldModel(name)
		if !assert.True(t, ok, "%s is on the site but not in hwSoldModels", name) {
			continue
		}
		listIn := decimal.New(sold.InputMicroUsd, -6)
		listOut := decimal.New(sold.OutputMicroUsd, -6)
		if m[2] == "null" {
			assert.True(t, sold.ListOptional, "%s shows no official price but has one in the catalog", name)
		} else {
			assert.True(t, usd(m[3]).Equal(listIn), "%s official input %s, catalog %s", name, m[3], listIn)
			assert.True(t, usd(m[4]).Equal(listOut), "%s official output %s, catalog %s", name, m[4], listOut)
		}
		assert.True(t, usd(m[5]).Equal(HwOurUsd(listIn)), "%s HisarWeb input %s, want %s", name, m[5], HwOurUsd(listIn))
		assert.True(t, usd(m[6]).Equal(HwOurUsd(listOut)), "%s HisarWeb output %s, want %s", name, m[6], HwOurUsd(listOut))
	}
	for _, name := range hwShownSoldModelNames() {
		assert.True(t, web[name], "%s is sold but missing from the site price table", name)
	}
}
