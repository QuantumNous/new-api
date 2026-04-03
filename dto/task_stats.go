package dto

type TaskStatsBreakdown struct {
	Running int64 `json:"running"`
	Success int64 `json:"success"`
	Failure int64 `json:"failure"`
}

type TaskDailyCount struct {
	Date  string `json:"date"`
	Total int64  `json:"total"`
}

type TaskStatsResponse struct {
	RunningCount int64              `json:"running_count"`
	DailyCounts  []TaskDailyCount   `json:"daily_counts"`
	ImageStats   TaskStatsBreakdown `json:"image_stats"`
	VideoStats   TaskStatsBreakdown `json:"video_stats"`
}
