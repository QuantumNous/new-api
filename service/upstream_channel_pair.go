package service

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	rootdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	kitdto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"gorm.io/gorm"
)

const (
	upstreamSyncCommandEnroll = "enroll"
	upstreamSyncCommandRevoke = "revoke"
)

func ApplyUpstreamEnrollmentResult(deviceID string, result rootdto.UpstreamEnrollmentResult) error {
	command, err := model.GetUpstreamSyncCommand(strings.TrimSpace(result.CommandID))
	if err != nil {
		return err
	}
	if command.Status != model.UpstreamSyncCommandRunning ||
		command.Type != upstreamSyncCommandEnroll ||
		command.DeviceID != strings.TrimSpace(deviceID) {
		return errors.New("upstream enrollment command is not running")
	}
	if !result.Success {
		errorMessage := strings.TrimSpace(result.Error)
		if errorMessage == "" {
			errorMessage = "upstream key enrollment failed"
		}
		return model.CompleteUpstreamSyncCommand(command.CommandID, model.UpstreamSyncCommandFailed, "", common.LocalLogPreview(errorMessage))
	}

	var payload rootdto.UpstreamEnrollmentCommand
	if err := common.UnmarshalJsonStr(command.Payload, &payload); err != nil {
		return failUpstreamEnrollmentCommand(command, err)
	}
	if payload.SourceKey != result.SourceKey || payload.ExternalGroupID != result.ExternalGroupID {
		return failUpstreamEnrollmentCommand(command, errors.New("upstream enrollment result identity mismatch"))
	}
	apiKey := strings.TrimSpace(result.APIKey)
	if apiKey == "" {
		return failUpstreamEnrollmentCommand(command, errors.New("upstream enrollment result is missing API key"))
	}
	fingerprint := upstreamAPIKeyFingerprint(apiKey)
	if result.KeyFingerprint != "" && !strings.EqualFold(result.KeyFingerprint, fingerprint) {
		return failUpstreamEnrollmentCommand(command, errors.New("upstream enrollment key fingerprint mismatch"))
	}

	source, err := model.GetUpstreamSourceByKey(payload.SourceKey)
	if err != nil {
		return failUpstreamEnrollmentCommand(command, err)
	}
	if payload.APIBaseURL == "" {
		payload.APIBaseURL = source.SelectedEndpoint
	}
	if _, _, err := normalizeUpstreamEndpoints(payload.SourceKey, payload.APIBaseURL, nil); err != nil {
		return failUpstreamEnrollmentCommand(command, err)
	}
	payload.Models = uniqueSortedStrings(payload.Models)
	if len(payload.Models) == 0 {
		return failUpstreamEnrollmentCommand(command, errors.New("upstream enrollment has no models"))
	}

	channelIDs := make(map[string]int, 2)
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		for _, protocol := range []string{model.UpstreamProtocolOpenAI, model.UpstreamProtocolAnthropic} {
			var existing model.UpstreamManagedRoute
			findErr := tx.Where(
				"source_id = ? AND external_group_id = ? AND platform = ? AND protocol = ?",
				source.ID,
				payload.ExternalGroupID,
				payload.Platform,
				protocol,
			).First(&existing).Error
			if findErr == nil {
				channelIDs[protocol] = existing.ChannelID
				continue
			}
			if !errors.Is(findErr, gorm.ErrRecordNotFound) {
				return findErr
			}

			channel, buildErr := buildManagedUpstreamChannel(payload, apiKey, protocol)
			if buildErr != nil {
				return buildErr
			}
			if err := tx.Create(channel).Error; err != nil {
				return err
			}
			if err := channel.AddAbilities(tx); err != nil {
				return err
			}
			route := model.UpstreamManagedRoute{
				SourceID:            source.ID,
				ExternalGroupID:     payload.ExternalGroupID,
				Platform:            strings.ToLower(strings.TrimSpace(payload.Platform)),
				Protocol:            protocol,
				ChannelID:           channel.Id,
				ExternalKeyID:       strings.TrimSpace(result.ExternalKeyID),
				KeyFingerprint:      fingerprint,
				State:               model.UpstreamRouteStateShadow,
				EffectiveMultiplier: 0,
				NextProbeAt:         common.GetTimestamp(),
			}
			if err := tx.Create(&route).Error; err != nil {
				return err
			}
			channelIDs[protocol] = channel.Id
		}
		return nil
	})
	if err != nil {
		_, _ = model.CreateUpstreamSyncCommand(command.DeviceID, upstreamSyncCommandRevoke, payload.SourceKey, map[string]any{
			"external_key_id": result.ExternalKeyID,
			"reason":          "new API channel transaction failed",
		})
		return failUpstreamEnrollmentCommand(command, err)
	}
	model.InitChannelCache()
	safeResult, _ := common.Marshal(map[string]any{
		"source_key":        payload.SourceKey,
		"external_group_id": payload.ExternalGroupID,
		"external_key_id":   result.ExternalKeyID,
		"key_fingerprint":   fingerprint,
		"channel_ids":       channelIDs,
	})
	return model.CompleteUpstreamSyncCommand(command.CommandID, model.UpstreamSyncCommandSucceeded, string(safeResult), "")
}

