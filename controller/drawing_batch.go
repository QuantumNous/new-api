package controller

import (
	"archive/zip"
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type DrawingPlanItem struct {
	Title  string `json:"title"`
	Prompt string `json:"prompt"`
}
type drawingSubmission struct {
	ExpectedAgentPriceVersion *int64            `json:"expected_agent_price_version,omitempty"`
	SubmissionID              string            `json:"submission_id"`
	Model                     string            `json:"model"`
	Group                     string            `json:"group"`
	Ratio                     string            `json:"ratio"`
	Prompt                    string            `json:"prompt"`
	Count                     *int              `json:"count"`
	Items                     []DrawingPlanItem `json:"items"`
}

func drawingError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"error": gin.H{"message": message}})
}

func DrawingSettings(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{"max_count": service.DrawingMaxCount(), "lifetime_seconds": model.DrawingLifetime})
}

func validateDrawingSubmission(input *drawingSubmission) string {
	if _, err := uuid.Parse(input.SubmissionID); err != nil {
		return "Invalid submission ID"
	}
	if len(input.Model) == 0 || len(input.Model) > 200 || len(input.Group) == 0 || len(input.Group) > 100 {
		return "Model and group are required"
	}
	if _, err := service.DrawingSize(input.Model, input.Ratio); err != nil {
		return err.Error()
	}
	count := 1
	if input.Count != nil {
		count = *input.Count
	}
	if count < 1 || count > service.DrawingMaxCount() {
		return "Image count exceeds the allowed range"
	}
	if len(input.Items) == 0 {
		if strings.TrimSpace(input.Prompt) == "" || len(input.Prompt) > 16000 {
			return "Prompt is required and must be within 16000 bytes"
		}
		items, message := splitDrawingRequirements(input.Prompt, count)
		if message != "" {
			return message
		}
		if len(items) > 0 {
			input.Items = items
		} else {
			for i := 0; i < count; i++ {
				input.Items = append(input.Items, DrawingPlanItem{Title: fmt.Sprintf("%02d", i+1), Prompt: input.Prompt})
			}
		}
	}
	if len(input.Items) != count {
		return "Plan must contain exactly the requested image count"
	}
	for _, item := range input.Items {
		if strings.TrimSpace(item.Prompt) == "" || len(item.Prompt) > 16000 || len(item.Title) > 200 {
			return "Invalid image plan"
		}
	}
	return ""
}

