package service

// Daily TL pricing for HisarWeb AI: a master-node job fetches the open LiteLLM
// price list and the TCMB USD/TRY rate once a day, stores both as one snapshot,
// and publishes the rate through the HwTryPerUsd option. Every TRY amount the
// customer sees is derived from that snapshot with decimal arithmetic only.

import (
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/shopspring/decimal"
)

// Option keys and built-in source URLs. The URL options are empty by default;
// an empty option means the built-in URL below.
const (
	HwOptionPriceListURL  = "HwPriceListURL"
	HwOptionFxURL         = "HwFxURL"
	HwOptionTryPerUsd     = "HwTryPerUsd"
	HwOptionTryPerUsdDate = "HwTryPerUsdDate"

	HwDefaultPriceListURL = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"
	HwDefaultFxURL        = "https://www.tcmb.gov.tr/kurlar/today.xml"
)

const (
	hwPriceSnapshotInterval = 24 * time.Hour
	hwPriceFetchTimeout     = 60 * time.Second
	// hwPriceMaxBodyBytes caps both downloads; the real price list is a few MB.
	hwPriceMaxBodyBytes = 32 << 20
	// HwMaxTokensPerMonth bounds the comparator's monthly token volumes. The
	// bound also guards the micro-dollar multiplication against int64
	// overflow: 2 x 1e11 x 1.68e8 (the priciest listed chat price) stays far
	// below 9.2e18.
	HwMaxTokensPerMonth = 100_000_000_000
)

var (
	// ErrHwInvalidRate rejects a missing, zero, negative, or unparseable rate.
	ErrHwInvalidRate = errors.New("USD/TRY rate is missing or invalid")
	// ErrHwNegativeUsdValue rejects a negative dollar amount; a price the
	// customer sees can never be negative.
	ErrHwNegativeUsdValue = errors.New("dollar value must not be negative")
)

// HwSoldModel links the model name we sell to its key in the open price list
// and to the list price we bill from. The name is the customer-facing own name;
// the price list key never appears in a customer-facing answer.
//
// The prices are the official USD list prices per million tokens, in integer
// micro-dollars ($1.75 = 1750000) — the same unit the daily snapshot stores, so
// the seeding of the billing ratios and a price snapshot share one conversion.
type HwSoldModel struct {
	Name     string
	PriceKey string
	// InputMicroUsd and OutputMicroUsd are the prices of the LiteLLM price list
	// of 20 Oct 2026, used only until the first snapshot is stored.
	InputMicroUsd  int64
	OutputMicroUsd int64
	// ListOptional marks a model the LiteLLM price list does not carry (xAI
	// delisted grok-4 and grok-4-fast, so no official list price exists). The
	// daily refresh then keeps the operator ratio instead of refusing the
	// whole snapshot; the catalog prices above stay the seed value.
	ListOptional bool
}

// hwSoldModels is the catalog of models we sell under our own names. The
// comparator and the quality meter both read it, so a model appears on the site
// only when it is here. An older model stays only while it is cheaper than the
// newest model of its family; once a newer model costs the same or less, the
// older one moves to hwRetiredModels.
var hwSoldModels = []HwSoldModel{
	// claude-fable-5-1 returned on 4 Nov 2026 (request Altuner, lifts HIS-5127)
	// after a graded check on Lumia against claude-opus-5-5 (kennis/
	// lumia-modelkeuring.md, 4 Nov): every answered task correct, a needle found
	// in a 116k token prompt and a full 1..800 list. The price is the official
	// Anthropic list price of that day ($10 / $50 per million tokens).
	{Name: "claude-fable-5-1", PriceKey: "claude-fable-5-1", InputMicroUsd: 10_000_000, OutputMicroUsd: 50_000_000},
	{Name: "claude-opus-5-5", PriceKey: "claude-opus-5-5", InputMicroUsd: 4_000_000, OutputMicroUsd: 20_000_000},
	{Name: "claude-sonnet-5-5", PriceKey: "claude-sonnet-5-5", InputMicroUsd: 2_000_000, OutputMicroUsd: 10_000_000},
	{Name: "claude-haiku-5-5", PriceKey: "claude-haiku-5-5", InputMicroUsd: 100_000, OutputMicroUsd: 500_000},
	// The gpt generation 6 family returned on 3 Nov 2026 (request Altuner) after
	// a graded check on Lumia (kennis/lumia-modelkeuring.md, 3 Nov): all three
	// scored 8/8 with executed code tests and read a 116k token context. The
	// prices are the official LiteLLM list prices of that day.
	{Name: "gpt-6-luna", PriceKey: "gpt-6-luna", InputMicroUsd: 100_000, OutputMicroUsd: 500_000},
	{Name: "gpt-6.1-sol", PriceKey: "gpt-6.1-sol", InputMicroUsd: 2_000_000, OutputMicroUsd: 10_000_000},
	{Name: "gpt-6-astra", PriceKey: "gpt-6-astra", InputMicroUsd: 10_000_000, OutputMicroUsd: 50_000_000},
	// grok-4 and grok-4-fast sell at the xAI standard tier the upstream bills;
	// xAI delisted both from its own price pages, so no official list price
	// exists and the daily refresh keeps the operator ratio.
	{Name: "grok-4", PriceKey: "grok-4", InputMicroUsd: 2_000_000, OutputMicroUsd: 6_000_000, ListOptional: true},
	{Name: "grok-4-fast", PriceKey: "grok-4-fast", InputMicroUsd: 2_000_000, OutputMicroUsd: 6_000_000, ListOptional: true},
}

