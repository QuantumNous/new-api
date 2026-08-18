package doubaomediakit

import (
	"encoding/base64"
	"fmt"
	"strings"
)

const (
	stagePrefix      = "dmk:v1"
	stageGeneration  = "generation"
	stageEnhancement = "enhancement"
	resolution720P   = "720p"
	resolution1080P  = "1080p"
	resolution480P   = "480p"
)

type taskStage struct {
	Phase            string
	TargetResolution string
	ArkTaskID        string
	MediaKitTaskID   string
}

func newGenerationStage(targetResolution, arkTaskID string) string {
	return strings.Join([]string{
		stagePrefix,
		"g",
		targetResolution,
		encodeStageValue(arkTaskID),
	}, ":")
}

func newEnhancementStage(targetResolution, arkTaskID, mediaKitTaskID string) string {
	return strings.Join([]string{
		stagePrefix,
		"m",
		targetResolution,
		encodeStageValue(arkTaskID),
		encodeStageValue(mediaKitTaskID),
	}, ":")
}

func parseTaskStage(value string) (taskStage, error) {
	parts := strings.Split(value, ":")
	if len(parts) < 5 || strings.Join(parts[:2], ":") != stagePrefix {
		return taskStage{}, fmt.Errorf("invalid DoubaoVideoMediaKit task stage")
	}
	if parts[3] != resolution720P && parts[3] != resolution1080P {
		return taskStage{}, fmt.Errorf("invalid target resolution in task stage")
	}

	stage := taskStage{TargetResolution: parts[3]}
	arkTaskID, err := decodeStageValue(parts[4])
	if err != nil || strings.TrimSpace(arkTaskID) == "" {
		return taskStage{}, fmt.Errorf("invalid Ark task ID in task stage")
	}
	stage.ArkTaskID = arkTaskID

	switch parts[2] {
	case "g":
		if len(parts) != 5 {
			return taskStage{}, fmt.Errorf("invalid generation task stage")
		}
		stage.Phase = stageGeneration
	case "m":
		if len(parts) != 6 {
			return taskStage{}, fmt.Errorf("invalid enhancement task stage")
		}
		mediaKitTaskID, decodeErr := decodeStageValue(parts[5])
		if decodeErr != nil || strings.TrimSpace(mediaKitTaskID) == "" {
			return taskStage{}, fmt.Errorf("invalid MediaKit task ID in task stage")
		}
		stage.Phase = stageEnhancement
		stage.MediaKitTaskID = mediaKitTaskID
	default:
		return taskStage{}, fmt.Errorf("unknown DoubaoVideoMediaKit task phase")
	}
	return stage, nil
}

func encodeStageValue(value string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(value))
}

func decodeStageValue(value string) (string, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(value)
	return string(decoded), err
}
