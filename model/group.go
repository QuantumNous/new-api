package model

type Group struct {
	Id        int    `json:"id" gorm:"primaryKey"`
	Name      string `json:"name" gorm:"type:varchar(255);uniqueIndex;not null;default:''"`
	Ratio     int    `json:"ratio" gorm:"type:int;not null;default:0"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt int64  `json:"updated_at" gorm:"autoUpdateTime"`
}
