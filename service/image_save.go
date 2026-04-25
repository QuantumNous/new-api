package service

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	ImageSaveDir            = "./data/images"
	ImageSaveChargePerImage = 25000 // 0.05 元/张 (0.05 * QuotaPerUnit)
	ImageRetentionDays      = 7
)

// SaveImageFromResponse parses the image response body and saves images to disk asynchronously.
// It charges the user for each successfully saved image.
func SaveImageFromResponse(info *relaycommon.RelayInfo, responseBody []byte) {
	var imageResp dto.ImageResponse
	if err := common.Unmarshal(responseBody, &imageResp); err != nil {
		common.SysError(fmt.Sprintf("failed to parse image response for saving: %s", err.Error()))
		return
	}

	if len(imageResp.Data) == 0 {
		return
	}

	userId := info.UserId
	requestId := info.RequestId
	data := imageResp.Data

	gopool.Go(func() {
		savedCount := 0
		dateDir := time.Now().Format("2006-01-02")
		saveDir := filepath.Join(ImageSaveDir, dateDir)
		if err := os.MkdirAll(saveDir, 0755); err != nil {
			common.SysError("failed to create image save dir: " + err.Error())
			return
		}

		for i, img := range data {
			var imageBytes []byte
			var err error

			if img.B64Json != "" {
				imageBytes, err = base64.StdEncoding.DecodeString(img.B64Json)
				if err != nil {
					common.SysError(fmt.Sprintf("failed to decode base64 image %d for request %s: %s", i, requestId, err.Error()))
					continue
				}
			} else if img.Url != "" {
				imageBytes, err = downloadImage(img.Url)
				if err != nil {
					common.SysError(fmt.Sprintf("failed to download image %d for request %s: %s", i, requestId, err.Error()))
					continue
				}
			} else {
				continue
			}

			fileName := fmt.Sprintf("%s_%d.png", requestId, i)
			filePath := filepath.Join(saveDir, fileName)
			if err := os.WriteFile(filePath, imageBytes, 0644); err != nil {
				common.SysError(fmt.Sprintf("failed to write image file %d for request %s: %s", i, requestId, err.Error()))
				continue
			}

			savedImage := &model.SavedImage{
				UserID:     userId,
				RequestID:  requestId,
				FilePath:   filePath,
				FileName:   fileName,
				ImageIndex: i,
				ImageSize:  int64(len(imageBytes)),
			}
			if err := model.CreateSavedImage(savedImage); err != nil {
				common.SysError(fmt.Sprintf("failed to save image record %d for request %s: %s", i, requestId, err.Error()))
				os.Remove(filePath)
				continue
			}
			savedCount++
		}

		if savedCount > 0 {
			totalCharge := savedCount * ImageSaveChargePerImage
			if err := model.DecreaseUserQuota(userId, totalCharge, false); err != nil {
				common.SysError(fmt.Sprintf("failed to charge image save fee for user %d: %s", userId, err.Error()))
			}
		}
	})
}

func downloadImage(url string) ([]byte, error) {
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

// CleanupExpiredImages removes saved images older than ImageRetentionDays.
func CleanupExpiredImages() {
	beforeUnix := time.Now().AddDate(0, 0, -ImageRetentionDays).Unix()

	var images []*model.SavedImage
	model.DB.Where("created_at < ?", beforeUnix).Find(&images)

	for _, img := range images {
		os.Remove(img.FilePath)
	}

	count, err := model.DeleteExpiredSavedImages(beforeUnix)
	if err != nil {
		common.SysError("failed to cleanup expired images: " + err.Error())
		return
	}
	if count > 0 {
		common.SysLog(fmt.Sprintf("cleaned up %d expired saved images", count))
	}
}

// StartImageCleanupTask starts a background goroutine that periodically cleans up expired images.
func StartImageCleanupTask() {
	gopool.Go(func() {
		// Run once at startup
		CleanupExpiredImages()
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			CleanupExpiredImages()
		}
	})
}
