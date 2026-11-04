package service

import (
	"fmt"
	"maps"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Gouden regel (Altuner, 24 okt 2026): always the best quality for the best
// price, and we never lower the price of an old model. An older model stays in
// the catalog only while it is cheaper than the newest model of its own family;
// an old model that costs the same or more is retired (hwRetiredModels) and the
// customer is sent to the newer one.

var (
	hwClaudeModelPattern = regexp.MustCompile(`^claude-(haiku|sonnet|opus|fable)-(\d+(?:-\d+)*)$`)
	hwTierModelPattern   = regexp.MustCompile(`^(gpt|gemini)-(\d+(?:\.\d+)*)-([a-z]+(?:-[a-z]+)*)$`)
	hwGrokModelPattern   = regexp.MustCompile(`^grok-(\d+(?:\.\d+)?)(?:-([a-z]+))?$`)
	hwBareModelPattern   = regexp.MustCompile(`^(gpt|gemini)-(\d+(?:\.\d+)*)$`)
)

// hwValueFamily splits a sold model name into its family (the tier that is
// interchangeable for the customer) and its version numbers.
func hwValueFamily(name string) (string, []int, error) {
	var family, version string
	if m := hwClaudeModelPattern.FindStringSubmatch(name); m != nil {
		family, version = "claude-"+m[1], strings.ReplaceAll(m[2], "-", ".")
	} else if m := hwTierModelPattern.FindStringSubmatch(name); m != nil {
		family, version = m[1]+"-"+m[3], m[2]
	} else if m := hwGrokModelPattern.FindStringSubmatch(name); m != nil {
		family, version = "grok", m[1]
		if m[2] != "" {
			family = "grok-" + m[2]
		}
	} else if m := hwBareModelPattern.FindStringSubmatch(name); m != nil {
		family, version = m[1]+"-"+m[2], m[2]
	} else {
		return "", nil, fmt.Errorf("model %q has no known family; extend hwValueFamily", name)
	}
	parts := strings.Split(version, ".")
	numbers := make([]int, len(parts))
	for i, part := range parts {
		n, err := strconv.Atoi(part)
		if err != nil {
			return "", nil, err
		}
		numbers[i] = n
	}
	return family, numbers, nil
}

func hwVersionNewer(a, b []int) bool {
	for i := 0; i < len(a) || i < len(b); i++ {
		var x, y int
		if i < len(a) {
			x = a[i]
		}
		if i < len(b) {
			y = b[i]
		}
		if x != y {
			return x > y
		}
	}
	return false
}

// hwOlderModelsNotCheaper lists every model of the catalog that is older than
// another model of its family and not cheaper than the newest one, on input or
// on output.
func hwOlderModelsNotCheaper(t *testing.T, catalog []HwSoldModel, prices map[string]model.HwModelPrice) []string {
	t.Helper()
	type member struct {
		name    string
		version []int
	}
	newest := map[string]member{}
	familyOf := map[string]string{}
	for _, sold := range catalog {
		family, version, err := hwValueFamily(sold.Name)
		require.NoError(t, err)
		familyOf[sold.Name] = family
		if current, ok := newest[family]; !ok || hwVersionNewer(version, current.version) {
			newest[family] = member{name: sold.Name, version: version}
		}
	}
	var offenders []string
	for _, sold := range catalog {
		top := newest[familyOf[sold.Name]].name
		if top == sold.Name {
			continue
		}
		price, ok := prices[sold.Name]
		require.True(t, ok, "no price for %s", sold.Name)
		topPrice, ok := prices[top]
		require.True(t, ok, "no price for %s", top)
		if price.InputMicroUsd >= topPrice.InputMicroUsd || price.OutputMicroUsd >= topPrice.OutputMicroUsd {
			offenders = append(offenders, sold.Name)
		}
	}
	return offenders
}

// TestHwSoldModelsOnlyKeepOlderModelsThatAreCheaper fails as soon as the catalog
// sells an older model that is not cheaper than the newest of its family.
func TestHwSoldModelsOnlyKeepOlderModelsThatAreCheaper(t *testing.T) {
	assert.Empty(t, hwOlderModelsNotCheaper(t, hwSoldModels, hwSoldModelFallbackPrices()))

	// The official list prices of 24 Oct 2026: Haiku 4.5 costs ten times Haiku
	// 5.5 and Sonnet 5 as much as Sonnet 5.5, so a catalog that still sold them
	// fails; a cheaper older model would be allowed.
	catalog := append(slices.Clone(hwSoldModels),
		HwSoldModel{Name: "claude-haiku-4-5", PriceKey: "claude-haiku-4-5", InputMicroUsd: 1_000_000, OutputMicroUsd: 5_000_000},
		HwSoldModel{Name: "claude-sonnet-5", PriceKey: "claude-sonnet-5", InputMicroUsd: 2_000_000, OutputMicroUsd: 10_000_000},
		HwSoldModel{Name: "claude-opus-5", PriceKey: "claude-opus-5", InputMicroUsd: 3_000_000, OutputMicroUsd: 15_000_000},
	)
	prices := map[string]model.HwModelPrice{}
	for _, sold := range catalog {
		prices[sold.Name] = model.HwModelPrice{InputMicroUsd: sold.InputMicroUsd, OutputMicroUsd: sold.OutputMicroUsd}
	}
	assert.ElementsMatch(t, []string{"claude-haiku-4-5", "claude-sonnet-5"}, hwOlderModelsNotCheaper(t, catalog, prices))
}

// TestHwRetiredModelsAreNotSoldAndPointAtASoldModel keeps the retirement list
// consistent with the catalog: a retired name is never sold, its successor is,
// and both belong to the same family. A family that is no longer sold at all
// (the gpt family left the catalog on 24 Oct 2026) has no newer namesake, so
// its successor only has to be a sold model of the same price tier.
func TestHwRetiredModelsAreNotSoldAndPointAtASoldModel(t *testing.T) {
	sold := map[string]bool{}
	soldFamily := map[string]bool{}
	for _, entry := range hwSoldModels {
		sold[entry.Name] = true
		family, _, err := hwValueFamily(entry.Name)
		require.NoError(t, err)
		soldFamily[family] = true
	}
	for retired, successor := range hwRetiredModels {
		assert.False(t, sold[retired], "%s is retired but still sold", retired)
		assert.True(t, sold[successor], "the successor %s of %s is not sold", successor, retired)
		retiredFamily, _, err := hwValueFamily(retired)
		require.NoError(t, err)
		successorFamily, _, err := hwValueFamily(successor)
		require.NoError(t, err)
		if !soldFamily[retiredFamily] {
			assert.NotEqual(t, retiredFamily, successorFamily, retired)
			continue
		}
		assert.Equal(t, retiredFamily, successorFamily, retired)
	}
	// The gpt generation 6 families are sold again since 3 Nov 2026; terra and
	// the bare gpt-6 name have no sold namesake, so they point at gpt-6.1-sol.
	assert.True(t, soldFamily["gpt-luna"])
	assert.True(t, soldFamily["gpt-sol"])
	assert.True(t, soldFamily["gpt-astra"])
	// claude-fable-5-1 is sold again since 4 Nov 2026 and is no longer retired.
	assert.True(t, soldFamily["claude-fable"])
	_, fableRetired := hwRetiredModels["claude-fable-5-1"]
	assert.False(t, fableRetired)
	assert.False(t, soldFamily["gpt-terra"])
	assert.False(t, soldFamily["gpt-6"])
}

// TestHwDailyPriceListSkipsRetiredModels checks the daily refresh path: the open
// price list still lists the retired models, but the snapshot only prices what
// we sell.
func TestHwDailyPriceListSkipsRetiredModels(t *testing.T) {
	list := map[string]hwPriceListEntry{}
	for name, price := range map[string][2]string{
		"claude-opus-5-5":        {"4e-06", "2e-05"},
		"claude-sonnet-5-5":      {"2e-06", "1e-05"},
		"claude-sonnet-5":        {"2e-06", "1e-05"},
		"claude-haiku-5-5":       {"1e-07", "5e-07"},
		"claude-haiku-4-5":       {"1e-06", "5e-06"},
		"claude-fable-5-1":       {"1e-05", "5e-05"},
		"gpt-6-astra":            {"1e-05", "5e-05"},
		"gpt-6.1-sol":            {"2e-06", "1e-05"},
		"gpt-6-luna":             {"1e-07", "5e-07"},
		"gemini-3.8-flash":       {"7.5e-07", "3.75e-06"},
		"gemini-3.8-flash-cyber": {"1.5e-06", "7.5e-06"},
		"grok-4":                 {"2e-06", "6e-06"},
		"grok-4-fast":            {"2e-06", "6e-06"},
	} {
		list[name] = hwPriceListEntry{InputCostPerToken: []byte(price[0]), OutputCostPerToken: []byte(price[1]), Mode: "chat"}
	}
	prices, err := hwExtractSoldModelPrices(list)
	require.NoError(t, err)
	require.Len(t, prices, len(hwSoldModels))
	assert.Empty(t, hwOlderModelsNotCheaper(t, hwSoldModels, prices))
	for retired := range hwRetiredModels {
		assert.NotContains(t, prices, retired)
	}
}

// TestHwPriceListToleratesListOptionalModels: a sold model without an official
// list price (ListOptional) may be absent from the daily list — the extraction
// keeps every other price instead of refusing the whole snapshot. A model with
// a list price stays mandatory.
func TestHwPriceListToleratesListOptionalModels(t *testing.T) {
	complete := map[string]hwPriceListEntry{}
	for _, sold := range hwSoldModels {
		complete[sold.PriceKey] = hwPriceListEntry{
			InputCostPerToken:  []byte(decimal.New(sold.InputMicroUsd, -6).String()),
			OutputCostPerToken: []byte(decimal.New(sold.OutputMicroUsd, -6).String()),
			Mode:               "chat",
		}
	}
	withoutGrok := map[string]hwPriceListEntry{}
	for key, entry := range complete {
		if key == "grok-4" || key == "grok-4-fast" {
			continue
		}
		withoutGrok[key] = entry
	}
	prices, err := hwExtractSoldModelPrices(withoutGrok)
	require.NoError(t, err)
	assert.NotContains(t, prices, "grok-4")
	assert.NotContains(t, prices, "grok-4-fast")
	assert.Len(t, prices, len(hwSoldModels)-2)

	delete(complete, "claude-opus-5-5")
	_, err = hwExtractSoldModelPrices(complete)
	assert.Error(t, err, "a model with an official list price stays mandatory")
}

// TestHwPriceListRequiresEverySoldModel protects the bill against a price list
// that silently lost one of our model keys: the extraction refuses instead of
// returning a partial map, so the caller keeps the previous snapshot and the
// ratios of that model are never left at yesterday's value.
func TestHwPriceListRequiresEverySoldModel(t *testing.T) {
	complete := map[string]hwPriceListEntry{}
	for _, sold := range hwSoldModels {
		complete[sold.PriceKey] = hwPriceListEntry{
			InputCostPerToken:  []byte(decimal.New(sold.InputMicroUsd, -6).String()),
			OutputCostPerToken: []byte(decimal.New(sold.OutputMicroUsd, -6).String()),
			Mode:               "chat",
		}
	}
	// A tenth of a micro-dollar per million tokens: the reference the list
	// publishes for the cheapest model, so a real price is never zero.
	_, err := hwExtractSoldModelPrices(complete)
	require.NoError(t, err)

	missing := hwSoldModels[0]
	delete(complete, missing.PriceKey)
	prices, err := hwExtractSoldModelPrices(complete)
	require.Error(t, err, "a sold model missing from the list is an error, not a gap")
	assert.Contains(t, err.Error(), missing.Name)
	assert.Nil(t, prices, "no partial map may reach the snapshot")

	for _, broken := range []struct {
		name    string
		field   string
		rawText string
	}{
		{"zero input", "input", "0"},
		{"null input", "input", "null"},
		{"empty input", "input", ""},
		{"negative input", "input", "-4e-06"},
		{"zero output", "output", "0"},
	} {
		list := maps.Clone(complete)
		entry := list[hwSoldModels[0].PriceKey]
		if broken.field == "input" {
			entry.InputCostPerToken = []byte(broken.rawText)
		} else {
			entry.OutputCostPerToken = []byte(broken.rawText)
		}
		list[hwSoldModels[0].PriceKey] = entry
		_, err := hwExtractSoldModelPrices(list)
		assert.Error(t, err, broken.name)
	}
}

func TestHwValueFamily(t *testing.T) {
	cases := map[string]string{
		"claude-haiku-4-5":  "claude-haiku",
		"claude-haiku-5-5":  "claude-haiku",
		"claude-sonnet-5":   "claude-sonnet",
		"claude-fable-5-1":  "claude-fable",
		"gpt-6-astra":       "gpt-astra",
		"gpt-6.1-sol":       "gpt-sol",
		"gemini-3.8-flash":  "gemini-flash",
		"claude-opus-5-5":   "claude-opus",
		"claude-sonnet-5-5": "claude-sonnet",
	}
	for name, want := range cases {
		family, _, err := hwValueFamily(name)
		require.NoError(t, err, name)
		assert.Equal(t, want, family, name)
	}
	_, a, _ := hwValueFamily("claude-sonnet-5-5")
	_, b, _ := hwValueFamily("claude-sonnet-5")
	assert.True(t, hwVersionNewer(a, b))
	assert.False(t, hwVersionNewer(b, a))
	_, _, err := hwValueFamily("mystery-model")
	assert.Error(t, err)
}

func TestHwPremiumModelsFollowThePriceThreshold(t *testing.T) {
	assert.True(t, HwIsPremiumModel("claude-fable-5-1"))
	assert.True(t, HwIsPremiumModel("gpt-6-astra"))
	assert.False(t, HwIsPremiumModel("claude-opus-5-5"))
	assert.False(t, HwIsPremiumModel("gpt-6.1-sol"))
	assert.False(t, HwIsPremiumModel("gpt-6"), "a retired name is never premium")
	assert.True(t, HwIsSoldModel("claude-haiku-5-5"))
	assert.False(t, HwIsSoldModel("gpt-6"))
	for _, sold := range hwSoldModels {
		assert.Equal(t, sold.InputMicroUsd >= HwPremiumInputMicroUsd, HwIsPremiumModel(sold.Name), sold.Name)
	}
}
