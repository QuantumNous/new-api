package controller

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

const (
	keyStorageModeSingle = "single"
	keyStorageModeMulti  = "multi"
)

func channelSupportsMultiKey(channel *model.Channel) bool {
	if channel.Type == constant.ChannelTypeCodex {
		return false
	}
	if channel.Type == constant.ChannelTypeVertexAi && channel.GetOtherSettings().VertexKeyType == dto.VertexKeyTypeAPIKey {
		return false
	}
	return true
}

func parseUpdateKeyList(channel *model.Channel, key string) ([]string, error) {
	if channel.Type == constant.ChannelTypeVertexAi && channel.GetOtherSettings().VertexKeyType != dto.VertexKeyTypeAPIKey {
		trimmed := strings.TrimSpace(key)
		if strings.HasPrefix(trimmed, "[") {
			return getVertexArrayKeys(key)
		}
		if trimmed == "" {
			return nil, fmt.Errorf("密钥不能为空")
		}
		return []string{trimmed}, nil
	}
	keys := make([]string, 0)
	for _, line := range strings.Split(key, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		keys = append(keys, line)
	}
	return keys, nil
}

func applyKeyStorageMode(channel *PatchChannel, origin *model.Channel, keyConfig *model.Channel) error {
	if channel.KeyStorageMode == nil {
		return nil
	}
	if keyConfig == nil {
		keyConfig = origin
	}
	mode := strings.TrimSpace(*channel.KeyStorageMode)
	if mode == "" {
		return nil
	}
	if mode != keyStorageModeSingle && mode != keyStorageModeMulti {
		return fmt.Errorf("不支持的密钥存储模式")
	}
	if strings.TrimSpace(channel.Key) == "" {
		return fmt.Errorf("转换密钥模式必须提供新的密钥")
	}
	keys, err := parseUpdateKeyList(keyConfig, channel.Key)
	if err != nil {
		return err
	}
	switch mode {
	case keyStorageModeSingle:
		if !origin.ChannelInfo.IsMultiKey {
			return fmt.Errorf("渠道已经是单密钥模式")
		}
		if len(keys) != 1 {
			return fmt.Errorf("转换为单密钥时必须只提供一把新密钥")
		}
		channel.Key = keys[0]
		channel.ChannelInfo = model.ChannelInfo{}
		return nil
	default:
		if origin.ChannelInfo.IsMultiKey {
			return fmt.Errorf("渠道已经是多密钥模式")
		}
		if !channelSupportsMultiKey(keyConfig) {
			return fmt.Errorf("当前渠道类型不支持多密钥模式")
		}
		if len(keys) < 2 {
			return fmt.Errorf("转换为多密钥时至少需要两把密钥")
		}
		rotation := constant.MultiKeyModeRandom
		if channel.MultiKeyMode != nil {
			requested := constant.MultiKeyMode(strings.TrimSpace(*channel.MultiKeyMode))
			if requested == constant.MultiKeyModeRandom || requested == constant.MultiKeyModePolling {
				rotation = requested
			}
		}
		channel.Key = strings.Join(keys, "\n")
		channel.ChannelInfo = model.ChannelInfo{
			IsMultiKey:   true,
			MultiKeySize: len(keys),
			MultiKeyMode: rotation,
		}
		return nil
	}
}
