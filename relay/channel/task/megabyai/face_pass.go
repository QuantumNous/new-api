package megabyai

import (
	"fmt"
	"mime/multipart"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel/task/facepass"
)

var imageURLBodyKeys = []string{
	"referenceImages", "images", "image", "input_reference",
}

var multipartImageKeys = []string{"image", "images", "input_reference", "referenceImages", "file"}

// megabyaiFacePassEnabled: nil/true => on; false => off.
func megabyaiFacePassEnabled(settings dto.ChannelOtherSettings) bool {
	return facepass.BoolDefaultTrue(settings.MegabyaiFacePass)
}

// megabyaiFaceSingleEye: nil/true => single eye (API default); false => both eyes.
func megabyaiFaceSingleEye(settings dto.ChannelOtherSettings) bool {
	return facepass.BoolDefaultTrue(settings.MegabyaiFaceSingleEye)
}

// megabyaiFaceSize: nil/out-of-range => 5; clamp to 1–10.
func megabyaiFaceSize(settings dto.ChannelOtherSettings) int {
	return facepass.ClampSize(settings.MegabyaiFaceSize)
}

func facePassOptionsFromSettings(settings dto.ChannelOtherSettings) facepass.Options {
	return facepass.NormalizeOptions(facepass.Options{
		SingleEye: megabyaiFaceSingleEye(settings),
		Size:      megabyaiFaceSize(settings),
	})
}

// applyFacePass downloads/reads reference images, locally preprocesses to WebP
// (max long edge 1600), uploads to face.83zi.com, and replaces body referenceImages.
func applyFacePass(body map[string]interface{}, fileBlobs [][]byte, proxy string, opts facepass.Options) error {
	if body == nil {
		body = map[string]interface{}{}
	}
	urls := facepass.CollectImageURLs(body, imageURLBodyKeys)
	outURLs, err := facepass.Process(fileBlobs, urls, proxy, opts, "megabyai_face_pass")
	if err != nil {
		return err
	}
	if len(outURLs) == 0 {
		return nil
	}
	for _, key := range imageURLBodyKeys {
		delete(body, key)
	}
	body["referenceImages"] = outURLs
	common.SysLog(fmt.Sprintf("[megabyai_face_pass] done count=%d referenceImages=%s", len(outURLs), strings.Join(outURLs, " | ")))
	return nil
}

func collectImageURLs(body map[string]interface{}) []string {
	return facepass.CollectImageURLs(body, imageURLBodyKeys)
}

func collectMultipartImageBlobs(form *multipart.Form) ([][]byte, error) {
	return facepass.CollectMultipartImageBlobs(form, multipartImageKeys)
}