// hwRetiredModels maps a model we no longer sell to the newer model of its
// family that replaces it. We never lower the price of an old model: when a
// newer model is as cheap or cheaper, the old one leaves the catalog and the
// customer is sent to the newer one. Startup removes these names from the
// channels and the billing ratios (hwSeedRetiredModels).
var hwRetiredModels = map[string]string{
	"claude-haiku-4-5": "claude-haiku-5-5",
	"claude-sonnet-5":  "claude-sonnet-5-5",
	// The gpt 5.6 generation and the bare gpt-6 name stay out of the catalog
	// under the golden rule: on the list prices of 3 Nov 2026 every successor
	// below is newer and as cheap or cheaper, with the same graded score.
	"gpt-5.6-luna":  "gpt-6-luna",
	"gpt-5.6-sol":   "gpt-6.1-sol",
	"gpt-5.6-terra": "gpt-6.1-sol",
	"gpt-6":         "gpt-6.1-sol",
	// gemini-3.8-flash left the catalog on 27 Oct 2026 after the model check
	// (kennis/lumia-modelkeuring.md): the name has no route under the sold name
	// (HTTP 403 key_model_access_denied) and no vendor route, so it points at
	// the sold model of its own price tier.
	"gemini-3.8-flash": "claude-haiku-5-5",
	// gemini-3.8-flash-cyber left the catalog on 29 Oct 2026 (CEO decision on
	// HIS-5805, option 1): measured through the relay it was twice as slow as
	// grok-4 (median 12.35 s against 6.12 s, 6 of 10 calls above 10 s, all
	// HTTP 200), so the name is no longer sold. It has no newer namesake in its
	// family, so it points at the sold model of its own price tier.
	"gemini-3.8-flash-cyber": "claude-haiku-5-5",
}

// HwPremiumInputMicroUsd is the input list price (micro-dollars per million
// tokens) from which a sold model counts as premium: claude-fable-5-1 and
// gpt-6-astra on 4 Nov 2026, and every later model at least that expensive
// without a code change. The console warns on a premium model that it uses up
// the credit much faster than the model one step lower.
const HwPremiumInputMicroUsd = 10_000_000

// HwIsSoldModel reports whether name is a model of the catalog.
func HwIsSoldModel(name string) bool {
	return slices.ContainsFunc(hwSoldModels, func(sold HwSoldModel) bool { return sold.Name == name })
}

// HwIsPremiumModel reports whether name is a sold model priced at or above
// HwPremiumInputMicroUsd.
func HwIsPremiumModel(name string) bool {
	return slices.ContainsFunc(hwSoldModels, func(sold HwSoldModel) bool {
		return sold.Name == name && sold.InputMicroUsd >= HwPremiumInputMicroUsd
	})
}

// HwModelStepDown returns the sold model one step lower than name: the model of
// the same vendor (the name before the first dash) with the highest input list
// price strictly below it. It is the console's premiumStepDown for any model,
// and empty when name is not sold or is already the cheapest of its vendor.
func HwModelStepDown(name string) string {
	vendor, _, _ := strings.Cut(name, "-")
	var current *HwSoldModel
	for i := range hwSoldModels {
		if hwSoldModels[i].Name == name {
			current = &hwSoldModels[i]
		}
	}
	if current == nil {
		return ""
	}
	best := ""
	bestInput := int64(-1)
	for _, sold := range hwSoldModels {
		soldVendor, _, _ := strings.Cut(sold.Name, "-")
		if soldVendor != vendor || int64(sold.InputMicroUsd) >= int64(current.InputMicroUsd) || int64(sold.InputMicroUsd) <= bestInput {
			continue
		}
		best, bestInput = sold.Name, int64(sold.InputMicroUsd)
	}
	return best
}

// HwRetiredModelSuccessor returns the model that replaces a retired model name.
func HwRetiredModelSuccessor(name string) (string, bool) {
	successor, ok := hwRetiredModels[name]
	return successor, ok
}

