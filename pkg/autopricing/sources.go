package autopricing

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	DefaultMirrorURL     = "https://raw.githubusercontent.com/Wei-Shaw/model-price-repo/main/model_prices_and_context_window.json"
	DefaultMirrorHashURL = "https://raw.githubusercontent.com/Wei-Shaw/model-price-repo/main/model_prices_and_context_window.sha256"
	DefaultModelsDevURL  = "https://models.dev/api.json"
	DefaultLiteLLMURL    = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"
	DefaultNewAPIURL     = "https://basellm.github.io/llm-metadata/api/newapi/ratio_config-v1-base.json"
)

type liteLLMRichEntry struct {
	Input                *float64 `json:"input_cost_per_token"`
	Output               *float64 `json:"output_cost_per_token"`
	CacheRead            *float64 `json:"cache_read_input_token_cost"`
	CacheWrite5m         *float64 `json:"cache_creation_input_token_cost"`
	CacheWrite1h         *float64 `json:"cache_creation_input_token_cost_above_1hr"`
	PriorityInput        *float64 `json:"input_cost_per_token_priority"`
	PriorityOutput       *float64 `json:"output_cost_per_token_priority"`
	PriorityCacheRead    *float64 `json:"cache_read_input_token_cost_priority"`
	PriorityCacheWrite   *float64 `json:"cache_creation_input_token_cost_priority"`
	FlexInput            *float64 `json:"input_cost_per_token_flex"`
	FlexOutput           *float64 `json:"output_cost_per_token_flex"`
	FlexCacheRead        *float64 `json:"cache_read_input_token_cost_flex"`
	FlexCacheWrite       *float64 `json:"cache_creation_input_token_cost_flex"`
	ImageInput           *float64 `json:"input_cost_per_image_token"`
	ImageOutput          *float64 `json:"output_cost_per_image_token"`
	AudioInput           *float64 `json:"input_cost_per_audio_token"`
	AudioOutput          *float64 `json:"output_cost_per_audio_token"`
	PriorityAudioInput   *float64 `json:"input_cost_per_audio_token_priority"`
	PriorityAudioOutput  *float64 `json:"output_cost_per_audio_token_priority"`
	FlexAudioInput       *float64 `json:"input_cost_per_audio_token_flex"`
	FlexAudioOutput      *float64 `json:"output_cost_per_audio_token_flex"`
	PerImage             *float64 `json:"output_cost_per_image"`
	LongContextThreshold *int     `json:"long_context_input_token_threshold"`
	Above200KInput       *float64 `json:"input_cost_per_token_above_200k_tokens"`
	Above200KOutput      *float64 `json:"output_cost_per_token_above_200k_tokens"`
	Above200KCacheRead   *float64 `json:"cache_read_input_token_cost_above_200k_tokens"`
	Above200KCacheWrite  *float64 `json:"cache_creation_input_token_cost_above_200k_tokens"`
}

func ParseLiteLLMSource(data []byte, version string) (*SourceCatalog, error) {
	return parseLiteLLMWithSource(data, version, SourceLiteLLM)
}

func ParseMirrorSource(data []byte, version string) (*SourceCatalog, error) {
	return parseLiteLLMWithSource(data, version, SourceMirror)
}

