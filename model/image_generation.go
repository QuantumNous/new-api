package model

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const (
	ImageGenerationStatusSuccess = "SUCCESS"
	ImageGenerationStatusExpired = "EXPIRED"
)

type ImageGeneration struct {
	Id         int    `json:"id"`
	UserId     int    `json:"user_id" gorm:"index"`
	TokenId    int    `json:"token_id" gorm:"index"`
	ChannelId  int    `json:"channel_id" gorm:"index"`
	RequestId  string `json:"request_id" gorm:"type:varchar(64);index"`
	ImageIndex int    `json:"image_index" gorm:"index"`
	ModelName  string `json:"model_name" gorm:"index"`
	Prompt     string `json:"prompt" gorm:"type:text"`
	Size       string `json:"size" gorm:"type:varchar(64)"`
	Quality    string `json:"quality" gorm:"type:varchar(64)"`
	Quota      int    `json:"quota"`
	FilePath   string `json:"file_path" gorm:"type:text"`
	MimeType   string `json:"mime_type" gorm:"type:varchar(64)"`
	Status     string `json:"status" gorm:"type:varchar(20);index"`
	Group      string `json:"group" gorm:"index"`
	CreatedAt  int64  `json:"created_at" gorm:"bigint;index"`
	UseTime    int64  `json:"use_time" gorm:"bigint"`
	ExpireAt   int64  `json:"expire_at" gorm:"bigint;index"`
}

func InsertImageGeneration(record *ImageGeneration) error {
	return DB.Create(record).Error
}

func GetImageGenerationByID(id int) (*ImageGeneration, error) {
	var record ImageGeneration
	err := DB.Where("id = ?", id).First(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func GetExpiredImageGenerations(now int64, limit int) ([]*ImageGeneration, error) {
	var records []*ImageGeneration
	err := DB.Where("status = ? AND expire_at <= ?", ImageGenerationStatusSuccess, now).
		Limit(limit).
		Find(&records).Error
	return records, err
}

func MarkImageGenerationExpired(id int) error {
	return DB.Model(&ImageGeneration{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":    ImageGenerationStatusExpired,
			"file_path": "",
		}).Error
}

func imageGenerationQuery(queryParams TaskQueryParams, userId *int) *gorm.DB {
	tx := DB.Model(&ImageGeneration{})
	if userId != nil {
		tx = tx.Where("user_id = ?", *userId)
	}
	if queryParams.ChannelID != "" {
		tx = tx.Where("channel_id = ?", queryParams.ChannelID)
	}
	if queryParams.MjID != "" {
		tx = tx.Where("request_id = ?", queryParams.MjID)
	}
	if startTimestamp := taskTimestampMillisToSeconds(queryParams.StartTimestamp); startTimestamp > 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp := taskTimestampMillisToSeconds(queryParams.EndTimestamp); endTimestamp > 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	return tx
}

func GetAllImageGenerationTasks(startIdx int, num int, queryParams TaskQueryParams, userId *int) []*Midjourney {
	var records []*ImageGeneration
	err := imageGenerationQuery(queryParams, userId).
		Order("created_at desc, id desc").
		Limit(num).
		Offset(startIdx).
		Find(&records).Error
	if err != nil {
		return nil
	}

	items := make([]*Midjourney, 0, len(records))
	for _, record := range records {
		items = append(items, imageGenerationToMidjourney(record))
	}
	return items
}

func CountAllImageGenerationTasks(queryParams TaskQueryParams, userId *int) int64 {
	var total int64
	_ = imageGenerationQuery(queryParams, userId).Count(&total).Error
	return total
}

func imageGenerationToMidjourney(record *ImageGeneration) *Midjourney {
	imageURL := ""
	failReason := ""
	status := record.Status
	if status == "" {
		status = ImageGenerationStatusSuccess
	}
	if status == ImageGenerationStatusSuccess && record.FilePath != "" {
		imageURL = imageGenerationContentURL(record)
	}
	if status == ImageGenerationStatusExpired {
		failReason = "图片已过期"
	}

	mjID := record.RequestId
	if record.ImageIndex > 0 {
		mjID = mjID + "#" + strconv.Itoa(record.ImageIndex+1)
	}
	useTime := imageGenerationUseTimeSeconds(record)
	submitTime := record.CreatedAt * 1000
	if useTime > 0 {
		submitTime = (record.CreatedAt - useTime) * 1000
	}

	return &Midjourney{
		Id:         -record.Id,
		Code:       1,
		UserId:     record.UserId,
		Action:     "IMAGE_GENERATION",
		MjId:       mjID,
		Prompt:     imageGenerationPrompt(record),
		PromptEn:   record.ModelName,
		SubmitTime: submitTime,
		StartTime:  submitTime,
		FinishTime: record.CreatedAt * 1000,
		ImageUrl:   imageURL,
		Status:     status,
		Progress:   "100%",
		FailReason: failReason,
		ChannelId:  record.ChannelId,
		Quota:      record.Quota,
	}
}

func imageGenerationPrompt(record *ImageGeneration) string {
	parts := make([]string, 0, 4)
	if record.Size != "" {
		parts = append(parts, "大小 "+record.Size)
	}
	if record.Quality != "" {
		parts = append(parts, "品质 "+record.Quality)
	}
	parts = append(parts, "生成数量 1")
	if record.Prompt != "" {
		parts = append(parts, "提示词 "+record.Prompt)
	}
	return strings.Join(parts, ", ")
}

func imageGenerationUseTimeSeconds(record *ImageGeneration) int64 {
	if record.UseTime > 0 {
		return record.UseTime
	}
	if record.RequestId == "" {
		return 0
	}
	var log Log
	result := LOG_DB.Model(&Log{}).
		Select("use_time").
		Where("request_id = ? AND type = ? AND use_time > 0", record.RequestId, LogTypeConsume).
		Order("id desc").
		Limit(1).
		Find(&log)
	if result.Error != nil || result.RowsAffected == 0 {
		return 0
	}
	if log.UseTime < 0 {
		return 0
	}
	return int64(log.UseTime)
}

func imageGenerationContentURL(record *ImageGeneration) string {
	if record == nil {
		return ""
	}
	expires := record.ExpireAt
	if expires <= 0 {
		expires = record.CreatedAt + 7*24*60*60
	}
	return fmt.Sprintf(
		"/api/image-generations/%d/content?expires=%d&signature=%s",
		record.Id,
		expires,
		GenerateImageGenerationContentSignature(record, expires),
	)
}

func GenerateImageGenerationContentSignature(record *ImageGeneration, expires int64) string {
	if record == nil {
		return ""
	}
	payload := fmt.Sprintf(
		"image-generation-content:%d:%d:%d:%s:%s:%d",
		record.Id,
		record.UserId,
		expires,
		record.FilePath,
		record.Status,
		record.ExpireAt,
	)
	return common.GenerateHMAC(payload)
}

func ValidateImageGenerationContentSignature(record *ImageGeneration, expires int64, signature string) bool {
	if record == nil || signature == "" || expires <= time.Now().Unix() {
		return false
	}
	if record.ExpireAt > 0 && expires > record.ExpireAt {
		return false
	}
	expected := GenerateImageGenerationContentSignature(record, expires)
	return expected != "" && expected == signature
}
