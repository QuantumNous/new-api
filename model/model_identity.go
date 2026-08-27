package model

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
)

const anyChannelType = -1

type modelPrefixRule struct {
	name        string
	separator   string
	channelType int
}

var modelPrefixRules = []modelPrefixRule{
	{name: "openrouter", separator: "/", channelType: anyChannelType},
	{name: "litellm", separator: "/", channelType: anyChannelType},
	{name: "ollama", separator: "/", channelType: anyChannelType},
	{name: "deepinfra", separator: "/", channelType: anyChannelType},
	{name: "together", separator: "/", channelType: anyChannelType},
	{name: "vertex", separator: "/", channelType: anyChannelType},
	{name: "bedrock", separator: "/", channelType: anyChannelType},
	{name: "fastgpt", separator: "/", channelType: anyChannelType},
	{name: "openai", separator: "/", channelType: anyChannelType},
	{name: "deepseek", separator: "/", channelType: anyChannelType},
	{name: "google", separator: "/", channelType: anyChannelType},
	{name: "anthropic", separator: "/", channelType: anyChannelType},
	{name: "qwen", separator: "/", channelType: anyChannelType},
	{name: "models", separator: "/", channelType: constant.ChannelTypeGemini},
	{name: "anthropic", separator: ".", channelType: constant.ChannelTypeAws},
	{name: "meta", separator: ".", channelType: constant.ChannelTypeAws},
	{name: "mistral", separator: ".", channelType: constant.ChannelTypeAws},
	{name: "amazon", separator: ".", channelType: constant.ChannelTypeAws},
	{name: "cohere", separator: ".", channelType: constant.ChannelTypeAws},
	{name: "stability", separator: ".", channelType: constant.ChannelTypeAws},
}

func ResolveCanonicalModelName(
	requestedName string,
	aliases map[string]string,
) (string, error) {

	if strings.TrimSpace(requestedName) == "" {
		return "", ErrModelNameEmpty
	}

	return resolveModelAliasChain(aliases, requestedName)

}

func resolveModelAliasChain(
	aliases map[string]string,
	requestedName string,
) (string, error) {
	currentName := requestedName
	visited := map[string]bool{currentName: true}

	for {
		nextName, ok := aliases[currentName]
		if !ok {
			return currentName, nil
		}
		if strings.TrimSpace(nextName) == "" {
			return "", ErrModelNameEmpty
		}
		if nextName == currentName {
			return currentName, nil
		}
		if visited[nextName] {
			return "", ErrModelAliasCycle
		}
		visited[nextName] = true
		currentName = nextName
	}

}

func NormalizeChannelModel(
	channelType int,
	upstreamModel string,
) (canonicalModel string, upstreamMapping string, err error) {

	canonicalModel = strings.TrimSpace(upstreamModel)

	if canonicalModel == "" {
		return "", "", ErrModelNameEmpty
	}

	for {
		matchedRule := false
		for _, rule := range modelPrefixRules {
			if rule.channelType != anyChannelType && rule.channelType != channelType {
				continue
			}

			prefix := rule.name + rule.separator
			if strings.HasPrefix(canonicalModel, prefix) {
				canonicalModel = strings.TrimPrefix(canonicalModel, prefix)
				matchedRule = true
				break
			}
		}
		if !matchedRule {
			break
		}
	}
	if canonicalModel == "" {
		return "", "", ErrModelNameEmpty
	}

	return canonicalModel, upstreamModel, nil
}

func ResolveChannelModelTarget(
	modelName string,
	modelMapping map[string]string,
) (string, error) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return "", ErrModelNameEmpty
	}

	if err := validateChannelModelMapping(modelMapping); err != nil {
		return "", err
	}

	return resolveChannelModelTarget(modelName, modelMapping)
}

func validateChannelModelMapping(modelMapping map[string]string) error {
	for source, target := range modelMapping {
		if strings.TrimSpace(source) == "" {
			return ErrModelMappingSourceEmpty
		}
		if strings.TrimSpace(target) == "" {
			return ErrModelMappingTargetEmpty
		}
	}
	return nil
}

