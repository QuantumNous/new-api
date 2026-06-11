package service

import (
	"errors"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

const (
	CCSwitchDefaultTarget  = "codex"
	CCSwitchDefaultModel   = "gpt-5.5"
	CCSwitchEndpoint       = "https://api.xistree.hk/"
	CCSwitchProviderName   = "Xistree"
)

type ccSwitchTargetConfig struct {
	Key            string
	Label          string
	App            string
	Enabled        bool
	DisabledReason string
}

var ccSwitchTargets = []ccSwitchTargetConfig{
	{Key: "codex", Label: "Codex", App: "codex", Enabled: true},
	{Key: "claude", Label: "Claude Code", App: "claude", Enabled: true},
}

func GetCCSwitchImportOptions(userId int, tokenId int) (*dto.CCSwitchImportOptionsResponse, error) {
	token, err := model.GetTokenByIds(tokenId, userId)
	if err != nil {
		return nil, err
	}
	models, err := GetCCSwitchModelOptionsForUser(userId)
	if err != nil {
		return nil, err
	}
	defaultModel := selectDefaultCCSwitchModel(models)

	return &dto.CCSwitchImportOptionsResponse{
		Token: dto.CCSwitchImportToken{
			Id:        token.Id,
			Name:      token.Name,
			MaskedKey: token.GetMaskedKey(),
			BaseURL:   CCSwitchEndpoint,
		},
		DefaultTarget: CCSwitchDefaultTarget,
		DefaultModel:  defaultModel,
		Targets:       getCCSwitchTargetDTOs(),
		Models:        models,
	}, nil
}

func CreateCCSwitchImportLink(userId int, tokenId int, request dto.CCSwitchImportLinkRequest, _ string, _ string) (*dto.CCSwitchImportLinkResponse, error) {
	target, ok := findCCSwitchTarget(request.Target)
	if !ok {
		return nil, errors.New("unsupported CC Switch import target")
	}
	if !target.Enabled {
		return nil, errors.New("selected CC Switch import target is not available yet")
	}
	selectedModel := strings.TrimSpace(request.Model)
	if selectedModel == "" {
		return nil, errors.New("model is required")
	}
	token, err := model.GetTokenByIds(tokenId, userId)
	if err != nil {
		return nil, err
	}

	params := url.Values{}
	params.Set("resource", "provider")
	params.Set("app", target.App)
	params.Set("name", CCSwitchProviderName)
	params.Set("endpoint", CCSwitchEndpoint)
	params.Set("apiKey", normalizeCCSwitchAPIKey(token.GetFullKey()))
	params.Set("model", selectedModel)
	params.Set("enabled", "true")

	haikuModel := ""
	sonnetModel := ""
	opusModel := ""
	if target.Key == "codex" {
		params.Set("model_reasoning_effort", "high")
		params.Set("disable_response_storage", "true")
		params.Set("wire_api", "responses")
		params.Set("requires_openai_auth", "true")
	} else if target.Key == "claude" {
		haikuModel = fallbackCCSwitchModel(request.HaikuModel, selectedModel)
		sonnetModel = fallbackCCSwitchModel(request.SonnetModel, selectedModel)
		opusModel = fallbackCCSwitchModel(request.OpusModel, selectedModel)
		params.Set("haikuModel", haikuModel)
		params.Set("sonnetModel", sonnetModel)
		params.Set("opusModel", opusModel)
	}

	return &dto.CCSwitchImportLinkResponse{
		URL: "ccswitch://v1/import?" + params.Encode(),
	}, nil
}

func getCCSwitchTargetDTOs() []dto.CCSwitchImportTarget {
	targets := make([]dto.CCSwitchImportTarget, 0, len(ccSwitchTargets))
	for _, target := range ccSwitchTargets {
		targets = append(targets, dto.CCSwitchImportTarget{
			Key:            target.Key,
			Label:          target.Label,
			Enabled:        target.Enabled,
			DisabledReason: target.DisabledReason,
		})
	}
	return targets
}

func fallbackCCSwitchModel(candidate string, fallback string) string {
	candidate = strings.TrimSpace(candidate)
	if candidate != "" {
		return candidate
	}
	return fallback
}

func findCCSwitchTarget(key string) (ccSwitchTargetConfig, bool) {
	key = strings.TrimSpace(strings.ToLower(key))
	for _, target := range ccSwitchTargets {
		if target.Key == key {
			return target, true
		}
	}
	return ccSwitchTargetConfig{}, false
}

func normalizeCCSwitchAPIKey(key string) string {
	key = strings.TrimSpace(key)
	if key == "" || strings.HasPrefix(key, "sk-") {
		return key
	}
	return "sk-" + key
}
