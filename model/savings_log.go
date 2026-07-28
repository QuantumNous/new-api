package model

type SavingsLogRow struct {
	Id               int
	CreatedAt        int64
	ModelName        string
	PromptTokens     int
	CompletionTokens int
	Quota            int
	Other            string
}

func CountUserSavingsConsumeLogs(userId int, startTimestamp int64, endTimestamp int64) (int64, error) {
	var total int64
	err := LOG_DB.Model(&Log{}).
		Where("user_id = ? AND type = ? AND created_at >= ? AND created_at < ?", userId, LogTypeConsume, startTimestamp, endTimestamp).
		Count(&total).Error
	return total, err
}

func GetUserSavingsConsumeLogs(userId int, startTimestamp int64, endTimestamp int64, limit int) ([]SavingsLogRow, error) {
	rows := make([]SavingsLogRow, 0)
	if limit <= 0 {
		return rows, nil
	}
	err := LOG_DB.Model(&Log{}).
		Select("id", "created_at", "model_name", "prompt_tokens", "completion_tokens", "quota", "other").
		Where("user_id = ? AND type = ? AND created_at >= ? AND created_at < ?", userId, LogTypeConsume, startTimestamp, endTimestamp).
		Order("created_at asc, id asc").
		Limit(limit).
		Find(&rows).Error
	return rows, err
}
