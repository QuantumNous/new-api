package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/google/uuid"
)

const MaxDrawingBytes = int64(32 << 20)
const MaxDrawingResponseBytes = int64(48 << 20)

var DrawingRatios = map[string]string{
	"1:1": "1024x1024", "3:4": "864x1152", "16:9": "1536x864", "4:3": "1152x864",
	"9:16": "864x1536", "2:3": "1024x1536", "3:2": "1536x1024", "21:9": "1792x768",
}

func DrawingOption(key, fallback string) string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if value := strings.TrimSpace(common.OptionMap[key]); value != "" {
		return value
	}
	return fallback
}

func DrawingMaxCount() int {
	n, err := strconv.Atoi(DrawingOption("DrawingBatchMaxCount", "20"))
	if err != nil || n < 1 || n > 100 {
		return 20
	}
	return n
}

func DrawingConcurrency() int {
	n, err := strconv.Atoi(DrawingOption("DrawingBatchConcurrency", "4"))
	if err != nil || n < 1 || n > 16 {
		return 4
	}
	return n
}

func DrawingSize(modelName, ratio string) (string, error) {
	if ImageUpscaleTarget(modelName) != 0 {
		return ProImageSizeForRatio(modelName, ratio)
	}
	size, ok := DrawingRatios[ratio]
	if !ok {
		return "", errors.New("Unsupported aspect ratio")
	}
	name := strings.ToLower(modelName)
	if strings.HasPrefix(name, "dall-e") && ratio != "1:1" {
		return "", errors.New("This model does not support the exact selected ratio")
	}
	if (name == "gpt-image-1" || name == "gpt-image-1-mini" || name == "gpt-image-1.5") && ratio != "1:1" && ratio != "2:3" && ratio != "3:2" {
		return "", errors.New("This model does not support the exact selected ratio")
	}
	return size, nil
}

func DrawingStorageDir() string {
	if dir := os.Getenv("DRAWING_STORAGE_DIR"); dir != "" {
		return dir
	}
	return filepath.Join("data", "drawing-temporary")
}

func DrawingFile(id, suffix string) (string, error) {
	parsed, err := uuid.Parse(id)
	if err != nil || parsed.String() != id {
		return "", errors.New("Invalid drawing ID")
	}
	if suffix != ".image" && suffix != ".input" && suffix != ".response" {
		return "", errors.New("Invalid drawing file type")
	}
	return filepath.Join(DrawingStorageDir(), id+suffix), nil
}

