package service

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

const imageGenerationRetention = 7 * 24 * time.Hour

func imageGenerationStorageDir() string {
	if dir := strings.TrimSpace(os.Getenv("IMAGE_GENERATION_STORAGE_DIR")); dir != "" {
		return dir
	}
	if info, err := os.Stat("/data"); err == nil && info.IsDir() {
		return "/data/image-generations"
	}
	return "data/image-generations"
}

func imageGenerationFilePath(relativePath string) string {
	cleanPath := filepath.Clean(relativePath)
	if filepath.IsAbs(cleanPath) || cleanPath == ".." || strings.HasPrefix(cleanPath, ".."+string(os.PathSeparator)) {
		return filepath.Join(imageGenerationStorageDir(), "_invalid")
	}
	return filepath.Join(imageGenerationStorageDir(), cleanPath)
}

func SaveImageGenerationResponse(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ImageRequest, responseBody []byte, quota int) {
	if len(responseBody) == 0 || request == nil || info == nil {
		return
	}

	var imageResponse dto.ImageResponse
	if err := common.Unmarshal(responseBody, &imageResponse); err != nil {
		logger.LogWarn(c, "failed to parse image generation response for storage: "+err.Error())
		return
	}
	if len(imageResponse.Data) == 0 {
		return
	}

	now := time.Now()
	useTimeSeconds := int64(0)
	if !info.StartTime.IsZero() {
		useTimeSeconds = int64(now.Sub(info.StartTime).Seconds())
		if useTimeSeconds < 0 {
			useTimeSeconds = 0
		}
	}
	requestID := c.GetString(common.RequestIdKey)
	if requestID == "" {
		requestID = common.GetUUID()
	}
	perImageQuota := quota
	if len(imageResponse.Data) > 0 {
		perImageQuota = quota / len(imageResponse.Data)
	}

	for index, item := range imageResponse.Data {
		if strings.TrimSpace(item.B64Json) == "" {
			continue
		}
		mimeType, ext, raw, err := decodeImageGenerationBase64(item.B64Json)
		if err != nil {
			logger.LogWarn(c, fmt.Sprintf("failed to decode image generation response image %d: %s", index, err.Error()))
			continue
		}

		relativeDir := filepath.Join(now.Format("20060102"), fmt.Sprintf("user-%d", info.UserId))
		filename := fmt.Sprintf("%s-%d.%s", requestID, index, ext)
		relativePath := filepath.Join(relativeDir, filename)
		absolutePath := imageGenerationFilePath(relativePath)
		if err := os.MkdirAll(filepath.Dir(absolutePath), 0750); err != nil {
			logger.LogError(c, "failed to create image generation storage dir: "+err.Error())
			continue
		}
		if err := os.WriteFile(absolutePath, raw, 0600); err != nil {
			logger.LogError(c, "failed to write image generation file: "+err.Error())
			continue
		}

		recordQuota := perImageQuota
		if index == len(imageResponse.Data)-1 {
			recordQuota = quota - perImageQuota*(len(imageResponse.Data)-1)
		}
		quality := request.Quality
		if quality == "" {
			quality = "standard"
		}
		record := &model.ImageGeneration{
			UserId:     info.UserId,
			TokenId:    info.TokenId,
			ChannelId:  info.ChannelId,
			RequestId:  requestID,
			ImageIndex: index,
			ModelName:  info.OriginModelName,
			Prompt:     request.Prompt,
			Size:       request.Size,
			Quality:    quality,
			Quota:      recordQuota,
			FilePath:   relativePath,
			MimeType:   mimeType,
			Status:     model.ImageGenerationStatusSuccess,
			Group:      info.UsingGroup,
			CreatedAt:  now.Unix(),
			UseTime:    useTimeSeconds,
			ExpireAt:   now.Add(imageGenerationRetention).Unix(),
		}
		if err := model.InsertImageGeneration(record); err != nil {
			logger.LogError(c, "failed to insert image generation record: "+err.Error())
			_ = os.Remove(absolutePath)
		}
	}
}

func decodeImageGenerationBase64(data string) (mimeType string, ext string, raw []byte, err error) {
	if commaIndex := strings.Index(data, ","); commaIndex >= 0 {
		data = data[commaIndex+1:]
	}
	raw, err = base64.StdEncoding.DecodeString(strings.TrimSpace(data))
	if err != nil {
		return "", "", nil, err
	}
	mimeType = http.DetectContentType(raw)
	switch mimeType {
	case "image/png":
		ext = "png"
	case "image/jpeg":
		ext = "jpg"
	case "image/webp":
		ext = "webp"
	case "image/gif":
		ext = "gif"
	default:
		if strings.HasPrefix(mimeType, "image/") {
			ext = strings.TrimPrefix(mimeType, "image/")
		} else {
			mimeType = "image/png"
			ext = "png"
		}
	}
	return mimeType, ext, raw, nil
}

func StartImageGenerationCleanupTask() {
	go func() {
		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()
		for {
			CleanupExpiredImageGenerations()
			<-ticker.C
		}
	}()
}

func CleanupExpiredImageGenerations() {
	for {
		records, err := model.GetExpiredImageGenerations(time.Now().Unix(), 100)
		if err != nil {
			logger.LogError(context.Background(), "failed to query expired image generations: "+err.Error())
			return
		}
		if len(records) == 0 {
			return
		}
		for _, record := range records {
			if record.FilePath != "" {
				_ = os.Remove(imageGenerationFilePath(record.FilePath))
			}
			if err := model.MarkImageGenerationExpired(record.Id); err != nil {
				logger.LogError(context.Background(), "failed to mark image generation expired: "+err.Error())
			}
		}
	}
}

func GetImageGenerationAbsolutePath(record *model.ImageGeneration) string {
	if record == nil || record.FilePath == "" {
		return ""
	}
	return imageGenerationFilePath(record.FilePath)
}
