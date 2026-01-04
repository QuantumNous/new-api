package model

import "gorm.io/gorm"

type PlaygroundHistory struct {
	gorm.Model
	UserId   int    `json:"user_id" gorm:"index"`
	Title    string `json:"title" gorm:"type:varchar(255)"`
	Messages string `json:"messages" gorm:"type:text"` // JSON string
	ModelName string `json:"model" gorm:"type:varchar(100);column:model"`
	Group    string `json:"group" gorm:"type:varchar(50)"`
}

func (h *PlaygroundHistory) Create() error {
	return DB.Create(h).Error
}

func (h *PlaygroundHistory) Update() error {
	return DB.Model(h).Updates(h).Error
}

func (h *PlaygroundHistory) Delete() error {
	return DB.Delete(h).Error
}

func GetPlaygroundHistories(userId int, page int, pageSize int) ([]*PlaygroundHistory, int64, error) {
	var histories []*PlaygroundHistory
	var total int64
	
	offset := (page - 1) * pageSize
	err := DB.Model(&PlaygroundHistory{}).Where("user_id = ?", userId).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	
	err = DB.Where("user_id = ?", userId).Order("updated_at desc").Limit(pageSize).Offset(offset).Find(&histories).Error
	return histories, total, err
}

func GetPlaygroundHistory(id int, userId int) (*PlaygroundHistory, error) {
	var history PlaygroundHistory
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(&history).Error
	return &history, err
}
