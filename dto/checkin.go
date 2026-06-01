package dto

// CheckinRecord mirrors model.CheckinRecord to avoid import cycle.
type CheckinRecord struct {
	CheckinDate  string `json:"checkin_date"`
	QuotaAwarded int    `json:"quota_awarded"`
}

type CheckinStats struct {
	TotalQuota     int64           `json:"total_quota"`
	TotalCheckins  int64           `json:"total_checkins"`
	CheckinCount   int             `json:"checkin_count"`
	CheckedInToday bool            `json:"checked_in_today"`
	Records        []CheckinRecord `json:"records"`
}

type CheckinStatusData struct {
	Enabled  bool         `json:"enabled"`
	MinQuota int          `json:"min_quota"`
	MaxQuota int          `json:"max_quota"`
	Stats    CheckinStats `json:"stats"`
}

type CheckinResultData struct {
	QuotaAwarded int    `json:"quota_awarded"`
	CheckinDate  string `json:"checkin_date"`
}
