package ratio_setting

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

const SeedancePriceOptionKey = "seedance_price_setting.prices"

// SeedanceModelPrice stores official-style list prices in RMB per million tokens.
// Text is the no-video-input bucket; Video is used when the request includes video.
type SeedanceModelPrice struct {
	Text  map[string]float64 `json:"text"`
	Video map[string]float64 `json:"video"`
}

type SeedancePriceSetting struct {
	Prices map[string]SeedanceModelPrice `json:"prices"`
}

var defaultSeedancePrices = map[string]SeedanceModelPrice{
	"doubao-seedance-2-0-260128": {
		Text:  map[string]float64{"480p": 46, "720p": 46, "1080p": 51, "4k": 26},
		Video: map[string]float64{"480p": 28, "720p": 28, "1080p": 31, "4k": 16},
	},
	"doubao-seedance-2-0-fast-260128": {
		Text:  map[string]float64{"480p": 37, "720p": 37},
		Video: map[string]float64{"480p": 22, "720p": 22},
	},
	"doubao-seedance-2-5-260628": {
		Text:  map[string]float64{"480p": 70, "720p": 70},
		Video: map[string]float64{"480p": 42, "720p": 42},
	},
}

var seedancePriceSetting = SeedancePriceSetting{
	Prices: cloneSeedancePrices(defaultSeedancePrices),
}

var seedancePriceIndex atomic.Value

func init() {
	config.GlobalConfig.Register("seedance_price_setting", &seedancePriceSetting)
	RebuildSeedancePriceIndex()
}

func cloneSeedancePrices(src map[string]SeedanceModelPrice) map[string]SeedanceModelPrice {
	dst := make(map[string]SeedanceModelPrice, len(src))
	for modelName, price := range src {
		dst[modelName] = SeedanceModelPrice{
			Text:  cloneFloatMap(price.Text),
			Video: cloneFloatMap(price.Video),
		}
	}
	return dst
}

func cloneFloatMap(src map[string]float64) map[string]float64 {
	if len(src) == 0 {
		return map[string]float64{}
	}
	dst := make(map[string]float64, len(src))
	for key, value := range src {
		dst[key] = value
	}
	return dst
}

func DefaultSeedancePrices() map[string]SeedanceModelPrice {
	return cloneSeedancePrices(defaultSeedancePrices)
}

func DefaultSeedancePricesJSON() string {
	bytes, err := common.Marshal(defaultSeedancePrices)
	if err != nil {
		common.SysError("error marshalling default seedance prices: " + err.Error())
		return "{}"
	}
	return string(bytes)
}

func ValidateSeedancePricesJSON(value string) error {
	_, err := decodeSeedancePricesJSON(value)
	return err
}

func LoadSeedancePricesFromJSONString(value string) {
	prices, err := decodeSeedancePricesJSON(value)
	if err != nil {
		common.SysError("加载 Seedance 价格失败，将使用默认价格表: " + err.Error())
		prices = cloneSeedancePrices(defaultSeedancePrices)
	}
	if len(prices) == 0 {
		prices = cloneSeedancePrices(defaultSeedancePrices)
	}
	seedancePriceSetting.Prices = prices
	RebuildSeedancePriceIndex()
}

func RebuildSeedancePriceIndex() {
	prices := seedancePriceSetting.Prices
	if len(prices) == 0 {
		prices = defaultSeedancePrices
	}
	seedancePriceIndex.Store(cloneSeedancePrices(prices))
}

func currentSeedancePrices() map[string]SeedanceModelPrice {
	value := seedancePriceIndex.Load()
	if value == nil {
		RebuildSeedancePriceIndex()
		value = seedancePriceIndex.Load()
	}
	prices, _ := value.(map[string]SeedanceModelPrice)
	if len(prices) == 0 {
		return defaultSeedancePrices
	}
	return prices
}

func decodeSeedancePricesJSON(value string) (map[string]SeedanceModelPrice, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || trimmed == "null" {
		return map[string]SeedanceModelPrice{}, nil
	}
	var prices map[string]SeedanceModelPrice
	if err := json.Unmarshal([]byte(trimmed), &prices); err != nil {
		return nil, fmt.Errorf("seedance prices must be a JSON object: %w", err)
	}
	if prices == nil {
		return map[string]SeedanceModelPrice{}, nil
	}
	normalized := make(map[string]SeedanceModelPrice, len(prices))
	for modelName, price := range prices {
		name := strings.TrimSpace(modelName)
		if name == "" {
			return nil, fmt.Errorf("seedance model name cannot be empty")
		}
		text, err := normalizeSeedancePriceMap(price.Text)
		if err != nil {
			return nil, fmt.Errorf("model %s text prices: %w", name, err)
		}
		video, err := normalizeSeedancePriceMap(price.Video)
		if err != nil {
			return nil, fmt.Errorf("model %s video prices: %w", name, err)
		}
		normalized[name] = SeedanceModelPrice{Text: text, Video: video}
	}
	return normalized, nil
}

func normalizeSeedancePriceMap(src map[string]float64) (map[string]float64, error) {
	dst := make(map[string]float64, len(src))
	for key, value := range src {
		resolution := normalizeSeedanceResolution(key)
		if !isFiniteNonNegative(value) {
			return nil, fmt.Errorf("invalid price for %s", resolution)
		}
		dst[resolution] = value
	}
	return dst, nil
}

func isFiniteNonNegative(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0) && value >= 0
}

func normalizeSeedanceResolution(resolution string) string {
	res := strings.ToLower(strings.TrimSpace(resolution))
	switch res {
	case "4k", "2160p":
		return "4k"
	case "1080p":
		return "1080p"
	case "720p":
		return "720p"
	case "480p":
		return "480p"
	default:
		return "720p"
	}
}

func lookupSeedanceCell(prices SeedanceModelPrice, resolution string, hasVideo bool) (float64, bool) {
	bucket := prices.Text
	if hasVideo {
		bucket = prices.Video
	}
	if value, ok := bucket[resolution]; ok && value > 0 {
		return value, true
	}
	if resolution == "480p" || resolution == "720p" {
		other := "480p"
		if resolution == "480p" {
			other = "720p"
		}
		if value, ok := bucket[other]; ok && value > 0 {
			return value, true
		}
	}
	return 0, false
}

func seedanceBaselinePrice(prices SeedanceModelPrice) float64 {
	if value := prices.Text["720p"]; value > 0 {
		return value
	}
	return prices.Text["480p"]
}

// GetVideoBillingRatio returns the relative surcharge for a Seedance 2.x model.
// ok is false when the model is not in the price table.
func GetVideoBillingRatio(modelName, resolution string, hasVideo bool) (float64, bool) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return 0, false
	}
	prices, ok := currentSeedancePrices()[modelName]
	if !ok {
		return 0, false
	}
	base := seedanceBaselinePrice(prices)
	if base <= 0 {
		return 0, false
	}
	actual, found := lookupSeedanceCell(prices, normalizeSeedanceResolution(resolution), hasVideo)
	if !found {
		return 1.0, true
	}
	return actual / base, true
}

// LookupSeedanceBillingRatio tries model names in order and returns the first table hit.
func LookupSeedanceBillingRatio(resolution string, hasVideo bool, modelNames ...string) (float64, bool) {
	seen := make(map[string]struct{}, len(modelNames))
	for _, name := range modelNames {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if _, exists := seen[name]; exists {
			continue
		}
		seen[name] = struct{}{}
		if ratio, ok := GetVideoBillingRatio(name, resolution, hasVideo); ok {
			return ratio, true
		}
	}
	return 0, false
}
