package dto

import "github.com/QuantumNous/new-api/types"

// Type aliases for backward compatibility.
// These types were moved from dto to types to break the dto↔model import cycle.

type UserSetting = types.UserSetting
type ChannelSettings = types.ChannelSettings
type ChannelOtherSettings = types.ChannelOtherSettings
type VertexKeyType = types.VertexKeyType
type AwsKeyType = types.AwsKeyType
type OpenAIVideo = types.OpenAIVideo
type OpenAIVideoError = types.OpenAIVideoError

// Re-export constants.
var (
	NotifyTypeEmail   = types.NotifyTypeEmail
	NotifyTypeWebhook = types.NotifyTypeWebhook
	NotifyTypeBark    = types.NotifyTypeBark
	NotifyTypeGotify  = types.NotifyTypeGotify
)

const (
	VideoStatusUnknown    = types.VideoStatusUnknown
	VideoStatusQueued     = types.VideoStatusQueued
	VideoStatusInProgress = types.VideoStatusInProgress
	VideoStatusCompleted  = types.VideoStatusCompleted
	VideoStatusFailed     = types.VideoStatusFailed
)

var (
	VertexKeyTypeAPIKey = types.VertexKeyTypeAPIKey
	AwsKeyTypeApiKey   = types.AwsKeyTypeApiKey
)

var NewOpenAIVideo = types.NewOpenAIVideo
