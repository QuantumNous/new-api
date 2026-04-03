package ali

import (
	"strings"

	"github.com/gin-gonic/gin"
)

type mediaFieldDef struct {
	fieldName   string
	mediaTypeFn func(model string) string
}

var mediaFields = []mediaFieldDef{
	{
		fieldName: "image_url",
		mediaTypeFn: func(model string) string {
			if strings.Contains(model, "r2v") {
				return "reference_image"
			}
			return "first_frame"
		},
	},
	{
		fieldName: "video_url",
		mediaTypeFn: func(model string) string {
			if strings.Contains(model, "videoedit") {
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
	if !strings.HasPrefix(aliReq.Model, "wan2.7") {
		return
	}

	for _, mf := range mediaFields {
		urls := c.PostFormArray(mf.fieldName)
		if len(urls) == 0 {
			continue
		}
		mediaType := mf.mediaTypeFn(aliReq.Model)
		for _, u := range urls {
			aliReq.Input.Media = append(aliReq.Input.Media, AliVideoMedia{
				Type: mediaType,
				URL:  u,
			})
		}
	}
}
