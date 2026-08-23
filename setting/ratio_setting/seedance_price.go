package ratio_setting

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/types"
)

const (
	SeedancePriceOptionKey           = "seedance_price_setting.prices"
	SeedanceSuperResolutionOptionKey = "seedance_price_setting.super_resolution"

	// SeedanceDefaultDurationSeconds is the pre-consume fallback when duration
	// is omitted or adaptive (duration=-1).
	SeedanceDefaultDurationSeconds = 5
	SeedanceFrameRate              = 24
	seedanceSellingMarkup          = 1.5
)

// SeedanceModelPrice stores selling prices in RMB per million tokens.
// Text is the no-video-input bucket; Video is used when the request includes video.
type SeedanceModelPrice struct {
	Text  map[string]float64 `json:"text"`
	Video map[string]float64 `json:"video"`
}

// SeedanceSuperResolutionPrice stores MediaKit enhance-video list prices in RMB per second.
type SeedanceSuperResolutionPrice struct {
	From480To720  float64 `json:"480_to_720"`
	From720To1080 float64 `json:"720_to_1080"`
}

type SeedancePriceSetting struct {
	Prices          map[string]SeedanceModelPrice `json:"prices"`
	SuperResolution SeedanceSuperResolutionPrice  `json:"super_resolution"`
}

type seedanceRuntime struct {
	Prices          map[string]SeedanceModelPrice
	SuperResolution SeedanceSuperResolutionPrice
}