func parseLiteLLMWithSource(data []byte, version string, sourceID SourceID) (*SourceCatalog, error) {
	var raw map[string]liteLLMRichEntry
	if err := common.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("parse %s source: %w", sourceID, err)
	}
	if len(raw) == 0 {
		return nil, fmt.Errorf("%s pricing source is empty", sourceID)
	}
	source := newSourceCatalog(sourceID, version)
	toMillion := func(value *float64) *float64 {
		if value == nil || !validCost(*value) {
			return nil
		}
		return pricePtr(*value * 1_000_000)
	}
	for name, item := range raw {
		if name == "" || name == "sample_spec" {
			continue
		}
		record := PriceRecord{
			Model: normalizeKey(name), PrimarySource: sourceID, SourceVersion: version,
			Standard: CostSet{Input: toMillion(item.Input), Output: toMillion(item.Output), CacheRead: toMillion(item.CacheRead), CacheWrite5m: toMillion(item.CacheWrite5m), CacheWrite1h: toMillion(item.CacheWrite1h), ImageInput: toMillion(item.ImageInput), ImageOutput: toMillion(item.ImageOutput), AudioInput: toMillion(item.AudioInput), AudioOutput: toMillion(item.AudioOutput)},
			Priority: CostSet{Input: toMillion(item.PriorityInput), Output: toMillion(item.PriorityOutput), CacheRead: toMillion(item.PriorityCacheRead), CacheWrite5m: toMillion(item.PriorityCacheWrite), AudioInput: toMillion(item.PriorityAudioInput), AudioOutput: toMillion(item.PriorityAudioOutput)},
			Flex:     CostSet{Input: toMillion(item.FlexInput), Output: toMillion(item.FlexOutput), CacheRead: toMillion(item.FlexCacheRead), CacheWrite5m: toMillion(item.FlexCacheWrite), AudioInput: toMillion(item.FlexAudioInput), AudioOutput: toMillion(item.FlexAudioOutput)},
		}
		if item.PerImage != nil && validCost(*item.PerImage) {
			record.PerRequest = pricePtr(*item.PerImage)
		}
		if item.Above200KInput != nil || item.Above200KOutput != nil || item.Above200KCacheRead != nil || item.Above200KCacheWrite != nil {
			threshold := 200000
			if item.LongContextThreshold != nil && *item.LongContextThreshold > 0 {
				threshold = *item.LongContextThreshold
			}
			longCosts := record.Standard
			if value := toMillion(item.Above200KInput); value != nil {
				longCosts.Input = value
			}
			if value := toMillion(item.Above200KOutput); value != nil {
				longCosts.Output = value
			}
			if value := toMillion(item.Above200KCacheRead); value != nil {
				longCosts.CacheRead = value
			}
			if value := toMillion(item.Above200KCacheWrite); value != nil {
				longCosts.CacheWrite5m = value
			}
			record.Tiers = []PriceTier{
				{Name: "base", MaxInputTokens: threshold, Costs: record.Standard},
				{Name: "long_context", Costs: longCosts},
			}
		}
		if record.Standard.Input == nil && record.PerRequest == nil {
			source.SkippedCount++
			continue
		}
		setRecordFieldSources(&record, sourceID)
		source.Records[record.Model] = record
	}
	if len(source.Records) == 0 {
		return nil, fmt.Errorf("%s pricing source has no usable entries", sourceID)
	}
	return source, nil
}

type modelsDevProvider struct {
	Models map[string]struct {
		Cost struct {
			Input      *float64 `json:"input"`
			Output     *float64 `json:"output"`
			CacheRead  *float64 `json:"cache_read"`
			CacheWrite *float64 `json:"cache_write"`
		} `json:"cost"`
	} `json:"models"`
}

func ParseModelsDevSource(data []byte, version string) (*SourceCatalog, error) {
	var providers map[string]modelsDevProvider
	if err := common.Unmarshal(data, &providers); err != nil {
		return nil, fmt.Errorf("parse models.dev source: %w", err)
	}
	byModel := map[string][]PriceRecord{}
	for provider, catalog := range providers {
		for model, item := range catalog.Models {
			if item.Cost.Input == nil && item.Cost.Output == nil {
				continue
			}
			record := PriceRecord{Model: normalizeKey(model), Provider: provider, PrimarySource: SourceModelsDev, SourceVersion: version, Standard: CostSet{Input: item.Cost.Input, Output: item.Cost.Output, CacheRead: item.Cost.CacheRead, CacheWrite5m: item.Cost.CacheWrite}}
			setRecordFieldSources(&record, SourceModelsDev)
			byModel[record.Model] = append(byModel[record.Model], record)
		}
	}
	source := newSourceCatalog(SourceModelsDev, version)
	for model, candidates := range byModel {
		sort.SliceStable(candidates, func(i, j int) bool {
			leftRank := providerRank(candidates[i].Provider, model)
			rightRank := providerRank(candidates[j].Provider, model)
			if leftRank != rightRank {
				return leftRank < rightRank
			}
			return candidates[i].Provider < candidates[j].Provider
		})
		source.Records[model] = candidates[0]
	}
	if len(source.Records) == 0 {
		return nil, fmt.Errorf("models.dev source has no usable entries")
	}
	return source, nil
}

