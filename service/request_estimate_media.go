package service

import (
	"context"
	"fmt"
	"image"
	"io"
	"mime"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
)

func BindRequestEstimateMediaInfo(c *gin.Context, files []*types.FileMeta) error {
	value, exists := c.Get(common.RequestEstimateMediaInfoContextKey)
	if !exists {
		return nil
	}
	facts, ok := value.([]common.RequestEstimateMediaInfo)
	if !ok {
		return fmt.Errorf("invalid request media facts")
	}
	formFacts := make([]common.RequestEstimateMediaInfo, 0, len(facts))
	for _, fact := range facts {
		if fact.Field != "" {
			mediaType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
			if err != nil || fact.Type != "audio" || fact.Field != "file" || mediaType != "multipart/form-data" {
				return fmt.Errorf("multipart media facts only support audio")
			}
			formFacts = append(formFacts, fact)
			continue
		}
		if fact.Type != "image" {
			return fmt.Errorf("JSON media facts only support image dimensions")
		}
		matched := false
		for _, file := range files {
			if file == nil || file.Source == nil || file.Source.GetRawData() != fact.PointerValue {
				continue
			}
			if string(file.FileType) != fact.Type {
				return fmt.Errorf("media_info type does not match request media")
			}
			matched = true
			break
		}
		if !matched {
			return fmt.Errorf("media_info pointer does not identify request media")
		}
	}
	if len(formFacts) > 0 {
		form, err := common.ParseMultipartFormReusable(c)
		if err != nil {
			return fmt.Errorf("media_info requires a valid multipart request: %w", err)
		}
		for _, fact := range formFacts {
			files := form.File[fact.Field]
			if fact.Index >= len(files) || files[fact.Index] == nil {
				return fmt.Errorf("media_info field does not identify request media")
			}
		}
	}
	c.Set(common.RequestEstimateMediaInfoContextKey, facts)
	return nil
}

func requestEstimateMediaFact(c *gin.Context, pointerValue, field string, index int, mediaType string) (common.RequestEstimateMediaInfo, bool) {
	value, exists := c.Get(common.RequestEstimateMediaInfoContextKey)
	if !exists {
		return common.RequestEstimateMediaInfo{}, false
	}
	facts, ok := value.([]common.RequestEstimateMediaInfo)
	if !ok {
		return common.RequestEstimateMediaInfo{}, false
	}
	for _, fact := range facts {
		if fact.Type != mediaType {
			continue
		}
		if pointerValue != "" && fact.PointerValue == pointerValue {
			return fact, true
		}
		if field != "" && fact.Field == field && fact.Index == index {
			return fact, true
		}
	}
	return common.RequestEstimateMediaInfo{}, false
}

func requestEstimateImageConfig(c *gin.Context, rawURL string) (image.Config, string, error) {
	response, err := requestEstimateDoDownload(c, rawURL)
	if err != nil {
		return image.Config{}, "", err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return image.Config{}, "", fmt.Errorf("media URL returned status %d", response.StatusCode)
	}
	maxFileMB := constant.MaxFileDownloadMB
	if maxFileMB <= 0 {
		maxFileMB = 64
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, (int64(maxFileMB)<<20)+1))
	if err != nil {
		return image.Config{}, "", err
	}
	if int64(len(data)) > int64(maxFileMB)<<20 {
		return image.Config{}, "", fmt.Errorf("media file exceeds the configured size limit")
	}
	return decodeImageConfig(data)
}

func requestEstimateDoDownload(c *gin.Context, rawURL string) (*http.Response, error) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	response, err := DoDownloadRequestContext(ctx, rawURL, "request_estimate")
	if err != nil {
		cancel()
		return nil, err
	}
	response.Body = &requestEstimateResponseBody{ReadCloser: response.Body, cancel: cancel}
	return response, nil
}

type requestEstimateResponseBody struct {
	io.ReadCloser
	cancel context.CancelFunc
}

func (b *requestEstimateResponseBody) Close() error {
	err := b.ReadCloser.Close()
	b.cancel()
	return err
}