// HwListPriceDiscountPercent is how far below the official list price every
// sold model is billed. Routers such as OpenRouter bill the list price or more,
// and the prepaid usage credits of Anthropic give at most 30 %, so 50 % keeps
// us the cheapest real-time option for every model in the catalog.
const HwListPriceDiscountPercent = 50

// hwListPricePayable is the share of the list price a customer pays.
var hwListPricePayable = decimal.NewFromInt(100 - HwListPriceDiscountPercent).Div(decimal.NewFromInt(100))

// HwOurUsd is the dollar amount we bill for a usage the provider lists at
// listUsd.
func HwOurUsd(listUsd decimal.Decimal) decimal.Decimal {
	return listUsd.Mul(hwListPricePayable)
}

// hwSoldModelFallbackPrices exposes the catalog prices in the shape of a price
// snapshot, so the startup seeding converts them exactly like the daily job.
func hwSoldModelFallbackPrices() map[string]model.HwModelPrice {
	prices := make(map[string]model.HwModelPrice, len(hwSoldModels))
	for _, sold := range hwSoldModels {
		prices[sold.Name] = model.HwModelPrice{InputMicroUsd: sold.InputMicroUsd, OutputMicroUsd: sold.OutputMicroUsd}
	}
	return prices
}

// hwModelRatioFromInputPrice converts an input list price (micro-dollars per
// million tokens) into the model ratio the billing engine multiplies tokens by:
// ratio 1 is $2 per million tokens, and the list price discount is applied here
// so the seeding and the daily refresh bill the same price.
func hwModelRatioFromInputPrice(inputMicroUsd int64) float64 {
	return HwOurUsd(decimal.New(inputMicroUsd, 0)).Div(decimal.NewFromInt(2_000_000)).InexactFloat64()
}

// hwCompletionRatioFromPrice is the output price in units of the input price.
func hwCompletionRatioFromPrice(price model.HwModelPrice) float64 {
	if price.InputMicroUsd <= 0 {
		return 0
	}
	return decimal.New(price.OutputMicroUsd, 0).Div(decimal.New(price.InputMicroUsd, 0)).InexactFloat64()
}

// hwWriteRatioOption stores a merged ratio map. The option update also replaces
// the in-memory map, so the caller must pass the complete map it wants to keep;
// that map is always taken from the effective ratio map, never from the option
// text, so an empty option cannot wipe the engine's built-in ratios.
func hwWriteRatioOption(key string, values map[string]float64) error {
	encoded, err := common.Marshal(values)
	if err != nil {
		return err
	}
	return model.UpdateOption(key, string(encoded))
}

// HwApplySnapshotModelRatios aligns the billing ratios of the sold models with
// the newest price snapshot, so a request is billed at the day's list price
// minus HwListPriceDiscountPercent.
// Only the entries of the sold models are touched; every other ratio the
// operator configured stays exactly as it is.
func HwApplySnapshotModelRatios(snapshot *model.HwPriceSnapshot) error {
	prices, err := snapshot.HwSnapshotModelPrices()
	if err != nil {
		return err
	}
	modelRatios := ratio_setting.GetModelRatioCopy()
	completionRatios := ratio_setting.GetCompletionRatioCopy()
	modelChanged, completionChanged := false, false
	for _, sold := range hwSoldModels {
		price, ok := prices[sold.Name]
		if !ok || price.InputMicroUsd <= 0 || price.OutputMicroUsd <= 0 {
			continue
		}
		if ratio := hwModelRatioFromInputPrice(price.InputMicroUsd); modelRatios[sold.Name] != ratio {
			modelRatios[sold.Name] = ratio
			modelChanged = true
		}
		if ratio := hwCompletionRatioFromPrice(price); completionRatios[sold.Name] != ratio {
			completionRatios[sold.Name] = ratio
			completionChanged = true
		}
	}
	if modelChanged || completionChanged {
		// Both ratio maps go out in one transaction: a failed write then leaves
		// the old input ratio next to the old output ratio instead of billing a
		// mix of today's input price and yesterday's output ratio.
		updates := make(map[string]string, 2)
		for key, values := range map[string]map[string]float64{
			"ModelRatio":      modelRatios,
			"CompletionRatio": completionRatios,
		} {
			encoded, err := common.Marshal(values)
			if err != nil {
				return err
			}
			updates[key] = string(encoded)
		}
		return model.UpdateModelPricingOptions(updates)
	}
	return nil
}

// HwSoldModelNames returns the own names of every model in the catalog.
func HwSoldModelNames() []string {
	names := make([]string, 0, len(hwSoldModels))
	for _, sold := range hwSoldModels {
		names = append(names, sold.Name)
	}
	return names
}