func providerRank(provider, model string) int {
	p, m := strings.ToLower(provider), strings.ToLower(model)
	firstParty := (isOpenAIModel(m) && p == "openai") ||
		(strings.Contains(m, "claude") && p == "anthropic") ||
		(strings.Contains(m, "gemini") && p == "google") ||
		(strings.Contains(m, "grok") && p == "xai") ||
		(isMistralModel(m) && p == "mistral") ||
		(strings.HasPrefix(m, "command") && p == "cohere") ||
		(strings.HasPrefix(m, "deepseek") && p == "deepseek") ||
		(strings.HasPrefix(m, "qwen") && (p == "alibaba" || p == "qwen"))
	if firstParty {
		return 0
	}
	if map[string]bool{"amazon-bedrock": true, "aws-bedrock": true, "azure": true, "google-vertex": true, "vertex": true}[p] {
		return 1
	}
	if map[string]bool{"deepinfra": true, "fireworks-ai": true, "groq": true, "openrouter": true, "togetherai": true, "xpersona": true}[p] {
		return 3
	}
	return 2
}

func isOpenAIModel(model string) bool {
	for _, prefix := range []string{"chatgpt-", "dall-e-", "gpt-", "o1", "o3", "o4", "text-embedding-", "tts-", "whisper-"} {
		if strings.HasPrefix(model, prefix) {
			return true
		}
	}
	return false
}

func isMistralModel(model string) bool {
	for _, prefix := range []string{"codestral", "ministral", "mistral", "pixtral"} {
		if strings.HasPrefix(model, prefix) {
			return true
		}
	}
	return false
}

type newAPIDocument struct {
	Data struct {
		ModelRatio       map[string]float64 `json:"model_ratio"`
		CompletionRatio  map[string]float64 `json:"completion_ratio"`
		CacheRatio       map[string]float64 `json:"cache_ratio"`
		CreateCacheRatio map[string]float64 `json:"create_cache_ratio"`
		BillingMode      map[string]string  `json:"billing_mode"`
		BillingExpr      map[string]string  `json:"billing_expr"`
	} `json:"data"`
}

func ParseNewAPISource(data []byte, version string) (*SourceCatalog, error) {
	var doc newAPIDocument
	if err := common.Unmarshal(data, &doc); err != nil {
		return nil, fmt.Errorf("parse New API source: %w", err)
	}
	source := newSourceCatalog(SourceNewAPI, version)
	keys := map[string]bool{}
	for key := range doc.Data.ModelRatio {
		keys[key] = true
	}
	for key := range doc.Data.BillingExpr {
		keys[key] = true
	}
	for name := range keys {
		input, ok := doc.Data.ModelRatio[name]
		if !ok {
			source.SkippedCount++
			continue
		}
		inputUSD := input * ratioUnitUSDPerMillionTokens
		completion := doc.Data.CompletionRatio[name]
		if completion == 0 {
			completion = 1
		}
		record := PriceRecord{Model: normalizeKey(name), PrimarySource: SourceNewAPI, SourceVersion: version, Standard: CostSet{Input: pricePtr(inputUSD), Output: pricePtr(inputUSD * completion)}, BillingMode: doc.Data.BillingMode[name], BillingExpr: doc.Data.BillingExpr[name]}
		if value, ok := doc.Data.CacheRatio[name]; ok {
			record.Standard.CacheRead = pricePtr(inputUSD * value)
		}
		if value, ok := doc.Data.CreateCacheRatio[name]; ok {
			record.Standard.CacheWrite5m = pricePtr(inputUSD * value)
		}
		setRecordFieldSources(&record, SourceNewAPI)
		source.Records[record.Model] = record
	}
	if len(source.Records) == 0 {
		return nil, fmt.Errorf("New API source has no usable entries")
	}
	return source, nil
}

