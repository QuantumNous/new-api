package model

type GroupAlias struct {
	Id            uint     `json:"id" gorm:"primaryKey;autoIncrement"`
	Alias         string   `json:"alias" gorm:"type:varchar(64);uniqueIndex;not null"`
	TargetGroup   string   `json:"target_group" gorm:"type:varchar(64);not null;index"`
	RatioOverride *float64 `json:"ratio_override"`
	CreatedAt     int64    `json:"created_at" gorm:"bigint;autoCreateTime"`
	UpdatedAt     int64    `json:"updated_at" gorm:"bigint;autoUpdateTime"`
}

func (GroupAlias) TableName() string {
	return "group_aliases"
}

type AliasResolved struct {
	TargetGroup   string   `json:"target_group"`
	RatioOverride *float64 `json:"ratio_override"`
}

func GetAllGroupAliases() ([]GroupAlias, error) {
	var aliases []GroupAlias
	err := DB.Order("id ASC").Find(&aliases).Error
	return aliases, err
}

func GetGroupAliasByAlias(alias string) (*GroupAlias, error) {
	var ga GroupAlias
	err := DB.Where("alias = ?", alias).First(&ga).Error
	if err != nil {
		return nil, err
	}
	return &ga, nil
}

func GetGroupAliasByID(id uint) (*GroupAlias, error) {
	var ga GroupAlias
	err := DB.First(&ga, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &ga, nil
}

func GetGroupAliasesByTarget(targetGroup string) ([]GroupAlias, error) {
	var aliases []GroupAlias
	err := DB.Where("target_group = ?", targetGroup).Find(&aliases).Error
	return aliases, err
}

func CreateGroupAlias(alias *GroupAlias) error {
	return DB.Create(alias).Error
}

func UpdateGroupAlias(alias *GroupAlias) error {
	return DB.Save(alias).Error
}

func DeleteGroupAlias(id uint) error {
	return DB.Delete(&GroupAlias{}, "id = ?", id).Error
}
