package model

type DashboardModelUsage struct {
	Tokens             int64
	Quota              int64
	Requests           int64
	SuccessfulRequests int64
	TotalUseTime       int64
}

type DashboardDailyUsage struct {
	Quota    int64
	Requests int64
	Tokens   int64
}

type DashboardUsage struct {
	Tokens             int64
	Quota              int64
	Requests           int64
	SuccessfulRequests int64
	TotalUseTime       int64
	Models             map[string]*DashboardModelUsage
	HourlyRequests     [24]int64
	Daily              map[int64]*DashboardDailyUsage
}

// GetUserDashboardUsage aggregates request logs in Go so time bucketing has
// identical behavior on SQLite, MySQL, PostgreSQL, and the optional log store.
func GetUserDashboardUsage(userID int, startTimestamp, endTimestamp int64, timezoneOffsetMinutes int) (DashboardUsage, error) {
	usage := DashboardUsage{
		Models: make(map[string]*DashboardModelUsage),
		Daily:  make(map[int64]*DashboardDailyUsage),
	}
	rows, err := LOG_DB.Table("logs").
		Select("created_at, type, model_name, quota, prompt_tokens, completion_tokens, use_time").
		Where("user_id = ? AND type IN ? AND created_at >= ? AND created_at < ?", userID, []int{LogTypeConsume, LogTypeError}, startTimestamp, endTimestamp).
		Rows()
	if err != nil {
		return usage, err
	}
	defer rows.Close()

	offsetSeconds := int64(timezoneOffsetMinutes) * 60
	for rows.Next() {
		var createdAt int64
		var logType int
		var modelName string
		var quota, promptTokens, completionTokens, useTime int64
		if err := rows.Scan(&createdAt, &logType, &modelName, &quota, &promptTokens, &completionTokens, &useTime); err != nil {
			return usage, err
		}

		localTimestamp := createdAt + offsetSeconds
		dayStart := localTimestamp - localTimestamp%86400
		hour := int(localTimestamp % 86400 / 3600)
		if hour < 0 || hour >= len(usage.HourlyRequests) {
			continue
		}

		usage.Requests++
		usage.HourlyRequests[hour]++
		day := usage.Daily[dayStart]
		if day == nil {
			day = &DashboardDailyUsage{}
			usage.Daily[dayStart] = day
		}
		day.Requests++

		modelUsage := usage.Models[modelName]
		if modelUsage == nil {
			modelUsage = &DashboardModelUsage{}
			usage.Models[modelName] = modelUsage
		}
		modelUsage.Requests++
		if logType != LogTypeConsume {
			continue
		}

		if quota < 0 {
			quota = 0
		}
		if promptTokens < 0 {
			promptTokens = 0
		}
		if completionTokens < 0 {
			completionTokens = 0
		}
		if useTime < 0 {
			useTime = 0
		}
		tokens := promptTokens + completionTokens
		usage.SuccessfulRequests++
		usage.Quota += quota
		usage.Tokens += tokens
		usage.TotalUseTime += useTime
		day.Quota += quota
		day.Tokens += tokens
		modelUsage.SuccessfulRequests++
		modelUsage.Quota += quota
		modelUsage.Tokens += tokens
		modelUsage.TotalUseTime += useTime
	}
	if err := rows.Err(); err != nil {
		return usage, err
	}
	return usage, nil
}