func LoadBuiltInOverrides(now time.Time) (*SourceCatalog, []string, error) {
	validUntil := time.Date(2027, 8, 14, 0, 0, 0, 0, time.UTC)
	source := newSourceCatalog(SourceOverride, "reviewed-2026-08-14")
	base := func(model, sourceURL, reason string, standard CostSet, tiers []PriceTier) PriceRecord {
		return PriceRecord{Model: model, PrimarySource: SourceOverride, SourceVersion: source.Version, SourceURL: sourceURL, Reason: reason, ValidUntil: validUntil, Standard: standard, Tiers: tiers}
	}
	openAIURL := "https://openai.com/api/pricing/"
	gpt56 := base("gpt-5.6-sol", openAIURL, "人工审校的 OpenAI 官方价格", CostSet{Input: pricePtr(5), Output: pricePtr(30), CacheRead: pricePtr(.5), CacheWrite5m: pricePtr(6.25)}, []PriceTier{{Name: "base", MaxInputTokens: 272000, Costs: CostSet{Input: pricePtr(5), Output: pricePtr(30), CacheRead: pricePtr(.5), CacheWrite5m: pricePtr(6.25)}}, {Name: "long_context", Costs: CostSet{Input: pricePtr(10), Output: pricePtr(45), CacheRead: pricePtr(1), CacheWrite5m: pricePtr(12.5)}}})
	gpt56.Priority = CostSet{Input: pricePtr(10), Output: pricePtr(60), CacheRead: pricePtr(1), CacheWrite5m: pricePtr(12.5)}
	gpt56.Flex = CostSet{Input: pricePtr(2.5), Output: pricePtr(15), CacheRead: pricePtr(.25), CacheWrite5m: pricePtr(3.125)}
	gpt56.Aliases = []string{"gpt-5.6"}
	source.Records[gpt56.Model] = gpt56
	source.Records["gpt-5.6-terra"] = base("gpt-5.6-terra", openAIURL, "人工审校的 OpenAI 官方价格", CostSet{Input: pricePtr(2), Output: pricePtr(12), CacheRead: pricePtr(.2)}, nil)
	source.Records["gpt-5.6-luna"] = base("gpt-5.6-luna", openAIURL, "人工审校的 OpenAI 官方价格", CostSet{Input: pricePtr(.2), Output: pricePtr(1.2), CacheRead: pricePtr(.02)}, nil)
	source.Records["gpt-5.5"] = base("gpt-5.5", openAIURL, "人工审校的 OpenAI 官方价格", CostSet{Input: pricePtr(5), Output: pricePtr(30)}, []PriceTier{{Name: "base", MaxInputTokens: 272000, Costs: CostSet{Input: pricePtr(5), Output: pricePtr(30)}}, {Name: "long_context", Costs: CostSet{Input: pricePtr(10), Output: pricePtr(45)}}})
	source.Records["gpt-5.4"] = base("gpt-5.4", openAIURL, "人工审校的 OpenAI 官方价格", CostSet{Input: pricePtr(2.5), Output: pricePtr(15)}, []PriceTier{{Name: "base", MaxInputTokens: 272000, Costs: CostSet{Input: pricePtr(2.5), Output: pricePtr(15)}}, {Name: "long_context", Costs: CostSet{Input: pricePtr(5), Output: pricePtr(22.5)}}})
	source.Records["gemini-2.5-pro"] = base("gemini-2.5-pro", "https://ai.google.dev/gemini-api/docs/pricing", "人工审校的 Google 官方价格", CostSet{Input: pricePtr(1.25), Output: pricePtr(10)}, []PriceTier{{Name: "base", MaxInputTokens: 200000, Costs: CostSet{Input: pricePtr(1.25), Output: pricePtr(10)}}, {Name: "long_context", Costs: CostSet{Input: pricePtr(2.5), Output: pricePtr(15)}}})
	source.Records["claude-opus-5"] = base("claude-opus-5", "https://www.anthropic.com/pricing", "人工审校的 Anthropic 官方价格", CostSet{Input: pricePtr(5), Output: pricePtr(25), CacheRead: pricePtr(.5), CacheWrite5m: pricePtr(6.25), CacheWrite1h: pricePtr(10)}, nil)
	expired := []string{}
	for name, record := range source.Records {
		if !record.ValidUntil.After(now) {
			expired = append(expired, name)
			delete(source.Records, name)
			continue
		}
		setRecordFieldSources(&record, SourceOverride)
		source.Records[name] = record
	}
	sort.Strings(expired)
	return source, expired, nil
}
