package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type userHourlyCallsRankRespItem struct {
	UserId     int    `json:"user_id"`
	Username   string `json:"username,omitempty"`
	TotalCalls int64  `json:"total_calls"`
}

func parseHourListParam(raw string) ([]int64, bool, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, false, nil
	}
	parts := strings.Split(raw, ",")
	hours := make([]int64, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		ts, err := strconv.ParseInt(p, 10, 64)
		if err != nil {
			return nil, true, err
		}
		hours = append(hours, ts)
	}
	if len(hours) == 0 {
		return nil, false, nil
	}
	return hours, true, nil
}

func isAlignedHour(ts int64) bool {
	return ts > 0 && ts%3600 == 0
}

// GetUserHourlyCallsRankAPI
// GET /api/user_rank/hourly_calls
// 参数：
// - hours: unix 秒整点列表（逗号分隔）
// - start_hour/end_hour: unix 秒整点，end 开区间（当 hours 未提供时使用）
// - limit: 默认 50，最大 500
func GetUserHourlyCallsRankAPI(c *gin.Context) {
	limit, _ := strconv.Atoi(c.Query("limit"))
	if limit <= 0 {
		limit = 50
	}

	hours, hasHours, err := parseHourListParam(c.Query("hours"))
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var startHourTs int64
	var endHourTs int64
	if hasHours {
		normalized, err := model.NormalizeHourList(hours)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
			return
		}
		hours = normalized
	} else {
		startHourTs, _ = strconv.ParseInt(c.Query("start_hour"), 10, 64)
		endHourTs, _ = strconv.ParseInt(c.Query("end_hour"), 10, 64)
		if !isAlignedHour(startHourTs) || !isAlignedHour(endHourTs) || endHourTs <= startHourTs {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid hour range, require start_hour/end_hour aligned to hour and end_hour > start_hour"})
			return
		}
	}

	rows, err := model.GetUserHourlyCallsRank(model.DB, hours, startHourTs, endHourTs, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	resp := make([]userHourlyCallsRankRespItem, 0, len(rows))
	for _, r := range rows {
		resp = append(resp, userHourlyCallsRankRespItem{
			UserId:     r.UserId,
			Username:   r.Username,
			TotalCalls: r.TotalCalls,
		})
	}

	common.ApiSuccess(c, resp)
}