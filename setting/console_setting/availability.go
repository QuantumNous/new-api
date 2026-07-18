package console_setting

// AvailabilityStatusFromSuccessRate maps overall success rate to badge status.
// total == 0 → ok (no data yet).
func AvailabilityStatusFromSuccessRate(successRate float64, total int) string {
	if total <= 0 {
		return "ok"
	}
	if successRate >= 0.95 {
		return "ok"
	}
	if successRate >= 0.80 {
		return "warn"
	}
	return "error"
}

func SummarizeAvailabilityRecords(okCount int, total int, successUseTimeSum int) (successRate float64, avgUseTime float64, status string) {
	if total <= 0 {
		return 0, 0, "ok"
	}
	successRate = float64(okCount) / float64(total)
	if okCount > 0 {
		avgUseTime = float64(successUseTimeSum) / float64(okCount)
	}
	status = AvailabilityStatusFromSuccessRate(successRate, total)
	return successRate, avgUseTime, status
}
