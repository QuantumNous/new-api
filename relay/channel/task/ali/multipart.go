package ali

import (
	"strings"

	"github.com/gin-gonic/gin"
)

func newFormatDefaultResolution(model string) (string, bool) {
	switch {
	case strings.HasPrefix(model, "wan2.7"):
		return "720P", true
	case strings.HasPrefix(model, "happyhorse-1.0"):
		return "1080P", true
	}
	return "", false
}

func isNewFormatModel(model string) bool {
	_, ok := newFormatDefaultResolution(model)
	return ok
}

// isVideoEditModel 同时匹配 wan2.7-videoedit（无连字符）与 happyhorse-1.0-video-edit（有连字符）。
func isVideoEditModel(model string) bool {
	return strings.Contains(model, "videoedit") || strings.Contains(model, "video-edit")
}

func imageMediaType(model string) string {
	if strings.Contains(model, "r2v") || isVideoEditModel(model) {
		return "reference_image"
	}
	return "first_frame"
}

func appendImageURLsAsMedia(aliReq *AliVideoRequest, mediaType string, urls []string) {
	for _, u := range urls {
		aliReq.Input.Media = append(aliReq.Input.Media, AliVideoMedia{
			Type: mediaType,
			URL:  u,
		})
	}
}

type mediaFieldDef struct {
	fieldName   string
	mediaTypeFn func(model string) string
}

var mediaFields = []mediaFieldDef{
	{
		fieldName:   "image_url",
		mediaTypeFn: imageMediaType,
	},
	{
		fieldName: "video_url",
		mediaTypeFn: func(model string) string {
			if isVideoEditModel(model) {
				return "video"
			}
			return "reference_video"
		},
	},
	{
		fieldName: "audio_url",
		mediaTypeFn: func(_ string) string {
			return "driving_audio"
		},
	},
}

func appendMultipartMediaToRequest(c *gin.Context, aliReq *AliVideoRequest) {
	if !isNewFormatModel(aliReq.Model) {
		return
	}
	for _, mf := range mediaFields {
		urls := c.PostFormArray(mf.fieldName)
		if len(urls) == 0 {
			continue
		}
		appendImageURLsAsMedia(aliReq, mf.mediaTypeFn(aliReq.Model), urls)
	}
}
