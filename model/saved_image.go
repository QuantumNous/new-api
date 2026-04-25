package model

type SavedImage struct {
	ID         int    `json:"-" gorm:"primaryKey;autoIncrement"`
	UserID     int    `json:"-" gorm:"index"`
	RequestID  string `json:"request_id" gorm:"type:varchar(64);index"`
	FilePath   string `json:"-" gorm:"type:text"`
	FileName   string `json:"file_name" gorm:"type:varchar(255)"`
	ImageIndex int    `json:"image_index" gorm:"default:0"`
	ImageSize  int64  `json:"image_size" gorm:"default:0"`
	CreatedAt  int64  `json:"created_at" gorm:"autoCreateTime"`
}

func CreateSavedImage(image *SavedImage) error {
	return DB.Create(image).Error
}

func GetSavedImagesByRequestID(userID int, requestID string) ([]*SavedImage, error) {
	var images []*SavedImage
	err := DB.Where("user_id = ? AND request_id = ?", userID, requestID).
		Order("image_index asc").
		Find(&images).Error
	return images, err
}

func DeleteExpiredSavedImages(beforeUnix int64) (int64, error) {
	result := DB.Where("created_at < ?", beforeUnix).Delete(&SavedImage{})
	return result.RowsAffected, result.Error
}