func hwFindSoldModel(name string) (HwSoldModel, bool) {
	for _, sold := range hwSoldModels {
		if sold.Name == name {
			return sold, true
		}
	}
	return HwSoldModel{}, false
}

// hwOptionValue reads one option with the option lock held.
func hwOptionValue(key string) string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return common.OptionMap[key]
}

// HwPriceListURL returns the configured price list URL, or the built-in one.
func HwPriceListURL() string {
	if url := strings.TrimSpace(hwOptionValue(HwOptionPriceListURL)); url != "" {
		return url
	}
	return HwDefaultPriceListURL
}

// HwFxURL returns the configured exchange rate URL, or the built-in one.
func HwFxURL() string {
	if url := strings.TrimSpace(hwOptionValue(HwOptionFxURL)); url != "" {
		return url
	}
	return HwDefaultFxURL
}

// hwPriceListEntry keeps each price as raw JSON text so the decimal string is
// parsed exactly as published (the list uses scientific notation like 4e-06),
// never through a float.
type hwPriceListEntry struct {
	InputCostPerToken  common.RawMessage `json:"input_cost_per_token"`
	OutputCostPerToken common.RawMessage `json:"output_cost_per_token"`
	Mode               string            `json:"mode"`
}

// hwParsePriceList decodes the open price list document.
func hwParsePriceList(body []byte) (map[string]hwPriceListEntry, error) {
	var list map[string]hwPriceListEntry
	if err := common.Unmarshal(body, &list); err != nil {
		return nil, fmt.Errorf("price list is not valid JSON: %w", err)
	}
	return list, nil
}

// hwMicroUsdPerMillion converts a per-token price (decimal text) into integer
// micro-dollars per million tokens: USD/token x 1,000,000 tokens x 1,000,000
// micro/USD. A price smaller than a micro-dollar per million tokens is rounded
// to the nearest micro-dollar; that is far below any real model price.
func hwMicroUsdPerMillion(raw []byte) (int64, error) {
	text := strings.TrimSpace(string(raw))
	if text == "" || text == "null" {
		return 0, errors.New("price field is empty")
	}
	perToken, err := decimal.NewFromString(text)
	if err != nil {
		return 0, fmt.Errorf("price %q is not a number", text)
	}
	if perToken.IsNegative() {
		return 0, fmt.Errorf("price %q is negative", text)
	}
	return perToken.Mul(decimal.NewFromInt(1_000_000_000_000)).Round(0).IntPart(), nil
}

// hwExtractSoldModelPrices picks our catalog models out of the parsed price
// list. Every sold model must be there with a positive price; a missing key or
// a zero price is an error, so a renamed or temporarily broken entry keeps the
// previous snapshot and its ratios instead of leaving one model billed at
// yesterday's ratio while the page shows today's price. A ListOptional model
// (no official list price exists) is the one exception: when the list does not
// carry it, it is left out and keeps its operator ratio.
func hwExtractSoldModelPrices(list map[string]hwPriceListEntry) (map[string]model.HwModelPrice, error) {
	prices := make(map[string]model.HwModelPrice, len(hwSoldModels))
	for _, sold := range hwSoldModels {
		entry, ok := list[sold.PriceKey]
		if !ok {
			if sold.ListOptional {
				continue
			}
			return nil, fmt.Errorf("model %s is missing from the price list", sold.Name)
		}
		inMicro, err := hwMicroUsdPerMillion(entry.InputCostPerToken)
		if err != nil {
			return nil, fmt.Errorf("model %s: input price: %w", sold.Name, err)
		}
		outMicro, err := hwMicroUsdPerMillion(entry.OutputCostPerToken)
		if err != nil {
			return nil, fmt.Errorf("model %s: output price: %w", sold.Name, err)
		}
		if inMicro <= 0 || outMicro <= 0 {
			return nil, fmt.Errorf("model %s: price must be positive (input %d, output %d micro-USD per million tokens)", sold.Name, inMicro, outMicro)
		}
		prices[sold.Name] = model.HwModelPrice{InputMicroUsd: inMicro, OutputMicroUsd: outMicro}
	}
	return prices, nil
}

// hwTcmbDocument mirrors the parts of the TCMB daily rates bulletin we need.
type hwTcmbDocument struct {
	XMLName    struct{} `xml:"Tarih_Date"`
	Date       string   `xml:"Date,attr"`
	Tarih      string   `xml:"Tarih,attr"`
	Currencies []struct {
		Code         string `xml:"CurrencyCode,attr"`
		ForexSelling string `xml:"ForexSelling"`
	} `xml:"Currency"`
}

