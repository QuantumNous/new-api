package modellab

import (
	_ "embed"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

//go:embed catalog.json
var embeddedCatalog []byte

type Lab struct {
	Slug string `json:"slug"`
	Name string `json:"name"`
}

type Catalog struct {
	Version string            `json:"version"`
	Labs    []Lab             `json:"labs"`
	Models  map[string]string `json:"models"`
	Aliases map[string]string `json:"aliases,omitempty"`
}

var (
	catalogOnce sync.Once
	catalog     *Catalog
)

func DefaultCatalog() *Catalog {
	catalogOnce.Do(func() {
		loaded := &Catalog{}
		if err := common.Unmarshal(embeddedCatalog, loaded); err != nil {
			loaded = fallbackCatalog()
		}
		if loaded.Models == nil {
			loaded.Models = map[string]string{}
		}
		if loaded.Aliases == nil {
			loaded.Aliases = map[string]string{}
		}
		catalog = loaded
	})
	return catalog
}

func fallbackCatalog() *Catalog {
	labs := defaultLabs()
	models := make(map[string]string, len(labs))
	for _, lab := range labs {
		models[lab.Slug+"/"] = lab.Slug
	}
	return &Catalog{Version: "fallback", Labs: labs, Models: models, Aliases: map[string]string{}}
}

func defaultLabs() []Lab {
	return []Lab{
		{Slug: "aisingapore", Name: "Aisingapore"},
		{Slug: "alibaba", Name: "Alibaba"},
		{Slug: "anthropic", Name: "Anthropic"},
		{Slug: "arcee-ai", Name: "Arcee Ai"},
		{Slug: "bytedance-seed", Name: "Bytedance Seed"},
		{Slug: "cohere", Name: "Cohere"},
		{Slug: "deepreinforce", Name: "Deepreinforce"},
		{Slug: "deepseek", Name: "DeepSeek"},
		{Slug: "google", Name: "Google"},
		{Slug: "ibm", Name: "Ibm"},
		{Slug: "meituan", Name: "Meituan"},
		{Slug: "meta", Name: "Meta"},
		{Slug: "microsoft", Name: "Microsoft"},
		{Slug: "minimax", Name: "MiniMax"},
		{Slug: "mistral", Name: "Mistral"},
		{Slug: "moonshotai", Name: "Moonshot AI"},
		{Slug: "nvidia", Name: "Nvidia"},
		{Slug: "openai", Name: "OpenAI"},
		{Slug: "perplexity", Name: "Perplexity"},
		{Slug: "poolside", Name: "Poolside"},
		{Slug: "sakana", Name: "Sakana AI"},
		{Slug: "sarvam", Name: "Sarvam AI"},
		{Slug: "sdaia", Name: "Sdaia"},
		{Slug: "stepfun", Name: "StepFun"},
		{Slug: "swiss-ai", Name: "Swiss Ai"},
		{Slug: "tencent", Name: "Tencent"},
		{Slug: "thinkingmachines", Name: "Thinking Machines"},
		{Slug: "trendyol", Name: "Trendyol"},
		{Slug: "upstage", Name: "Upstage"},
		{Slug: "xai", Name: "xAI"},
		{Slug: "xiaomi", Name: "Xiaomi"},
		{Slug: "zhipuai", Name: "Zhipu AI"},
	}
}

func (c *Catalog) Lab(slug string) (Lab, bool) {
	for _, lab := range c.Labs {
		if lab.Slug == slug {
			return lab, true
		}
	}
	return Lab{}, false
}