func buildManagedUpstreamChannel(payload rootdto.UpstreamEnrollmentCommand, apiKey string, protocol string) (*model.Channel, error) {
	platform := strings.ToLower(strings.TrimSpace(payload.Platform))
	if platform != "openai" && platform != "anthropic" && platform != "grok" {
		return nil, fmt.Errorf("unsupported managed upstream platform: %s", payload.Platform)
	}
	baseURL := strings.TrimRight(strings.TrimSpace(payload.APIBaseURL), "/")
	priority := int64(0)
	weight := uint(100)
	autoBan := 1
	tag := fmt.Sprintf("managed:sub2api:%s:%s:%s", payload.SourceKey, payload.ExternalGroupID, platform)
	name := truncateRunes(fmt.Sprintf("%s-%s-%s-%s", payload.SourceKey, payload.GroupName, platform, protocol), 128)
	testModel := payload.Models[0]
	orchestration := operation_setting.GetUpstreamOrchestrationSetting()
	channel := &model.Channel{
		Type:        constant.ChannelTypeAdvancedCustom,
		Key:         apiKey,
		TestModel:   &testModel,
		Status:      common.ChannelStatusManuallyDisabled,
		Name:        name,
		Weight:      &weight,
		CreatedTime: common.GetTimestamp(),
		BaseURL:     &baseURL,
		Models:      strings.Join(payload.Models, ","),
		Group:       strings.Join(orchestration.TargetGroups, ","),
		Priority:    &priority,
		AutoBan:     &autoBan,
		Tag:         &tag,
	}
	channel.SetSetting(kitdto.ChannelSettings{})
	channel.SetOtherSettings(kitdto.ChannelOtherSettings{
		AdvancedCustom: managedAdvancedCustomConfig(payload, protocol),
	})
	if err := channel.ValidateSettings(); err != nil {
		return nil, err
	}
	return channel, nil
}

func managedAdvancedCustomConfig(payload rootdto.UpstreamEnrollmentCommand, protocol string) *kitdto.AdvancedCustomConfig {
	switch protocol {
	case model.UpstreamProtocolAnthropic:
		upstreamPath := strings.TrimSpace(payload.MessagesPath)
		if upstreamPath == "" {
			upstreamPath = "/v1/messages"
		}
		converter := strings.TrimSpace(payload.MessagesConverter)
		if converter == "" {
			converter = relayconvert.ConverterNone
		}
		return &kitdto.AdvancedCustomConfig{Routes: []kitdto.AdvancedCustomRoute{{
			IncomingPath: "/v1/messages",
			UpstreamPath: upstreamPath,
			Converter:    converter,
		}}}
	default:
		responsesPath := strings.TrimSpace(payload.ResponsesPath)
		if responsesPath == "" {
			responsesPath = "/v1/responses"
		}
		responsesConverter := strings.TrimSpace(payload.ResponsesConverter)
		if responsesConverter == "" {
			responsesConverter = relayconvert.ConverterNone
		}
		return &kitdto.AdvancedCustomConfig{Routes: []kitdto.AdvancedCustomRoute{
			{
				IncomingPath: "/v1/chat/completions",
				UpstreamPath: "/v1/chat/completions",
				Converter:    relayconvert.ConverterNone,
			},
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: responsesPath,
				Converter:    responsesConverter,
			},
		}}
	}
}

func failUpstreamEnrollmentCommand(command *model.UpstreamSyncCommand, err error) error {
	if command != nil {
		_ = model.CompleteUpstreamSyncCommand(
			command.CommandID,
			model.UpstreamSyncCommandFailed,
			"",
			common.LocalLogPreview(err.Error()),
		)
	}
	return err
}

func upstreamAPIKeyFingerprint(apiKey string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(apiKey)))
	return hex.EncodeToString(sum[:])
}

func truncateRunes(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}