// officialSeedancePrices is the Volcengine Ark list price in RMB / million tokens.
var officialSeedancePrices = map[string]SeedanceModelPrice{
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

// Default MediaKit AIGC enhance-video list prices (RMB / output second).
// 720p output is billed as 480→720; 1080p output is billed as 720→1080.
var officialSeedanceSuperResolution = SeedanceSuperResolutionPrice{
	From480To720:  0.02,
	From720To1080: 0.04,
}

var defaultSeedancePrices = scaleSeedancePrices(officialSeedancePrices, seedanceSellingMarkup)

var seedancePriceSetting = SeedancePriceSetting{
	Prices:          cloneSeedancePrices(defaultSeedancePrices),
	SuperResolution: officialSeedanceSuperResolution,
}

var seedanceRuntimeIndex atomic.Value

// 16:9 pixel sizes used to estimate tokens/second. Actual settlement uses
// upstream usage tokens; this table is for pre-consume and price display.
var seedanceFrameSize = map[string][2]int{
	"480p":  {864, 480},
	"720p":  {1280, 720},
	"1080p": {1920, 1080},
	"4k":    {3840, 2160},
}

func init() {
	config.GlobalConfig.Register("seedance_price_setting", &seedancePriceSetting)
	RebuildSeedancePriceIndex()
}

func scaleSeedancePrices(src map[string]SeedanceModelPrice, scale float64) map[string]SeedanceModelPrice {
	dst := make(map[string]SeedanceModelPrice, len(src))
	for modelName, price := range src {
		dst[modelName] = SeedanceModelPrice{
			Text:  scaleFloatMap(price.Text, scale),
			Video: scaleFloatMap(price.Video, scale),
		}
	}
	return dst
}

func scaleFloatMap(src map[string]float64, scale float64) map[string]float64 {
	dst := make(map[string]float64, len(src))
	for key, value := range src {
		dst[key] = value * scale
	}
	return dst
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

func DefaultSeedanceSuperResolution() SeedanceSuperResolutionPrice {
	return officialSeedanceSuperResolution
}

func DefaultSeedanceSuperResolutionJSON() string {
	bytes, err := common.Marshal(officialSeedanceSuperResolution)
	if err != nil {
		common.SysError("error marshalling default seedance super-resolution prices: " + err.Error())
		return "{}"
	}
	return string(bytes)
}

func ValidateSeedancePricesJSON(value string) error {
	_, err := decodeSeedancePricesJSON(value)
	return err
}

func ValidateSeedanceSuperResolutionJSON(value string) error {
	_, err := decodeSeedanceSuperResolutionJSON(value)
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

func LoadSeedanceSuperResolutionFromJSONString(value string) {
	price, err := decodeSeedanceSuperResolutionJSON(value)
	if err != nil {
		common.SysError("加载 Seedance 超分价格失败，将使用默认价格: " + err.Error())
		price = officialSeedanceSuperResolution
	}
	seedancePriceSetting.SuperResolution = price
	RebuildSeedancePriceIndex()
}

func RebuildSeedancePriceIndex() {
	prices := seedancePriceSetting.Prices
	if len(prices) == 0 {
		prices = defaultSeedancePrices
	}
	sr := seedancePriceSetting.SuperResolution
	if sr.From480To720 <= 0 && sr.From720To1080 <= 0 {
		sr = officialSeedanceSuperResolution
	}
	seedanceRuntimeIndex.Store(seedanceRuntime{
		Prices:          cloneSeedancePrices(prices),
		SuperResolution: sr,
	})
	InvalidateExposedDataCache()
}

func currentSeedanceRuntime() seedanceRuntime {
	value := seedanceRuntimeIndex.Load()
	if value == nil {
		RebuildSeedancePriceIndex()
		value = seedanceRuntimeIndex.Load()
	}
	runtime, _ := value.(seedanceRuntime)
	if len(runtime.Prices) == 0 {
		runtime.Prices = defaultSeedancePrices
	}
	if runtime.SuperResolution.From480To720 <= 0 && runtime.SuperResolution.From720To1080 <= 0 {
		runtime.SuperResolution = officialSeedanceSuperResolution
	}
	return runtime
}

func currentSeedancePrices() map[string]SeedanceModelPrice {
	return currentSeedanceRuntime().Prices
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

func decodeSeedanceSuperResolutionJSON(value string) (SeedanceSuperResolutionPrice, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || trimmed == "null" {
		return officialSeedanceSuperResolution, nil
	}
	var price SeedanceSuperResolutionPrice
	if err := json.Unmarshal([]byte(trimmed), &price); err != nil {
		return SeedanceSuperResolutionPrice{}, fmt.Errorf("seedance super-resolution prices must be a JSON object: %w", err)
	}
	if !isFiniteNonNegative(price.From480To720) {
		return SeedanceSuperResolutionPrice{}, fmt.Errorf("invalid 480_to_720 price")
	}
	if !isFiniteNonNegative(price.From720To1080) {
		return SeedanceSuperResolutionPrice{}, fmt.Errorf("invalid 720_to_1080 price")
	}
	if price.From480To720 == 0 && price.From720To1080 == 0 {
		return officialSeedanceSuperResolution, nil
	}
	return price, nil
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
	if value := seedanceBaselinePrice(SeedanceModelPrice{Text: bucket}); value > 0 {
		return value, true
	}
	return 0, false
}

func seedanceBaselinePrice(prices SeedanceModelPrice) float64 {
	if value := prices.Text["720p"]; value > 0 {
		return value
	}
	if value := prices.Text["480p"]; value > 0 {
		return value
	}
	for _, value := range prices.Text {
		if value > 0 {
			return value
		}
	}
	return 0
}

func ResolveSeedanceModel(modelNames ...string) (SeedanceModelPrice, string, bool) {
	prices := currentSeedancePrices()
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
		if price, ok := prices[name]; ok {
			return price, name, true
		}
	}

	bestKey := ""
	var bestPrice SeedanceModelPrice
	for _, name := range modelNames {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		for key, price := range prices {
			if name == key || strings.HasPrefix(name, key+"-") || strings.HasPrefix(name, key+"_") {
				if len(key) > len(bestKey) {
					bestKey = key
					bestPrice = price
				}
			}
		}
	}
	if bestKey == "" {
		return SeedanceModelPrice{}, "", false
	}
	return bestPrice, bestKey, true
}

func HasSeedancePrice(modelNames ...string) bool {
	_, _, ok := ResolveSeedanceModel(modelNames...)
	return ok
}

func GetSeedanceUnitPriceRMB(modelName, resolution string, hasVideo bool) (float64, bool) {
	prices, _, ok := ResolveSeedanceModel(modelName)
	if !ok {
		return 0, false
	}
	return lookupSeedanceCell(prices, normalizeSeedanceResolution(resolution), hasVideo)
}

func LookupSeedanceUnitPriceRMB(resolution string, hasVideo bool, modelNames ...string) (float64, string, bool) {
	prices, matched, ok := ResolveSeedanceModel(modelNames...)
	if !ok {
		return 0, "", false
	}
	unit, found := lookupSeedanceCell(prices, normalizeSeedanceResolution(resolution), hasVideo)
	if !found {
		return 0, matched, false
	}
	return unit, matched, true
}

func SeedanceTokensPerSecond(resolution string) float64 {
	size, ok := seedanceFrameSize[normalizeSeedanceResolution(resolution)]
	if !ok {
		size = seedanceFrameSize["720p"]
	}
	return float64(size[0]*size[1]*SeedanceFrameRate) / 1024.0
}

func SeedancePerSecondRMB(unitPriceRMB float64, resolution string) float64 {
	if unitPriceRMB <= 0 {
		return 0
	}
	return SeedanceTokensPerSecond(resolution) / 1_000_000 * unitPriceRMB
}

func RMBToUSD(rmb float64) float64 {
	return rmb / USD2RMB
}

func SeedanceModelRatio(unitPriceRMB float64) float64 {
	return rmbPerMillion(unitPriceRMB)
}

func SeedanceSourceResolution(outputResolution string) string {
	switch normalizeSeedanceResolution(outputResolution) {
	case "1080p":
		return "720p"
	case "720p":
		return "480p"
	default:
		return ""
	}
}

func SeedanceSuperResolutionPriceRMB(outputResolution string) (float64, bool) {
	sr := currentSeedanceRuntime().SuperResolution
	switch normalizeSeedanceResolution(outputResolution) {
	case "720p":
		if sr.From480To720 > 0 {
			return sr.From480To720, true
		}
	case "1080p":
		if sr.From720To1080 > 0 {
			return sr.From720To1080, true
		}
	}
	return 0, false
}

func CurrentSeedanceSuperResolution() SeedanceSuperResolutionPrice {
	return currentSeedanceRuntime().SuperResolution
}

func QuotaFromRMB(rmb, groupRatio float64) (int, *common.QuotaClamp) {
	return common.QuotaFromFloatChecked(rmb / USD2RMB * common.QuotaPerUnit * groupRatio)
}

type SeedanceQuoteInput struct {
	ModelNames        []string
	BillingResolution string
	OutputResolution  string
	HasVideo          bool
	DurationSeconds   float64
	SuperResolution   bool
	GroupRatio        float64
}

func normalizeQuoteDuration(duration float64) float64 {
	if duration <= 0 {
		return SeedanceDefaultDurationSeconds
	}
	return duration
}

func BuildSeedanceSnapshot(in SeedanceQuoteInput) (types.SeedanceBillingSnapshot, bool) {
	billingResolution := normalizeSeedanceResolution(in.BillingResolution)
	outputResolution := strings.TrimSpace(in.OutputResolution)
	if outputResolution == "" {
		outputResolution = billingResolution
	} else {
		outputResolution = normalizeSeedanceResolution(outputResolution)
	}
	if in.SuperResolution {
		if source := SeedanceSourceResolution(outputResolution); source != "" {
			billingResolution = source
		}
	}

	unitPrice, matched, ok := LookupSeedanceUnitPriceRMB(billingResolution, in.HasVideo, in.ModelNames...)
	if !ok {
		return types.SeedanceBillingSnapshot{}, false
	}

	snap := types.SeedanceBillingSnapshot{
		UnitPriceRMB:      unitPrice,
		BillingResolution: billingResolution,
		OutputResolution:  outputResolution,
		HasVideo:          in.HasVideo,
		SuperResolution:   in.SuperResolution,
		DurationSeconds:   normalizeQuoteDuration(in.DurationSeconds),
		TokensPerSecond:   SeedanceTokensPerSecond(billingResolution),
		MatchedModel:      matched,
	}
	if in.SuperResolution {
		if srPrice, found := SeedanceSuperResolutionPriceRMB(outputResolution); found {
			snap.SuperResolutionRMB = srPrice
		}
	}
	return snap, true
}

func SeedanceCostRMB(snap types.SeedanceBillingSnapshot, tokens int, durationSeconds float64) float64 {
	duration := durationSeconds
	if duration <= 0 {
		if tokens > 0 && snap.TokensPerSecond > 0 {
			duration = float64(tokens) / snap.TokensPerSecond
		} else {
			duration = normalizeQuoteDuration(snap.DurationSeconds)
		}
	}
	tokenCount := float64(tokens)
	if tokenCount <= 0 {
		tokenCount = duration * snap.TokensPerSecond
	}
	cost := tokenCount / 1_000_000 * snap.UnitPriceRMB
	if snap.SuperResolution && snap.SuperResolutionRMB > 0 {
		cost += duration * snap.SuperResolutionRMB
	}
	return cost
}

func EstimateSeedanceQuota(in SeedanceQuoteInput) (int, types.SeedanceBillingSnapshot, *common.QuotaClamp, bool) {
	snap, ok := BuildSeedanceSnapshot(in)
	if !ok {
		return 0, types.SeedanceBillingSnapshot{}, nil, false
	}
	quota, clamp := QuotaFromRMB(SeedanceCostRMB(snap, 0, snap.DurationSeconds), in.GroupRatio)
	return quota, snap, clamp, true
}

func SettleSeedanceQuota(snap types.SeedanceBillingSnapshot, tokens int, durationSeconds, groupRatio float64) (int, *common.QuotaClamp) {
	return QuotaFromRMB(SeedanceCostRMB(snap, tokens, durationSeconds), groupRatio)
}

func BuildSeedancePublicPricing(modelNames []string, superResolution bool) (*types.SeedancePublicPricing, bool) {
	prices, _, ok := ResolveSeedanceModel(modelNames...)
	if !ok {
		return nil, false
	}

	textUSD := make(map[string]float64)
	videoUSD := make(map[string]float64)
	tokensPerSecond := map[string]float64{
		"480p":  SeedanceTokensPerSecond("480p"),
		"720p":  SeedanceTokensPerSecond("720p"),
		"1080p": SeedanceTokensPerSecond("1080p"),
		"4k":    SeedanceTokensPerSecond("4k"),
	}
	for _, resolution := range []string{"480p", "720p", "1080p", "4k"} {
		if unit, found := lookupSeedanceCell(prices, resolution, false); found {
			textUSD[resolution] = RMBToUSD(SeedancePerSecondRMB(unit, resolution))
		}
		if unit, found := lookupSeedanceCell(prices, resolution, true); found {
			videoUSD[resolution] = RMBToUSD(SeedancePerSecondRMB(unit, resolution))
		}
	}

	public := &types.SeedancePublicPricing{
		SuperResolution:   superResolution,
		TokensPerSecond:   tokensPerSecond,
		TextUnitPriceRMB:  cloneFloatMap(prices.Text),
		VideoUnitPriceRMB: cloneFloatMap(prices.Video),
		TextPerSecondUSD:  textUSD,
		VideoPerSecondUSD: videoUSD,
	}
	if !superResolution {
		return public, true
	}

	sr := CurrentSeedanceSuperResolution()
	public.SRFrom480To720RMB = sr.From480To720
	public.SRFrom720To1080RMB = sr.From720To1080
	public.SRFrom480To720USD = RMBToUSD(sr.From480To720)
	public.SRFrom720To1080USD = RMBToUSD(sr.From720To1080)
	public.OutputTextPerSecondUSD = seedanceOutputPerSecondUSD(prices, false, sr)
	public.OutputVideoPerSecondUSD = seedanceOutputPerSecondUSD(prices, true, sr)
	return public, true
}

func seedanceOutputPerSecondUSD(prices SeedanceModelPrice, hasVideo bool, sr SeedanceSuperResolutionPrice) map[string]float64 {
	out := make(map[string]float64, 2)
	if unit, found := lookupSeedanceCell(prices, "480p", hasVideo); found && sr.From480To720 > 0 {
		out["720p"] = RMBToUSD(SeedancePerSecondRMB(unit, "480p") + sr.From480To720)
	}
	if unit, found := lookupSeedanceCell(prices, "720p", hasVideo); found && sr.From720To1080 > 0 {
		out["1080p"] = RMBToUSD(SeedancePerSecondRMB(unit, "720p") + sr.From720To1080)
	}
	return out
}

// GetVideoBillingRatio is kept for older callers. It now returns 1 when the
// model is priced in the Seedance table; actual selling prices are absolute.
func GetVideoBillingRatio(modelName, resolution string, hasVideo bool) (float64, bool) {
	_, ok := GetSeedanceUnitPriceRMB(modelName, resolution, hasVideo)
	if !ok {
		return 0, false
	}
	return 1, true
}

func LookupSeedanceBillingRatio(resolution string, hasVideo bool, modelNames ...string) (float64, bool) {
	_, _, ok := LookupSeedanceUnitPriceRMB(resolution, hasVideo, modelNames...)
	if !ok {
		return 0, false
	}
	return 1, true
}
