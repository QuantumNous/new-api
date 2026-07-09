package ali

import (
	"strings"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/pkg/errors"
	"github.com/samber/lo"
)

func (a *TaskAdaptor) buildKlingRequest(upstreamModel string, req relaycommon.TaskSubmitReq) (*AliVideoRequest, error) {
	aliReq := &AliVideoRequest{
		Model: upstreamModel,
		Input: AliVideoInput{
			Prompt: req.Prompt,
		},
		Parameters: &AliVideoParameters{
			Watermark:   lo.ToPtr(false),
			Mode:        lo.ToPtr(normalizeKlingMode(req.Mode, req.Size)),
			Duration:    resolveTaskDuration(req, 5),
			AspectRatio: lo.ToPtr("16:9"),
		},
	}

	if req.Metadata != nil {
		if mediaValue, ok := req.Metadata["media"]; ok {
			if err := decodeMetadataInto(mediaValue, &aliReq.Input.Media); err != nil {
				return nil, errors.Wrap(err, "decode kling media failed")
			}
		}
		if multiShot, ok := getBoolMetadata(req.Metadata, "multi_shot"); ok {
			aliReq.Input.MultiShot = lo.ToPtr(multiShot)
		}
		if shotType, ok := getStringMetadata(req.Metadata, "shot_type"); ok {
			aliReq.Input.ShotType = lo.ToPtr(shotType)
		}
		if multiPromptValue, ok := req.Metadata["multi_prompt"]; ok {
			if err := decodeMetadataInto(multiPromptValue, &aliReq.Input.MultiPrompt); err != nil {
				return nil, errors.Wrap(err, "decode kling multi_prompt failed")
			}
		}
		if elementListValue, ok := req.Metadata["element_list"]; ok {
			if err := decodeMetadataInto(elementListValue, &aliReq.Input.ElementList); err != nil {
				return nil, errors.Wrap(err, "decode kling element_list failed")
			}
		}
		if mode, ok := getStringMetadata(req.Metadata, "mode"); ok {
			aliReq.Parameters.Mode = lo.ToPtr(normalizeKlingMode(mode, ""))
		}
		if aspectRatio, ok := getStringMetadata(req.Metadata, "aspect_ratio"); ok {
			aliReq.Parameters.AspectRatio = lo.ToPtr(aspectRatio)
		} else if ratio, ok := getStringMetadata(req.Metadata, "ratio"); ok {
			aliReq.Parameters.AspectRatio = lo.ToPtr(ratio)
		}
		if audio, ok := getBoolMetadata(req.Metadata, "audio"); ok {
			aliReq.Parameters.Audio = lo.ToPtr(audio)
		}
		if watermark, ok := getBoolMetadata(req.Metadata, "watermark"); ok {
			aliReq.Parameters.Watermark = lo.ToPtr(watermark)
		}
	}

	if len(aliReq.Input.Media) == 0 {
		switch {
		case len(req.Videos) > 0:
			aliReq.Input.Media = append(aliReq.Input.Media, AliMediaItem{Type: "base", URL: req.Videos[0]})
			for _, url := range req.Images {
				aliReq.Input.Media = append(aliReq.Input.Media, AliMediaItem{Type: "refer", URL: url})
			}
		case len(req.Images) == 1:
			aliReq.Input.Media = []AliMediaItem{{Type: "first_frame", URL: req.Images[0]}}
		case len(req.Images) >= 2:
			aliReq.Input.Media = []AliMediaItem{
				{Type: "first_frame", URL: req.Images[0]},
				{Type: "last_frame", URL: req.Images[1]},
			}
		}
	}

	if err := validateBailianKlingPayload(upstreamModel, aliReq); err != nil {
		return nil, err
	}
	return aliReq, nil
}

func normalizeKlingMode(mode string, size string) string {
	if mode = strings.TrimSpace(mode); mode != "" {
		if strings.EqualFold(mode, "std") {
			return "std"
		}
		return "pro"
	}
	return modeFromSize(size)
}