// hwParseTcmbFx reads the USD forex-selling rate and the validity date from the
// TCMB bulletin. The rate is kept as decimal text exactly as published; an
// empty, non-numeric, zero, or negative rate is refused.
func hwParseTcmbFx(body []byte) (decimal.Decimal, string, error) {
	var doc hwTcmbDocument
	if err := xml.Unmarshal(body, &doc); err != nil {
		return decimal.Decimal{}, "", fmt.Errorf("rate document is not valid XML: %w", err)
	}
	rateText := ""
	for _, currency := range doc.Currencies {
		if currency.Code == "USD" {
			rateText = strings.TrimSpace(currency.ForexSelling)
			break
		}
	}
	if rateText == "" {
		return decimal.Decimal{}, "", errors.New("USD forex selling rate not found")
	}
	rate, err := decimal.NewFromString(rateText)
	if err != nil {
		return decimal.Decimal{}, "", fmt.Errorf("rate %q is not a number", rateText)
	}
	if !rate.IsPositive() {
		return decimal.Decimal{}, "", fmt.Errorf("rate %q is not positive", rateText)
	}
	fxDate, err := hwTcmbFxDate(doc.Date, doc.Tarih)
	if err != nil {
		return decimal.Decimal{}, "", err
	}
	return rate, fxDate, nil
}

// Reasons the EUR cross rate could not be read; only the class is logged.
var (
	errHwEurRateMissing = errors.New("EUR forex selling rate not found")
	errHwEurRateInvalid = errors.New("EUR rate is not a positive number")
)

// hwParseTcmbEurPerUsd computes the EUR per USD cross rate from the same bulletin:
// the USD/TRY rate divided by the EUR/TRY forex-selling rate, rounded to six
// decimals. It never fills in a value from memory.
func hwParseTcmbEurPerUsd(body []byte, usdTry decimal.Decimal) (decimal.Decimal, error) {
	var doc hwTcmbDocument
	if err := xml.Unmarshal(body, &doc); err != nil {
		return decimal.Decimal{}, errHwEurRateMissing
	}
	rateText := ""
	for _, currency := range doc.Currencies {
		if currency.Code == "EUR" {
			rateText = strings.TrimSpace(currency.ForexSelling)
			break
		}
	}
	if rateText == "" {
		return decimal.Decimal{}, errHwEurRateMissing
	}
	eurTry, err := decimal.NewFromString(rateText)
	if err != nil || !eurTry.IsPositive() || !usdTry.IsPositive() {
		return decimal.Decimal{}, errHwEurRateInvalid
	}
	eurPerUsd := usdTry.Div(eurTry).Round(6)
	if !eurPerUsd.IsPositive() {
		return decimal.Decimal{}, errHwEurRateInvalid
	}
	return eurPerUsd, nil
}

// hwTcmbFxDate picks the bulletin date. The Date attribute is MM/DD/YYYY and
// Tarih is DD.MM.YYYY; either is accepted so a regional format change does not
// break the fetch, and the result is normalized to YYYY-MM-DD.
func hwTcmbFxDate(dateAttr string, tarihAttr string) (string, error) {
	for _, candidate := range []struct {
		text   string
		layout string
	}{{dateAttr, "01/02/2006"}, {tarihAttr, "02.01.2006"}} {
		text := strings.TrimSpace(candidate.text)
		if text == "" {
			continue
		}
		parsed, err := time.Parse(candidate.layout, text)
		if err != nil {
			continue
		}
		return parsed.Format("2006-01-02"), nil
	}
	return "", errors.New("no parseable rate date in the rate document")
}