func CreateDrawingBatch(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, service.MaxDrawingBytes+(1<<20))
	if err := c.Request.ParseMultipartForm(1 << 20); err != nil {
		drawingError(c, 400, "Invalid or oversized drawing request")
		return
	}
	defer c.Request.MultipartForm.RemoveAll()
	var input drawingSubmission
	if err := common.UnmarshalJsonStr(c.PostForm("request"), &input); err != nil {
		drawingError(c, 400, "Invalid drawing request")
		return
	}
	if message := validateDrawingSubmission(&input); message != "" {
		drawingError(c, 400, message)
		return
	}
	user, err := model.GetUserCache(c.GetInt("id"))
	if err != nil {
		drawingError(c, 500, "Unable to load user")
		return
	}
	if input.Group != user.Group && !service.GroupInUserUsableGroups(user.Group, input.Group) {
		drawingError(c, 403, "Model or group access denied")
		return
	}
	var reference []byte
	if headers := c.Request.MultipartForm.File["image"]; len(headers) > 0 {
		if len(headers) != 1 {
			drawingError(c, 400, "Upload one reference image")
			return
		}
		file, err := headers[0].Open()
		if err != nil {
			drawingError(c, 400, "Unable to read reference image")
			return
		}
		reference, err = io.ReadAll(io.LimitReader(file, service.MaxDrawingBytes+1))
		file.Close()
		if err != nil {
			drawingError(c, 400, "Unable to read reference image")
			return
		}
		if _, _, err = service.DrawingImageInfo(reference); err != nil {
			drawingError(c, 400, err.Error())
			return
		}
	}
	now := service.DrawingNow()
	batch := &model.DrawingBatch{ID: uuid.NewString(), UserID: c.GetInt("id"), SubmissionID: input.SubmissionID, Model: input.Model, Group: input.Group, Ratio: input.Ratio, HasReference: len(reference) > 0, CreatedAt: now, ExpiresAt: now + model.DrawingLifetime}
	hashInput := input
	hashInput.ExpectedAgentPriceVersion = nil
	encoded, err := common.Marshal(hashInput)
	if err != nil {
		drawingError(c, 500, "Unable to create drawing task")
		return
	}
	hash := sha256.New()
	hash.Write(encoded)
	hash.Write(reference)
	batch.RequestHash = fmt.Sprintf("%x", hash.Sum(nil))
	existing, lookupErr := model.GetDrawingSubmission(batch.UserID, input.SubmissionID)
	if lookupErr != nil {
		drawingError(c, 503, "Unable to load drawing tasks")
		return
	}
	if existing != nil {
		if existing.RequestHash != batch.RequestHash {
			drawingError(c, 409, "Submission already used or too many pending images")
			return
		}
		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusAccepted, existing)
		return
	}
	if input.Model == model.AgentImageModel {
		quote, quoteErr := service.ResolveAgentImageQuote(batch.UserID, input.Model)
		if quoteErr != nil {
			drawingError(c, 503, "Unable to determine the image price")
			return
		}
		if input.ExpectedAgentPriceVersion != nil {
			currentVersion := int64(0)
			if quote != nil {
				currentVersion = quote.Version
			}
			if *input.ExpectedAgentPriceVersion != currentVersion {
				drawingError(c, 409, "Image price changed; review the new price and submit again")
				return
			}
		}
		batch.AgentQuoteLocked = true
		if quote != nil {
			snapshot, marshalErr := common.Marshal(quote)
			if marshalErr != nil {
				drawingError(c, 500, "Unable to save the image price")
				return
			}
			batch.AgentQuoteJSON = string(snapshot)
		}
	}
	for i, item := range input.Items {
		batch.Items = append(batch.Items, model.DrawingItem{ID: uuid.NewString(), BatchID: batch.ID, UserID: batch.UserID, Position: i + 1, Title: item.Title, Prompt: item.Prompt, Status: "queued", ExpiresAt: batch.ExpiresAt})
	}
	newID := batch.ID
	if batch.HasReference {
		if err = service.WriteDrawingFile(newID, ".input", reference); err != nil {
			drawingError(c, 500, "Unable to save reference image")
			return
		}
	}
	batch, err = model.CreateDrawingBatch(batch, service.DrawingMaxCount()*2)
	if err != nil || batch.ID != newID {
		if path, pathErr := service.DrawingFile(newID, ".input"); pathErr == nil {
			_ = os.Remove(path)
		}
	}
	if err != nil {
		drawingError(c, 409, "Submission already used or too many pending images")
		return
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusAccepted, batch)
}

func ListDrawingBatches(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	now := service.DrawingNow()
	batches, err := model.ListDrawingBatches(c.GetInt("id"), now)
	if err != nil {
		drawingError(c, 500, "Unable to load drawing tasks")
		return
	}
	if batches == nil {
		batches = []model.DrawingBatch{}
	}
	for b := range batches {
		for i := range batches[b].Items {
			item := &batches[b].Items[i]
			if item.ExpiresAt <= now && item.Status != "running" && item.Status != "recovering" {
				item.Status = "expired"
				item.Prompt = ""
				item.Title = ""
			}
		}
	}
	c.JSON(http.StatusOK, batches)
}

func loadDrawingImage(c *gin.Context) (*model.DrawingItem, *os.File) {
	c.Header("Cache-Control", "private, no-store, max-age=0")
	c.Header("X-Content-Type-Options", "nosniff")
	var item model.DrawingItem
	if err := model.DB.Where("id = ? AND user_id = ?", c.Param("id"), c.GetInt("id")).First(&item).Error; err != nil {
		drawingError(c, 404, "Image not found")
		return nil, nil
	}
	if item.ExpiresAt <= service.DrawingNow() {
		drawingError(c, http.StatusGone, "Image expired")
		return nil, nil
	}
	if item.Status != "succeeded" {
		drawingError(c, 409, "Image is not ready")
		return nil, nil
	}
	path, err := service.DrawingFile(item.ID, ".image")
	if err != nil {
		drawingError(c, 404, "Image not found")
		return nil, nil
	}
	file, err := os.Open(path)
	if err != nil {
		drawingError(c, 404, "Image file unavailable")
		return nil, nil
	}
	return &item, file
}

