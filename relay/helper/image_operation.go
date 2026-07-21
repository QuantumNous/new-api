package helper

import (
	"bytes"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
)

// ResolveImageOperation derives the public image operation independently from
// the provider protocol selected later. The unified generations endpoint uses
// edit capability profiles whenever the request carries an image or mask.
func ResolveImageOperation(relayMode int, model string, request *dto.ImageRequest) dto.ImageOperation {
	if relayMode == relayconstant.RelayModeImagesEdits {
		return dto.ImageOperationEdit
	}
	if request != nil && (hasImageOperationValue(request.Images) ||
		hasImageOperationValue(request.Image) ||
		hasImageOperationValue(request.Mask)) {
		return dto.ImageOperationEdit
	}
	if request != nil {
		multipartReferenceCount, multipartHasMask := request.MultipartImageSelectionMeta()
		if multipartReferenceCount > 0 || multipartHasMask {
			return dto.ImageOperationEdit
		}
	}
	if common.ImageModelCapabilitiesForModel(strings.TrimSpace(model)).ReferenceImagesRequired {
		return dto.ImageOperationEdit
	}
	return dto.ImageOperationGeneration
}

func hasImageOperationValue(raw []byte) bool {
	trimmed := bytes.TrimSpace(raw)
	return len(trimmed) > 0 && common.GetJsonType(trimmed) != "null"
}