func resolveChannelModelTarget(modelName string, modelMapping map[string]string) (string, error) {
	currentModel := modelName
	visitedModels := map[string]bool{currentModel: true}
	for {
		mappedModel, exists := modelMapping[currentModel]
		if !exists {
			return currentModel, nil
		}
		if mappedModel == currentModel {
			return currentModel, nil
		}
		if visitedModels[mappedModel] {
			return "", ErrModelMappingCycle
		}
		visitedModels[mappedModel] = true
		currentModel = mappedModel
	}
}

func CanonicalizeChannelModels(
	channelType int,
	models []string,
	existingMapping map[string]string,
) ([]string, map[string]string, error) {
	if err := validateChannelModelMapping(existingMapping); err != nil {
		return nil, nil, err
	}
	for source := range existingMapping {
		if _, err := resolveChannelModelTarget(source, existingMapping); err != nil {
			return nil, nil, err
		}
	}

	canonicalModels := make([]string, 0, len(models))
	mergedMapping := make(map[string]string, len(existingMapping))
	for source, target := range existingMapping {
		mergedMapping[source] = target
	}

	seenModels := make(map[string]string, len(models))
	for _, modelName := range models {
		modelName = strings.TrimSpace(modelName)
		if modelName == "" {
			return nil, nil, ErrModelNameEmpty
		}

		canonicalModel := modelName
		upstreamModel, hasManualMapping := existingMapping[modelName]
		terminalTarget := modelName
		if !hasManualMapping {
			var err error
			canonicalModel, upstreamModel, err = NormalizeChannelModel(channelType, modelName)
			if err != nil {
				return nil, nil, err
			}

			terminalTarget, err = resolveChannelModelTarget(upstreamModel, existingMapping)
			if err != nil {
				return nil, nil, err
			}
			if _, exists := existingMapping[canonicalModel]; exists {
				existingTerminalTarget, err := resolveChannelModelTarget(canonicalModel, existingMapping)
				if err != nil {
					return nil, nil, err
				}
				if existingTerminalTarget != terminalTarget {
					return nil, nil, fmt.Errorf(
						"%w: %q maps to %q instead of %q",
						ErrModelMappingConflict,
						canonicalModel,
						existingTerminalTarget,
						terminalTarget,
					)
				}
			}
		} else {
			var err error
			terminalTarget, err = resolveChannelModelTarget(modelName, existingMapping)
			if err != nil {
				return nil, nil, err
			}
		}

		if seenTarget, exists := seenModels[canonicalModel]; exists {
			if seenTarget == terminalTarget {
				continue
			}
			return nil, nil, fmt.Errorf(
				"%w: %q resolves to both %q and %q",
				ErrCanonicalModelCollision,
				canonicalModel,
				seenTarget,
				terminalTarget,
			)
		}

		seenModels[canonicalModel] = terminalTarget
		canonicalModels = append(canonicalModels, canonicalModel)
		if canonicalModel != upstreamModel {
			if _, exists := existingMapping[canonicalModel]; !exists {
				mergedMapping[canonicalModel] = upstreamModel
			}
		}
	}

	return canonicalModels, mergedMapping, nil
}

func (channel *Channel) CanonicalizeModelConfig() error {
	existingMapping := make(map[string]string)
	mappingJSON := strings.TrimSpace(channel.GetModelMapping())
	if mappingJSON != "" {
		if err := common.UnmarshalJsonStr(mappingJSON, &existingMapping); err != nil {
			return fmt.Errorf("invalid model mapping: %w", err)
		}
	}

	models, mapping, err := CanonicalizeChannelModels(channel.Type, channel.GetModels(), existingMapping)
	if err != nil {
		return err
	}

	mappingBytes, err := common.Marshal(mapping)
	if err != nil {
		return fmt.Errorf("marshal model mapping: %w", err)
	}

	mappingJSON = string(mappingBytes)
	channel.Models = strings.Join(models, ",")
	channel.ModelMapping = &mappingJSON
	return nil
}
