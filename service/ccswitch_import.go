package service

import (
	"errors"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

const (
	CCSwitchDefaultTarget = "codex"
	CCSwitchDefaultModel  = "gpt-5.5"
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
	{Key: "claude", Label: "Claude Code", App: "claude", Enabled: false, DisabledReason: "Coming soon"},
	{Key: "hermes", Label: "Hermes", App: "hermes", Enabled: false, DisabledReason: "Coming soon"},
	{Key: "openclaw", Label: "OpenClaw", App: "openclaw", Enabled: false, DisabledReason: "Coming soon"},
	{Key: "opencode", Label: "OpenCode", App: "opencode", Enabled: false, DisabledReason: "Coming soon"},
}

func GetCCSwitchImportOptions(userId int, tokenId int) (*dto.CCSwitchImportOptionsResponse, error) {
	endpoint, err := getCCSwitchEndpoint()
	if err != nil {
		return nil, err
	}
	token, err := model.GetTokenByIds(tokenId, userId)
	if err != nil {
		return nil, err
	}
	preference, err := model.GetUserCCSwitchPreference(userId)
	if err != nil {
		return nil, err
	}
	defaultTarget := CCSwitchDefaultTarget
	defaultModel := CCSwitchDefaultModel
	if preference != nil {
		if target, ok := findCCSwitchTarget(preference.LastTarget); ok && target.Enabled {
			defaultTarget = target.Key
		}
		if strings.TrimSpace(preference.LastModel) != "" {
			defaultModel = strings.TrimSpace(preference.LastModel)
		}
	}

	return &dto.CCSwitchImportOptionsResponse{
		Token: dto.CCSwitchImportToken{
			Id:        token.Id,
			Name:      token.Name,
			MaskedKey: token.GetMaskedKey(),
			BaseURL:   endpoint,
		},
		DefaultTarget: defaultTarget,
		DefaultModel:  defaultModel,
		Targets:       getCCSwitchTargetDTOs(),
	}, nil
}

func CreateCCSwitchImportLink(userId int, tokenId int, request dto.CCSwitchImportLinkRequest, ip string, userAgent string) (*dto.CCSwitchImportLinkResponse, error) {
	endpoint, err := getCCSwitchEndpoint()
	if err != nil {
		return nil, err
	}
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
	params.Set("name", token.Name)
	params.Set("endpoint", endpoint)
	params.Set("apiKey", normalizeCCSwitchAPIKey(token.GetFullKey()))
	params.Set("model", selectedModel)
	params.Set("enabled", "true")
	params.Set("model_reasoning_effort", "high")
	params.Set("disable_response_storage", "true")
	params.Set("wire_api", "responses")
	params.Set("requires_openai_auth", "true")

	now := common.GetTimestamp()
	if err := model.UpsertUserCCSwitchPreference(&model.UserCCSwitchPreference{
		UserId:     userId,
		LastTarget: target.Key,
		LastModel:  selectedModel,
		UpdatedAt:  now,
	}); err != nil {
		return nil, err
	}
	if err := model.CreateCCSwitchImportLog(&model.CCSwitchImportLog{
		UserId:    userId,
		TokenId:   token.Id,
		Target:    target.Key,
		Model:     selectedModel,
		CreatedAt: now,
		Ip:        ip,
		UserAgent: userAgent,
	}); err != nil {
		return nil, err
	}

	return &dto.CCSwitchImportLinkResponse{
		URL: "ccswitch://v1/import?" + params.Encode(),
	}, nil
}

func getCCSwitchEndpoint() (string, error) {
	endpoint := strings.TrimSpace(system_setting.ServerAddress)
	if endpoint == "" {
		return "", errors.New("server address is not configured")
	}
	return endpoint, nil
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
