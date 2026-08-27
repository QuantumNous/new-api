package model

type ChannelStateSnapshot struct {
	ID     int
	Type   int
	Status int
}

func ListChannelStateSnapshots() ([]ChannelStateSnapshot, error) {
	var snapshots []ChannelStateSnapshot
	err := DB.Model(&Channel{}).
		Select("id", "type", "status").
		Order("id ASC").
		Find(&snapshots).Error
	return snapshots, err
}
