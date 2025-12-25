package model

import "time"

type UserCallHourly struct {
	HourStartTs int64     `json:"hour_start_ts" gorm:"primaryKey;autoIncrement:false;index:idx_hour_calls,priority:1;index:idx_user_hour,priority:2;comment:hour start unix seconds, aligned to 3600s"`
	UserId      int       `json:"user_id" gorm:"primaryKey;autoIncrement:false;index:idx_hour_calls,priority:3;index:idx_user_hour,priority:1;comment:user id"`
	Username    string    `json:"username" gorm:"size:64;not null;default:'';comment:denormalized username for display"`
	TotalCalls  int       `json:"total_calls" gorm:"not null;default:0;index:idx_hour_calls,priority:2;comment:total calls in this hour"`
	SuccessCalls int      `json:"success_calls" gorm:"not null;default:0;comment:successful calls in this hour (best-effort)"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (UserCallHourly) TableName() string {
	return "user_call_hourly"
}