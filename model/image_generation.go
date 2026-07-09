package model

import (
	"strconv"

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
		imageURL = "/api/image-generations/" + strconv.Itoa(record.Id) + "/content"
	}
	if status == ImageGenerationStatusExpired {
		failReason = "图片已过期"
	}

	mjID := record.RequestId
	if record.ImageIndex > 0 {
		mjID = mjID + "#" + strconv.Itoa(record.ImageIndex+1)
	}

	return &Midjourney{
		Id:         -record.Id,
		Code:       1,
		UserId:     record.UserId,
		Action:     "IMAGE_GENERATION",
		MjId:       mjID,
		Prompt:     record.Prompt,
		PromptEn:   record.ModelName,
		SubmitTime: record.CreatedAt * 1000,
		StartTime:  record.CreatedAt * 1000,
		FinishTime: record.CreatedAt * 1000,
		ImageUrl:   imageURL,
		Status:     status,
		Progress:   "100%",
		FailReason: failReason,
		ChannelId:  record.ChannelId,
		Quota:      record.Quota,
	}
}