func DrawingImage(c *gin.Context) {
	item, file := loadDrawingImage(c)
	if file == nil {
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		drawingError(c, 500, "Unable to read image")
		return
	}
	c.Header("Content-Type", item.Mime)
	if c.Query("download") == "1" {
		c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%02d.%s"`, item.Position, drawingExtension(item.Mime)))
	}
	c.DataFromReader(http.StatusOK, info.Size(), item.Mime, file, nil)
}

func drawingExtension(mime string) string {
	if mime == "image/jpeg" {
		return "jpg"
	}
	if mime == "image/webp" {
		return "webp"
	}
	return "png"
}

func DownloadDrawingBatch(c *gin.Context) {
	c.Header("Cache-Control", "private, no-store, max-age=0")
	batch, err := model.GetDrawingBatch(c.GetInt("id"), c.Param("id"))
	if err != nil {
		drawingError(c, 404, "Batch not found")
		return
	}
	// Prepare all files before writing ZIP headers; never silently return an incomplete archive.
	var files []*os.File
	var items []model.DrawingItem
	var totalBytes int64
	defer func() {
		for _, file := range files {
			file.Close()
		}
	}()
	for _, item := range batch.Items {
		if item.Status != "succeeded" || item.ExpiresAt <= service.DrawingNow() {
			continue
		}
		path, pathErr := service.DrawingFile(item.ID, ".image")
		if pathErr != nil {
			drawingError(c, 500, "Unable to prepare archive")
			return
		}
		file, openErr := os.Open(path)
		if openErr != nil {
			drawingError(c, 409, "An image file is unavailable")
			return
		}
		files = append(files, file)
		info, statErr := file.Stat()
		if statErr != nil {
			drawingError(c, 500, "Unable to prepare archive")
			return
		}
		totalBytes += info.Size()
		if totalBytes > 256<<20 {
			drawingError(c, 413, "Archive is too large; download images individually")
			return
		}
		items = append(items, item)
	}
	if len(files) == 0 {
		drawingError(c, http.StatusGone, "No unexpired images to download")
		return
	}
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", `attachment; filename="ai-drawing-`+batch.ID+`.zip"`)
	c.Header("X-Drawing-Image-Count", fmt.Sprint(len(files)))
	archive := zip.NewWriter(c.Writer)
	for i, file := range files {
		entry, zipErr := archive.CreateHeader(&zip.FileHeader{Name: fmt.Sprintf("%02d.%s", items[i].Position, drawingExtension(items[i].Mime)), Method: zip.Store})
		if zipErr != nil {
			return
		}
		if _, zipErr = io.Copy(entry, file); zipErr != nil {
			return
		}
	}
	if err = archive.Close(); err != nil {
		common.SysError("drawing archive download interrupted")
	}
}

func RetryDrawing(c *gin.Context) {
	var input struct {
		Confirm bool `json:"confirm_additional_charge"`
	}
	if err := common.DecodeJson(io.LimitReader(c.Request.Body, 1024), &input); err != nil {
		drawingError(c, 400, "Invalid retry request")
		return
	}
	if err := model.RetryDrawingItem(c.GetInt("id"), c.Param("id"), service.DrawingNow(), input.Confirm, service.DrawingMaxCount()*2); err != nil {
		drawingError(c, 409, err.Error())
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"success": true})
}

func RecoverDrawing(c *gin.Context) {
	item, err := model.ClaimDrawingRecovery(c.GetInt("id"), c.Param("id"), service.DrawingNow(), service.DrawingConcurrency())
	if err != nil {
		drawingError(c, 409, "Image recovery is unavailable, expired or busy")
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Minute)
	defer cancel()
	if item.Status != "unknown" {
		item.Status, item.Error = "storage_failed", "Image received but not saved; recover without generating again"
	}
	if err := service.SaveDrawingResponse(ctx, item); err == nil {
		item.Status, item.Error = "succeeded", ""
	}
	if err := model.FinishDrawingItem(item); err != nil {
		drawingError(c, 500, "Unable to save image status")
		return
	}
	c.JSON(http.StatusOK, item)
}