func WriteDrawingFile(id, suffix string, data []byte) error {
	path, err := DrawingFile(id, suffix)
	if err != nil {
		return err
	}
	if err = os.MkdirAll(DrawingStorageDir(), 0700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(DrawingStorageDir(), "write-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err = tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err = tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err = tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}

func DrawingImageInfo(data []byte) (image.Config, string, error) {
	if len(data) == 0 || int64(len(data)) > MaxDrawingBytes {
		return image.Config{}, "", errors.New("Image exceeds the size limit")
	}
	info, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || (format != "png" && format != "jpeg" && format != "webp") {
		return image.Config{}, "", errors.New("Only PNG, JPEG and WebP images are supported")
	}
	if info.Width <= 0 || info.Height <= 0 || info.Width > 16384 || info.Height > 16384 || int64(info.Width)*int64(info.Height) > 64_000_000 {
		return image.Config{}, "", errors.New("Image dimensions exceed the limit")
	}
	return info, "image/" + format, nil
}

// The response spool is retained on download/storage failure, so recovery never
// calls the billable image-generation endpoint again.
func SaveDrawingResponse(ctx context.Context, item *model.DrawingItem) error {
	path, err := DrawingFile(item.ID, ".response")
	if err != nil {
		return err
	}
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()
	var response struct {
		Data []struct {
			URL    string `json:"url"`
			Base64 string `json:"b64_json"`
		} `json:"data"`
	}
	if err = common.DecodeJson(io.LimitReader(file, MaxDrawingResponseBytes), &response); err != nil || len(response.Data) != 1 {
		return errors.New("Upstream did not return exactly one image")
	}
	var data []byte
	if response.Data[0].Base64 != "" {
		data, err = base64.StdEncoding.DecodeString(response.Data[0].Base64)
	} else if response.Data[0].URL != "" {
		if err = ValidateSSRFProtectedFetchURL(response.Data[0].URL); err != nil {
			return err
		}
		request, reqErr := http.NewRequestWithContext(ctx, http.MethodGet, response.Data[0].URL, nil)
		if reqErr != nil {
			return reqErr
		}
		res, fetchErr := GetSSRFProtectedHTTPClient().Do(request)
		if fetchErr != nil {
			return fetchErr
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			return fmt.Errorf("Image download failed (%d)", res.StatusCode)
		}
		data, err = io.ReadAll(io.LimitReader(res.Body, MaxDrawingBytes+1))
	} else {
		return errors.New("Upstream returned no image")
	}
	if err != nil {
		return err
	}
	info, mime, err := DrawingImageInfo(data)
	if err != nil {
		return err
	}
	if err = WriteDrawingFile(item.ID, ".image", data); err != nil {
		return err
	}
	item.Width, item.Height, item.Mime = info.Width, info.Height, mime
	return nil
}

func CleanupDrawings(now int64) error {
	var expired []model.DrawingItem
	if err := model.DB.Where("expires_at <= ? AND status NOT IN ?", now, []string{"running", "recovering", "expired"}).Limit(500).Find(&expired).Error; err != nil {
		return err
	}
	for _, item := range expired {
		claim := model.DB.Model(&model.DrawingItem{}).Where("id = ? AND expires_at <= ? AND status = ?", item.ID, now, item.Status).Update("status", "deleting")
		if claim.Error != nil {
			return claim.Error
		}
		if claim.RowsAffected != 1 {
			continue
		}
		for _, suffix := range []string{".image", ".response"} {
			path, err := DrawingFile(item.ID, suffix)
			if err != nil {
				return err
			}
			if err = os.Remove(path); err != nil && !os.IsNotExist(err) {
				return err
			}
		}
		if err := model.DB.Model(&model.DrawingItem{}).Where("id = ? AND expires_at <= ? AND status NOT IN ?", item.ID, now, []string{"running", "recovering"}).Updates(map[string]any{"status": "expired", "prompt": "", "title": "", "error": "", "mime": ""}).Error; err != nil {
			return err
		}
	}
	var batches []model.DrawingBatch
	if err := model.DB.Where("expires_at <= ?", now).Limit(500).Find(&batches).Error; err != nil {
		return err
	}
	for _, batch := range batches {
		var active int64
		if err := model.DB.Model(&model.DrawingItem{}).Where("batch_id = ? AND (expires_at > ? OR status IN ?)", batch.ID, now, []string{"running", "recovering"}).Count(&active).Error; err != nil {
			return err
		}
		if active != 0 {
			continue
		}
		path, err := DrawingFile(batch.ID, ".input")
		if err != nil {
			return err
		}
		if err = os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
		// Keep a small submission tombstone for 24h to prevent replaying an old submit.
		if batch.CreatedAt < now-86400 {
			if err := model.DB.Where("batch_id = ?", batch.ID).Delete(&model.DrawingItem{}).Error; err != nil {
				return err
			}
			if err := model.DB.Delete(&batch).Error; err != nil {
				return err
			}
		}
	}
	// Clean abandoned files (e.g. process crash between file write and DB insert).
	entries, err := os.ReadDir(DrawingStorageDir())
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if info.ModTime().Unix() > now-model.DrawingLifetime {
			continue
		}
		name := entry.Name()
		suffix := filepath.Ext(name)
		id := strings.TrimSuffix(name, suffix)
		var count int64
		switch suffix {
		case ".image", ".response":
			err = model.DB.Model(&model.DrawingItem{}).Where("id = ? AND (expires_at > ? OR status IN ?)", id, now, []string{"running", "recovering"}).Count(&count).Error
		case ".input":
			err = model.DB.Model(&model.DrawingBatch{}).Where("id = ? AND expires_at > ?", id, now).Count(&count).Error
		default:
			if !strings.HasPrefix(name, "write-") {
				continue
			}
		}
		if err != nil {
			return err
		}
		if count == 0 {
			if err = os.Remove(filepath.Join(DrawingStorageDir(), name)); err != nil && !os.IsNotExist(err) {
				return err
			}
		}
	}
	return nil
}

func DrawingNow() int64 { return time.Now().Unix() }
