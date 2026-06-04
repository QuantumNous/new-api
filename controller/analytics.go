package controller

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

const analyticsDefaultLimit = 1000
const analyticsMaxLimit = 5000

type analyticsCursorResponse struct {
	Items      any    `json:"items"`
	Limit      int    `json:"limit"`
	HasMore    bool   `json:"has_more"`
	NextCursor string `json:"next_cursor,omitempty"`
}

func analyticsLimit(c *gin.Context) int {
	limit, _ := strconv.Atoi(c.Query("limit"))
	if limit <= 0 {
		return analyticsDefaultLimit
	}
	if limit > analyticsMaxLimit {
		return analyticsMaxLimit
	}
	return limit
}

func analyticsIdCursor(c *gin.Context) int {
	cursor, _ := strconv.Atoi(c.Query("cursor"))
	if cursor < 0 {
		return 0
	}
	return cursor
}

func analyticsTimestampRange(c *gin.Context) (int64, int64) {
	start, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	end, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if start < 0 {
		start = 0
	}
	if end < 0 {
		end = 0
	}
	return start, end
}

func analyticsLogCursor(c *gin.Context) (int64, int) {
	cursor := strings.TrimSpace(c.Query("cursor"))
	if cursor == "" {
		return 0, 0
	}
	parts := strings.Split(cursor, ":")
	if len(parts) != 2 {
		return 0, 0
	}
	createdAt, _ := strconv.ParseInt(parts[0], 10, 64)
	id, _ := strconv.Atoi(parts[1])
	if createdAt <= 0 || id <= 0 {
		return 0, 0
	}
	return createdAt, id
}

func analyticsAbilityCursor(c *gin.Context) (int, string, string) {
	cursor := strings.TrimSpace(c.Query("cursor"))
	if cursor == "" {
		return 0, "", ""
	}
	parts := strings.Split(cursor, ":")
	if len(parts) != 3 {
		return 0, "", ""
	}
	channelId, _ := strconv.Atoi(parts[0])
	group, _ := url.QueryUnescape(parts[1])
	modelName, _ := url.QueryUnescape(parts[2])
	if channelId <= 0 {
		return 0, "", ""
	}
	return channelId, group, modelName
}

func respondCursorRows[T any](c *gin.Context, rows []T, limit int, cursorOf func(T) string) {
	hasMore := len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}
	nextCursor := ""
	if hasMore && len(rows) > 0 {
		nextCursor = cursorOf(rows[len(rows)-1])
	}
	common.ApiSuccess(c, analyticsCursorResponse{
		Items:      rows,
		Limit:      limit,
		HasMore:    hasMore,
		NextCursor: nextCursor,
	})
}

func GetAnalyticsUsers(c *gin.Context) {
	limit := analyticsLimit(c)
	rows, err := model.AnalyticsListUsers(analyticsIdCursor(c), limit+1)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	respondCursorRows(c, rows, limit, func(row model.AnalyticsUserRow) string {
		return strconv.Itoa(row.Id)
	})
}

func GetAnalyticsLogs(c *gin.Context) {
	limit := analyticsLimit(c)
	start, end := analyticsTimestampRange(c)
	cursorCreatedAt, cursorId := analyticsLogCursor(c)
	rows, err := model.AnalyticsListLogs(start, end, cursorCreatedAt, cursorId, limit+1)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	respondCursorRows(c, rows, limit, func(row model.AnalyticsLogRow) string {
		return fmt.Sprintf("%d:%d", row.CreatedAt, row.Id)
	})
}

func GetAnalyticsQuotaData(c *gin.Context) {
	limit := analyticsLimit(c)
	start, end := analyticsTimestampRange(c)
	rows, err := model.AnalyticsListQuotaData(start, end, analyticsIdCursor(c), limit+1)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	respondCursorRows(c, rows, limit, func(row model.AnalyticsQuotaDataRow) string {
		return strconv.Itoa(row.Id)
	})
}

func GetAnalyticsSubscriptions(c *gin.Context) {
	limit := analyticsLimit(c)
	rows, err := model.AnalyticsListSubscriptions(analyticsIdCursor(c), limit+1)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	respondCursorRows(c, rows, limit, func(row model.AnalyticsSubscriptionRow) string {
		return strconv.Itoa(row.Id)
	})
}

func GetAnalyticsSubscriptionPlans(c *gin.Context) {
	limit := analyticsLimit(c)
	rows, err := model.AnalyticsListSubscriptionPlans(analyticsIdCursor(c), limit+1)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	respondCursorRows(c, rows, limit, func(row model.AnalyticsSubscriptionPlanRow) string {
		return strconv.Itoa(row.Id)
	})
}

func GetAnalyticsSubscriptionOrders(c *gin.Context) {
	limit := analyticsLimit(c)
	rows, err := model.AnalyticsListSubscriptionOrders(analyticsIdCursor(c), limit+1)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	respondCursorRows(c, rows, limit, func(row model.AnalyticsSubscriptionOrderRow) string {
		return strconv.Itoa(row.Id)
	})
}

func GetAnalyticsTopUps(c *gin.Context) {
	limit := analyticsLimit(c)
	rows, err := model.AnalyticsListTopUps(analyticsIdCursor(c), limit+1)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	respondCursorRows(c, rows, limit, func(row model.AnalyticsTopUpRow) string {
		return strconv.Itoa(row.Id)
	})
}

func GetAnalyticsChannels(c *gin.Context) {
	limit := analyticsLimit(c)
	rows, err := model.AnalyticsListChannels(analyticsIdCursor(c), limit+1)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	respondCursorRows(c, rows, limit, func(row model.AnalyticsChannelRow) string {
		return strconv.Itoa(row.Id)
	})
}

func GetAnalyticsAbilities(c *gin.Context) {
	limit := analyticsLimit(c)
	cursorChannelId, cursorGroup, cursorModel := analyticsAbilityCursor(c)
	rows, err := model.AnalyticsListAbilities(cursorChannelId, cursorGroup, cursorModel, limit+1)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	respondCursorRows(c, rows, limit, func(row model.AnalyticsAbilityRow) string {
		return fmt.Sprintf("%d:%s:%s", row.ChannelId, url.QueryEscape(row.Group), url.QueryEscape(row.Model))
	})
}