// hwFetchURL downloads one document with a size cap.
func hwFetchURL(ctx context.Context, client *http.Client, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("source returned status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, hwPriceMaxBodyBytes))
	if err != nil {
		return nil, err
	}
	if len(body) == 0 {
		return nil, errors.New("source returned an empty document")
	}
	return body, nil
}

// HwFetchPriceSnapshot reads both sources once and assembles one snapshot. Any
// failure is an error; the caller then keeps the previous snapshot and marks it
// stale. No value is ever filled in from memory.
func HwFetchPriceSnapshot(ctx context.Context, client *http.Client, priceListURL string, fxURL string, now time.Time) (*model.HwPriceSnapshot, error) {
	snapshot, _, err := hwFetchPriceSnapshotAndList(ctx, client, priceListURL, fxURL, now)
	return snapshot, err
}

// hwFetchPriceSnapshotAndList is HwFetchPriceSnapshot that also returns the
// parsed price list, so the daily refresh can look for new models in it.
func hwFetchPriceSnapshotAndList(ctx context.Context, client *http.Client, priceListURL string, fxURL string, now time.Time) (*model.HwPriceSnapshot, map[string]hwPriceListEntry, error) {
	if client == nil {
		client = &http.Client{Timeout: hwPriceFetchTimeout}
	}
	priceBody, err := hwFetchURL(ctx, client, priceListURL)
	if err != nil {
		return nil, nil, fmt.Errorf("price list fetch failed: %w", err)
	}
	fxBody, err := hwFetchURL(ctx, client, fxURL)
	if err != nil {
		return nil, nil, fmt.Errorf("rate fetch failed: %w", err)
	}
	list, err := hwParsePriceList(priceBody)
	if err != nil {
		return nil, nil, err
	}
	prices, err := hwExtractSoldModelPrices(list)
	if err != nil {
		return nil, nil, err
	}
	if len(prices) == 0 {
		return nil, nil, errors.New("price list contains none of the sold models")
	}
	rate, fxDate, err := hwParseTcmbFx(fxBody)
	if err != nil {
		return nil, nil, err
	}
	modelsJSON, err := common.Marshal(prices)
	if err != nil {
		return nil, nil, err
	}
	// The EUR cross rate is optional: when it cannot be read, TRY keeps working
	// and the EUR option stays as it was.
	eurPerUsd := ""
	if eur, eurErr := hwParseTcmbEurPerUsd(fxBody, rate); eurErr != nil {
		common.SysError(common.LogText("EUR rate not read from the bulletin (class %s)", hwEurRateErrorClass(eurErr)))
	} else {
		eurPerUsd = eur.String()
	}
	return &model.HwPriceSnapshot{
		EurPerUsd:      eurPerUsd,
		PriceSourceUrl: priceListURL,
		FxSourceUrl:    fxURL,
		FetchedAt:      now.Unix(),
		FxDate:         fxDate,
		TryPerUsd:      rate.String(),
		Models:         string(modelsJSON),
		ListedCount:    len(list),
	}, list, nil
}

// HwRefreshPriceSnapshot runs one fetch cycle: fetch, store, and publish the
// rate option. On a failed fetch the previous snapshot stays and is marked
// stale, so the site can show the old prices together with their date.
func HwRefreshPriceSnapshot(ctx context.Context, client *http.Client, now time.Time) error {
	snapshot, list, err := hwFetchPriceSnapshotAndList(ctx, client, HwPriceListURL(), HwFxURL(), now)
	if err != nil {
		if markErr := model.HwMarkPriceSnapshotsStale(now.Unix()); markErr != nil {
			common.SysError(common.LogText("failed to mark the price snapshot stale after a failed refresh (class %s)", hwPricingErrorClass(markErr)))
		}
		return err
	}
	if err := model.HwSavePriceSnapshot(snapshot); err != nil {
		return err
	}
	rate, err := decimal.NewFromString(snapshot.TryPerUsd)
	if err != nil {
		return err
	}
	// Billing follows the published list price: the ratios of the sold models
	// are rewritten from this snapshot before the rate is published.
	if err := HwApplySnapshotModelRatios(snapshot); err != nil {
		return err
	}
	if err := hwApplyTryRateOption(rate, snapshot.FxDate); err != nil {
		return err
	}
	// A failing EUR rate never fails the TRY refresh.
	if snapshot.EurPerUsd != "" {
		if eur, eurErr := decimal.NewFromString(snapshot.EurPerUsd); eurErr != nil {
			common.SysError(common.LogText("EUR rate not applied (class %s)", hwEurRateErrorClass(errHwEurRateInvalid)))
		} else if eurErr := hwApplyEurRateOption(eur, snapshot.FxDate); eurErr != nil {
			common.SysError(common.LogText("EUR rate not applied (class %s)", hwPricingErrorClass(eurErr)))
		}
	}
	// A failing new-model card never fails the price refresh.
	if err := hwReportNewModels(ctx, HwBureauCardConfigFromEnv(), list); err != nil {
		common.SysError(common.LogText("new-model card not filed (class %s); retried on the next refresh", hwPricingErrorClass(err)))
	}
	return nil
}

func hwEurRateErrorClass(err error) string {
	if errors.Is(err, errHwEurRateMissing) {
		return "missing"
	}
	return "invalid"
}

// hwPricingErrorClass maps an error to a short log class. Log lines carry the
// class and never the error text: a transport error can quote the URL with its
// query string.
func hwPricingErrorClass(err error) string {
	switch {
	case err == nil:
		return "nil"
	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, context.Canceled):
		return "timeout"
	default:
		return "fetch"
	}
}

// hwApplyTryRateOption publishes the daily rate through HwTryPerUsd, but only
// when it is valid (checked by the parser) and newer than the published one.
// The validity date travels in HwTryPerUsdDate; an equal or older date leaves
// both options untouched.
func hwApplyTryRateOption(rate decimal.Decimal, fxDate string) error {
	if !rate.IsPositive() {
		return ErrHwInvalidRate
	}
	if !hwRateDateNotInFuture(fxDate, time.Now()) {
		return ErrHwInvalidRate
	}
	publishedDate := strings.TrimSpace(hwOptionValue(HwOptionTryPerUsdDate))
	if publishedDate != "" && publishedDate >= fxDate {
		return nil
	}
	if err := model.UpdateOption(HwOptionTryPerUsd, rate.String()); err != nil {
		return err
	}
	if err := hwSyncDisplayCurrencyRate(rate); err != nil {
		return err
	}
	return model.UpdateOption(HwOptionTryPerUsdDate, fxDate)
}

