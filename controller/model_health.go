package controller

import (
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type modelHealthHourlyRespItem struct {
	ModelName     string  `json:"model_name"`
	HourStartTs   int64   `json:"hour_start_ts"`
	SuccessSlices int64   `json:"success_slices"`
	TotalSlices   int64   `json:"total_slices"`
	SuccessRate   float64 `json:"success_rate"`
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
	sort.Slice(hours, func(i, j int) bool { return hours[i] < hours[j] })
	return hours, true, nil
}

func isAlignedHour(ts int64) bool {
	return ts > 0 && ts%3600 == 0
}

// GetModelHealthHourlyStatsAPI 查询模型在小时 bucket 上的健康度（success_slices/total_slices/success_rate）。
// 参数：
// - model_name: string (required)
// - start_hour: unix seconds, aligned to 3600 (optional when hours provided)
// - end_hour: unix seconds, aligned to 3600, exclusive (optional when hours provided)
// - hours: comma separated unix seconds list, aligned to 3600 (optional)
func GetModelHealthHourlyStatsAPI(c *gin.Context) {
	modelName := strings.TrimSpace(c.Query("model_name"))
	if modelName == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "model_name is required"})
		return
	}

	hours, hasHours, err := parseHourListParam(c.Query("hours"))
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var startHourTs int64
	var endHourTs int64
	if hasHours {
		for _, h := range hours {
			if !isAlignedHour(h) {
				c.JSON(http.StatusOK, gin.H{"success": false, "message": "hours must be aligned to hour (ts % 3600 == 0)"})
				return
			}
		}
		startHourTs = hours[0]
		endHourTs = hours[len(hours)-1] + 3600
	} else {
		startHourTs, _ = strconv.ParseInt(c.Query("start_hour"), 10, 64)
		endHourTs, _ = strconv.ParseInt(c.Query("end_hour"), 10, 64)
		if !isAlignedHour(startHourTs) || !isAlignedHour(endHourTs) || endHourTs <= startHourTs {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid hour range, require start_hour/end_hour aligned to hour and end_hour > start_hour"})
			return
		}
		// limit range to 31 days to avoid large scan (best-effort guardrail)
		if endHourTs-startHourTs > 31*24*3600 {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "hour range too large (max 31 days)"})
			return
		}
	}

	rows, err := model.GetModelHealthHourlyStats(model.DB, modelName, startHourTs, endHourTs)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	rowMap := make(map[int64]model.ModelHealthHourlyStat, len(rows))
	for _, r := range rows {
		rowMap[r.HourStartTs] = r
	}

	var wantHours []int64
	if hasHours {
		wantHours = hours
	} else {
		count := int((endHourTs - startHourTs) / 3600)
		wantHours = make([]int64, 0, count)
		for h := startHourTs; h < endHourTs; h += 3600 {
			wantHours = append(wantHours, h)
		}
	}

	resp := make([]modelHealthHourlyRespItem, 0, len(wantHours))
	for _, h := range wantHours {
		if stat, ok := rowMap[h]; ok {
			resp = append(resp, modelHealthHourlyRespItem{
				ModelName:     stat.ModelName,
				HourStartTs:   stat.HourStartTs,
				SuccessSlices: stat.SuccessSlices,
				TotalSlices:   stat.TotalSlices,
				SuccessRate:   stat.SuccessRate,
			})
			continue
		}
		resp = append(resp, modelHealthHourlyRespItem{
			ModelName:     modelName,
			HourStartTs:   h,
			SuccessSlices: 0,
			TotalSlices:   0,
			SuccessRate:   0,
		})
	}

	common.ApiSuccess(c, resp)
}