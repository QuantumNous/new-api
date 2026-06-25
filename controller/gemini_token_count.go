package controller

import (
	"strings"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

var geminiLoadFileSource = service.LoadFileSource

func normalizeGeminiTokenCountMeta(c *gin.Context, request *dto.GeminiChatRequest, meta *types.TokenCountMeta) error {
	if request == nil || meta == nil {
		return nil
	}

	fileIndex := 0
	for _, content := range request.Contents {
		for _, part := range content.Parts {
			if part.FileData != nil && strings.TrimSpace(part.FileData.FileUri) != "" {
				if fileIndex >= len(meta.Files) {
					return nil
				}
				if err := normalizeGeminiTokenCountFileMeta(c, part.FileData, meta.Files[fileIndex]); err != nil {
					return err
				}
				fileIndex++
			}
			if part.InlineData != nil && strings.TrimSpace(part.InlineData.Data) != "" {
				fileIndex++
			}
		}
	}

	return nil
}

func normalizeGeminiTokenCountFileMeta(c *gin.Context, fileData *dto.GeminiFileData, fileMeta *types.FileMeta) error {
	if fileData == nil || fileMeta == nil || fileMeta.Source == nil {
		return nil
	}

	mimeType := strings.TrimSpace(fileData.MimeType)
	if mimeType == "" && strings.Contains(fileData.FileUri, "www.youtube.com") {
		mimeType = "video/webm"
	}
	if mimeType == "" {
		if !fileData.ShouldDownload() {
			return nil
		}
		cachedData, err := geminiLoadFileSource(c, fileMeta.Source, "gemini token count")
		if err != nil {
			return err
		}
		mimeType = strings.TrimSpace(cachedData.MimeType)
	}
	if mimeType != "" {
		fileMeta.FileType = service.DetectFileType(mimeType)
	}

	return nil
}