// hwRateDateNotInFuture refuses a validity date that cannot be read or that
// lies after today (UTC): such a rate would stay "newer" than every real one.
func hwRateDateNotInFuture(fxDate string, now time.Time) bool {
	published, err := time.Parse("2006-01-02", strings.TrimSpace(fxDate))
	return err == nil && !published.After(now.UTC().Truncate(24*time.Hour))
}

// hwApplyEurRateOption publishes the EUR per USD cross rate with the same guard
// and date rule as the TRY rate: valid and strictly newer than the published
// date, otherwise both options stay untouched. It also keeps the base rate the
// EUR top-up presets were made with, replacing it only when the new rate
// deviates more than hwPresetHysteresis from it, so presets do not jump daily.
func hwApplyEurRateOption(rate decimal.Decimal, fxDate string) error {
	if !rate.IsPositive() {
		return ErrHwInvalidRate
	}
	if !hwRateDateNotInFuture(fxDate, time.Now()) {
		return ErrHwInvalidRate
	}
	publishedDate := strings.TrimSpace(hwOptionValue(model.HwEurPerUsdDateOption))
	if publishedDate != "" && publishedDate >= fxDate {
		return nil
	}
	if err := model.UpdateOption(model.HwEurPerUsdOption, rate.String()); err != nil {
		return err
	}
	base, err := decimal.NewFromString(strings.TrimSpace(hwOptionValue(model.HwEurPresetBaseOption)))
	if err != nil || !base.IsPositive() || rate.Sub(base).Abs().Div(base).GreaterThan(hwPresetHysteresis) {
		if err := model.UpdateOption(model.HwEurPresetBaseOption, rate.String()); err != nil {
			return err
		}
	}
	return model.UpdateOption(model.HwEurPerUsdDateOption, fxDate)
}

// HwTryCurrencySymbol is the symbol of the TL amounts the customer sees.
const HwTryCurrencySymbol = "₺"

// hwSyncDisplayCurrencyRate keeps the TL display of the console on the day's
// rate. Only a console that already shows our currency is updated; a display
// the operator configured with another symbol (or another type) is never
// touched.
func hwSyncDisplayCurrencyRate(rate decimal.Decimal) error {
	general := operation_setting.GetGeneralSetting()
	if general.QuotaDisplayType != operation_setting.QuotaDisplayTypeCustom {
		return nil
	}
	if strings.TrimSpace(general.CustomCurrencySymbol) != HwTryCurrencySymbol {
		return nil
	}
	return model.UpdateOption(hwDisplayRateOption, rate.String())
}

// hwKdvFactor is the VAT factor 1.2 (20 % KDV): every TRY price the customer
// sees already includes it.
var hwKdvFactor = decimal.NewFromInt(6).Div(decimal.NewFromInt(5))

// HwTryPrice converts a dollar amount into the TRY amount the customer sees.
//
// Formula (fixed by the project decision on pricing): TRY = USD x (TRY per
// USD) x 1.2. The factor 1.2 adds the 20 % KDV, and the rate and every price
// shown to the customer are inclusive of it. The result is rounded to whole
// kuruş (two decimals, half away from zero) with decimal arithmetic only;
// there is no float anywhere in the chain.
func HwTryPrice(usdValue decimal.Decimal, tryPerUsd decimal.Decimal) (decimal.Decimal, error) {
	if !tryPerUsd.IsPositive() {
		return decimal.Decimal{}, ErrHwInvalidRate
	}
	if usdValue.IsNegative() {
		return decimal.Decimal{}, ErrHwNegativeUsdValue
	}
	return usdValue.Mul(tryPerUsd).Mul(hwKdvFactor).Round(2), nil
}

var hwPriceSnapshotOnce sync.Once

// StartHwPriceSnapshotJob starts the daily price snapshot job: one fetch at
// start and then every 24 hours, only on the master node, once per process.
// Each cycle is panic-guarded; a failed cycle keeps the old snapshot and marks
// it stale.
func StartHwPriceSnapshotJob() {
	hwPriceSnapshotOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		go func() {
			common.SysLog(common.LogText("price snapshot job started: interval=%s", hwPriceSnapshotInterval))
			runHwPriceSnapshotOnceSafely()
			ticker := time.NewTicker(hwPriceSnapshotInterval)
			defer ticker.Stop()
			for range ticker.C {
				runHwPriceSnapshotOnceSafely()
			}
		}()
	})
}

