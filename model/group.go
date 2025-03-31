package model

type Group struct {
	Id    int    `json:"id" gorm:"primaryKey"`
	Name  string `json:"name" gorm:"type:varchar(255);uniqueIndex;not null;default:''"`
	Ratio int    `json:"ratio" gorm:"type:int;not null;default:0"`
}
