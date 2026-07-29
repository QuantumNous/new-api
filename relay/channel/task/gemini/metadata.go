package gemini

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

type rawMessage []byte

func (m *rawMessage) UnmarshalJSON(data []byte) error {
	if m == nil {
		return fmt.Errorf("rawMessage: UnmarshalJSON on nil pointer")
	}
	*m = append((*m)[0:0], data...)
	return nil
}

type VeoMetadataFeatures struct {
	HasImage           bool
	HasLastFrame       bool
	HasReferenceImages bool
}

// ApplyVeoMetadataToInstance moves Veo instance-level fields from request
// metadata into the upstream instance. Supported metadata fields are:
// image/firstFrame/first_frame, lastFrame/last_frame, and
// referenceImages/reference_images.
func ApplyVeoMetadataToInstance(metadata map[string]any, instance *VeoInstance) (VeoMetadataFeatures, error) {
	var features VeoMetadataFeatures
	if metadata == nil || instance == nil {
		return features, nil
	}

	raw, err := rawMetadata(metadata)
	if err != nil {
		return features, err
	}

	imageRaw := firstRaw(raw["image"], raw["firstFrame"], raw["first_frame"])
	if hasRaw(imageRaw) {
		image, err := parseVeoImageMetadata(imageRaw)
		if err != nil {
			return features, fmt.Errorf("invalid metadata image: %w", err)
		}
		instance.Image = image
		features.HasImage = true
	}

	lastFrameRaw := firstRaw(raw["lastFrame"], raw["last_frame"])
	if hasRaw(lastFrameRaw) {
		lastFrame, err := parseVeoImageMetadata(lastFrameRaw)
		if err != nil {
			return features, fmt.Errorf("invalid metadata lastFrame: %w", err)
		}
		instance.LastFrame = lastFrame
		features.HasLastFrame = true
	}

	referenceImagesRaw := firstRaw(raw["referenceImages"], raw["reference_images"])
	if hasRaw(referenceImagesRaw) {
		referenceImages, err := parseVeoReferenceImagesMetadata(referenceImagesRaw)
		if err != nil {
			return features, fmt.Errorf("invalid metadata referenceImages: %w", err)
		}
		instance.ReferenceImages = referenceImages
		features.HasReferenceImages = len(referenceImages) > 0
	}

	return features, nil
}

func rawMetadata(metadata map[string]any) (map[string]rawMessage, error) {
	data, err := common.Marshal(metadata)
	if err != nil {
		return nil, fmt.Errorf("marshal metadata failed: %w", err)
	}
	var raw map[string]rawMessage
	if err := common.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("unmarshal metadata failed: %w", err)
	}
	return raw, nil
}

func firstRaw(values ...rawMessage) rawMessage {
	for _, value := range values {
		if hasRaw(value) {
			return value
		}
	}
	return nil
}

func hasRaw(raw rawMessage) bool {
	trimmed := bytes.TrimSpace([]byte(raw))
	return len(trimmed) > 0 && !bytes.Equal(trimmed, []byte("null"))
}

func parseVeoImageMetadata(raw rawMessage) (*VeoImageInput, error) {
	trimmed := bytes.TrimSpace([]byte(raw))
	if len(trimmed) == 0 {
		return nil, fmt.Errorf("empty image")
	}

	if trimmed[0] == '"' {
		var imageStr string
		if err := common.Unmarshal(trimmed, &imageStr); err != nil {
			return nil, err
		}
		imageStr = strings.TrimSpace(imageStr)
		if strings.HasPrefix(imageStr, "{") {
			return parseVeoImageMetadata(rawMessage(imageStr))
		}
		if image := ParseImageInput(imageStr); image != nil {
			return image, nil
		}
		return nil, fmt.Errorf("image string must be a data URI or base64 image")
	}

	var wire struct {
		InlineData         *VeoInlineData `json:"inlineData"`
		BytesBase64Encoded string         `json:"bytesBase64Encoded"`
		MimeType           string         `json:"mimeType"`
		Data               string         `json:"data"`
	}
	if err := common.Unmarshal(trimmed, &wire); err != nil {
		return nil, err
	}
	if wire.InlineData != nil {
		if wire.InlineData.Data == "" {
			return nil, fmt.Errorf("inlineData.data is required")
		}
		if wire.InlineData.MimeType == "" {
			wire.InlineData.MimeType = "application/octet-stream"
		}
		return &VeoImageInput{InlineData: wire.InlineData}, nil
	}
	if wire.BytesBase64Encoded != "" {
		return NewVeoImageInput(wire.BytesBase64Encoded, defaultMimeType(wire.MimeType)), nil
	}
	if wire.Data != "" {
		return NewVeoImageInput(wire.Data, defaultMimeType(wire.MimeType)), nil
	}
	return nil, fmt.Errorf("image.inlineData is required")
}

func parseVeoReferenceImagesMetadata(raw rawMessage) ([]VeoReferenceImage, error) {
	trimmed := bytes.TrimSpace([]byte(raw))
	if len(trimmed) == 0 {
		return nil, nil
	}
	if trimmed[0] == '"' {
		var rawStr string
		if err := common.Unmarshal(trimmed, &rawStr); err != nil {
			return nil, err
		}
		rawStr = strings.TrimSpace(rawStr)
		if !strings.HasPrefix(rawStr, "[") {
			return nil, fmt.Errorf("referenceImages string must contain a JSON array")
		}
		trimmed = []byte(rawStr)
	}

	var items []rawMessage
	if err := common.Unmarshal(trimmed, &items); err != nil {
		return nil, err
	}

	out := make([]VeoReferenceImage, 0, len(items))
	for i, itemRaw := range items {
		imageRaw, referenceType, err := parseVeoReferenceImageItem(itemRaw)
		if err != nil {
			return nil, fmt.Errorf("referenceImages[%d]: %w", i, err)
		}
		image, err := parseVeoImageMetadata(imageRaw)
		if err != nil {
			return nil, fmt.Errorf("referenceImages[%d].image: %w", i, err)
		}
		out = append(out, VeoReferenceImage{
			Image:         image,
			ReferenceType: referenceType,
		})
	}
	return out, nil
}

func parseVeoReferenceImageItem(raw rawMessage) (rawMessage, string, error) {
	trimmed := bytes.TrimSpace([]byte(raw))
	if len(trimmed) == 0 {
		return nil, "", fmt.Errorf("empty reference image")
	}
	if trimmed[0] == '"' {
		return raw, "asset", nil
	}

	var item struct {
		Image              rawMessage `json:"image"`
		ReferenceType      string     `json:"referenceType"`
		ReferenceTypeSnake string     `json:"reference_type"`
	}
	if err := common.Unmarshal(trimmed, &item); err != nil {
		return nil, "", err
	}
	if hasRaw(item.Image) {
		referenceType := item.ReferenceType
		if referenceType == "" {
			referenceType = item.ReferenceTypeSnake
		}
		return item.Image, referenceType, nil
	}

	// Allow a bare image object as a shorthand reference image.
	return raw, "asset", nil
}

func defaultMimeType(mimeType string) string {
	if strings.TrimSpace(mimeType) == "" {
		return "application/octet-stream"
	}
	return mimeType
}