func runHwPriceSnapshotOnceSafely() {
	defer func() {
		if r := recover(); r != nil {
			common.SysError(common.LogText("price snapshot job panicked: %v", r))
		}
	}()
	if err := HwRefreshPriceSnapshot(context.Background(), nil, time.Now()); err != nil {
		common.SysError(common.LogText("price snapshot refresh failed (class %s); the previous snapshot stays and is marked stale", hwPricingErrorClass(err)))
		return
	}
	common.SysLog(common.LogText("price snapshot refreshed"))
}

// HwComparePriceInput is the validated query of the price comparator.
type HwComparePriceInput struct {
	Model        string
	InputTokens  int64
	OutputTokens int64
}

// HwPriceComparison is the price comparison of one monthly usage volume. All
// amounts are decimal values; TRY amounts include the 20 % KDV.
type HwPriceComparison struct {
	Model        string
	InputTokens  int64
	OutputTokens int64
	OfficialUsd  decimal.Decimal
	OfficialTry  decimal.Decimal
	// FirstPurchaseTry is the payable amount for a first purchase at our price
	// (HwListPriceDiscountPercent below the list price, plus the first-purchase
	// discount on the first 1000 TRY of value), RepeatPurchaseTry for every
	// later one, both from the purchase pricing of the credit ledger.
	FirstPurchaseTry  decimal.Decimal
	RepeatPurchaseTry decimal.Decimal
	SavingsFirstTry   decimal.Decimal
	SavingsRepeatTry  decimal.Decimal
	TryPerUsd         decimal.Decimal
}

var (
	// ErrHwModelNotSold rejects a model name outside our catalog.
	ErrHwModelNotSold = errors.New("model is not sold here")
	// ErrHwNoPriceData reports a sold model without usable price data.
	ErrHwNoPriceData = errors.New("no current price data for this model")
)

// HwComparePrice prices one monthly token volume against the newest snapshot.
// The USD cost is exact integer arithmetic: (input tokens x input price +
// output tokens x output price) in micro-dollars, where the prices are
// micro-dollars per million tokens, scaled by 10^-12 with a decimal exponent —
// no division, no rounding, no float.
func HwComparePrice(snapshot *model.HwPriceSnapshot, input HwComparePriceInput) (*HwPriceComparison, error) {
	sold, ok := hwFindSoldModel(input.Model)
	if !ok {
		return nil, ErrHwModelNotSold
	}
	// Defense in depth: the controller rejects these with a 400 first, the
	// service never multiplies an unbounded number into a price.
	if input.InputTokens < 0 || input.OutputTokens < 0 ||
		input.InputTokens > HwMaxTokensPerMonth || input.OutputTokens > HwMaxTokensPerMonth {
		return nil, fmt.Errorf("token counts must be between 0 and %d", HwMaxTokensPerMonth)
	}
	if snapshot == nil {
		return nil, ErrHwNoPriceData
	}
	prices, err := snapshot.HwSnapshotModelPrices()
	if err != nil {
		return nil, err
	}
	price, ok := prices[sold.Name]
	if !ok || price.InputMicroUsd <= 0 || price.OutputMicroUsd <= 0 {
		return nil, ErrHwNoPriceData
	}
	rate, err := decimal.NewFromString(snapshot.TryPerUsd)
	if err != nil || !rate.IsPositive() {
		return nil, ErrHwInvalidRate
	}
	microTotal := input.InputTokens*price.InputMicroUsd + input.OutputTokens*price.OutputMicroUsd
	officialUsd := decimal.New(microTotal, -12)
	officialTry, err := HwTryPrice(officialUsd, rate)
	if err != nil {
		return nil, err
	}
	ourTry, err := HwTryPrice(HwOurUsd(officialUsd), rate)
	if err != nil {
		return nil, err
	}
	firstQuote, err := model.HwComputePurchase(ourTry, true, model.HwFirstPurchaseDiscountCapTRY)
	if err != nil {
		return nil, err
	}
	repeatQuote, err := model.HwComputePurchase(ourTry, false, model.HwFirstPurchaseDiscountCapTRY)
	if err != nil {
		return nil, err
	}
	return &HwPriceComparison{
		Model:             sold.Name,
		InputTokens:       input.InputTokens,
		OutputTokens:      input.OutputTokens,
		OfficialUsd:       officialUsd,
		OfficialTry:       officialTry,
		FirstPurchaseTry:  firstQuote.Payable,
		RepeatPurchaseTry: repeatQuote.Payable,
		SavingsFirstTry:   officialTry.Sub(firstQuote.Payable),
		SavingsRepeatTry:  officialTry.Sub(repeatQuote.Payable),
		TryPerUsd:         rate,
	}, nil
}
