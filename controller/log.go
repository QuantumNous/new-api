package controller

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// maxLogUsageExportRangeSeconds bounds the single-shot reconciliation CSV
// export. That endpoint streams one unsegmented aggregate and keeps its
// historical 31 day bound.
const maxLogUsageExportRangeSeconds int64 = 31 * 24 * 60 * 60

// logUsageAnalysisSegmentTimeout is the per-segment query budget. The dashboard
// analysis endpoint may span up to common.DashboardMaxRangeDays, which the model
// layer splits into at most common.MaxDashboardRangeSegments bounded segments;
// the overall budget therefore scales with the segment count but stays capped.
const logUsageAnalysisSegmentTimeout = 5 * time.Second
const maxLogUsageAnalysisTimeout = logUsageAnalysisSegmentTimeout * time.Duration(common.MaxDashboardRangeSegments)

var allowedLogAnalysisDimensions = map[string]bool{
	"period":     true,
	"username":   true,
	"token_name": true,
	"model_name": true,
	"group":      true,
	"channel":    true,
}

// Keep the automatic dashboard query bounded by low-cardinality dimensions.
// Administrators can still request additional dimensions explicitly, but the
// initial page load must not fan out across user/token/group/channel values.
var defaultLogAnalysisDimensions = []string{"period", "model_name"}

type logUsageAnalysisResponse struct {
	Rows          []model.LogUsageAnalysisRow `json:"rows"`
	Granularity   string                      `json:"granularity"`
	Dimensions    []string                    `json:"dimensions"`
	MarginStatus  string                      `json:"margin_status"`
	CostBasisNote string                      `json:"cost_basis_note"`
}

// logUsageRangeBound describes how a handler bounds its requested time range.
// The reconciliation export keeps its single-statement 31 day bound; the
// dashboard analysis uses the shared, segmented dashboard bound.
type logUsageRangeBound struct {
	maxSeconds  int64
	tooLargeErr error
}

var logUsageExportRangeBound = logUsageRangeBound{
	maxSeconds:  maxLogUsageExportRangeSeconds,
	tooLargeErr: errors.New("单次导出时间范围不能超过 31 天"),
}

var logUsageAnalysisRangeBound = logUsageRangeBound{
	maxSeconds:  common.DashboardMaxRangeSeconds,
	tooLargeErr: common.ErrDashboardRangeTooLarge,
}

func getLogUsageSummaryFilter(c *gin.Context, userId int, allowAdminFilters bool, bound logUsageRangeBound) (model.LogUsageSummaryFilter, error) {
	startTimestamp, err := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	if err != nil || startTimestamp <= 0 {
		return model.LogUsageSummaryFilter{}, errors.New("请选择有效的导出开始时间")
	}
	endTimestamp, err := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if err != nil || endTimestamp <= 0 {
		return model.LogUsageSummaryFilter{}, errors.New("请选择有效的导出结束时间")
	}
	// Refuse bounds the fixed +28800 CST bucket shift cannot represent, before
	// any arithmetic is done on them.
	if startTimestamp > common.DashboardMaxTimestamp || endTimestamp > common.DashboardMaxTimestamp {
		return model.LogUsageSummaryFilter{}, common.ErrDashboardRangeInvalid
	}
	if endTimestamp < startTimestamp {
		return model.LogUsageSummaryFilter{}, errors.New("导出结束时间不能早于开始时间")
	}
	if endTimestamp-startTimestamp > bound.maxSeconds {
		return model.LogUsageSummaryFilter{}, bound.tooLargeErr
	}

	filter := model.LogUsageSummaryFilter{
		UserId:         userId,
		TokenName:      c.Query("token_name"),
		ModelName:      c.Query("model_name"),
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		Group:          c.Query("group"),
		RequestId:      c.Query("request_id"),
	}
	if allowAdminFilters {
		filter.Username = c.Query("username")
		channelRaw := c.Query("channel")
		if channelRaw != "" {
			filter.Channel, err = strconv.Atoi(channelRaw)
			if err != nil || filter.Channel <= 0 {
				return model.LogUsageSummaryFilter{}, errors.New("请输入有效的渠道 ID")
			}
		}
	}
	return filter, nil
}

func GetLogUsageSummary(c *gin.Context) {
	filter, err := getLogUsageSummaryFilter(c, 0, true, logUsageExportRangeBound)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	summary, err := model.GetLogUsageSummary(filter)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summary)
}

// selfScopedUserId resolves the authenticated user for a /self endpoint.
//
// A self-scoped filter with UserId 0 does not scope anything: the model omits
// the user_id predicate entirely, so the caller would receive every user's
// consumption. If authentication has not populated the id, the request must
// fail closed rather than widen to the whole tenant.
func selfScopedUserId(c *gin.Context) (int, bool) {
	userId := c.GetInt("id")
	if userId <= 0 {
		abortWithUnauthorized(c)
		return 0, false
	}
	return userId, true
}

func abortWithUnauthorized(c *gin.Context) {
	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
		"success": false,
		"message": "无效的用户身份，请重新登录",
		"code":    "unauthorized",
	})
}

// selfScopedUsername resolves the authenticated username for a /self endpoint
// that scopes by name rather than by id.
//
// model.SumUsedQuota only adds its `username = ?` predicate when the name is
// non-empty, so an empty or whitespace-only name silently turns a personal
// statistic into a tenant-wide total. The name is trimmed and required, and the
// request is refused before any query runs.
func selfScopedUsername(c *gin.Context) (string, bool) {
	username := strings.TrimSpace(c.GetString("username"))
	if username == "" {
		abortWithUnauthorized(c)
		return "", false
	}
	return username, true
}

func GetLogSelfUsageSummary(c *gin.Context) {
	userId, ok := selfScopedUserId(c)
	if !ok {
		return
	}
	filter, err := getLogUsageSummaryFilter(c, userId, false, logUsageExportRangeBound)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	summary, err := model.GetLogUsageSummary(filter)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summary)
}

func getLogUsageAnalysisFilter(c *gin.Context, userId int, allowAdminFilters bool) (model.LogUsageAnalysisFilter, error) {
	if !allowAdminFilters {
		if _, exists := c.GetQuery("username"); exists {
			return model.LogUsageAnalysisFilter{}, errors.New("用户分析不允许查询用户参数")
		}
		if _, exists := c.GetQuery("channel"); exists {
			return model.LogUsageAnalysisFilter{}, errors.New("用户分析不允许查询渠道参数")
		}
	}
	base, err := getLogUsageSummaryFilter(c, userId, allowAdminFilters, logUsageAnalysisRangeBound)
	if err != nil {
		return model.LogUsageAnalysisFilter{}, err
	}
	granularity := c.DefaultQuery("granularity", "day")
	if granularity != "day" && granularity != "hour" {
		return model.LogUsageAnalysisFilter{}, errors.New("分析时间粒度仅支持 day 或 hour")
	}

	defaultDimensions := append([]string(nil), defaultLogAnalysisDimensions...)
	dimensionRaw := strings.TrimSpace(c.Query("dimensions"))
	dimensions := defaultDimensions
	if dimensionRaw != "" {
		dimensions = nil
		seen := make(map[string]bool)
		for _, raw := range strings.Split(dimensionRaw, ",") {
			dimension := strings.TrimSpace(raw)
			if dimension == "" || !allowedLogAnalysisDimensions[dimension] {
				return model.LogUsageAnalysisFilter{}, errors.New("包含不支持的分析维度")
			}
			if !allowAdminFilters && (dimension == "username" || dimension == "channel") {
				return model.LogUsageAnalysisFilter{}, errors.New("用户分析不允许查询用户或渠道维度")
			}
			if !seen[dimension] {
				seen[dimension] = true
				dimensions = append(dimensions, dimension)
			}
		}
	}
	return model.LogUsageAnalysisFilter{
		LogUsageSummaryFilter: base,
		Granularity:           granularity,
		Dimensions:            dimensions,
	}, nil
}

// logUsageAnalysisTimeout scales the request budget with the number of bounded
// segments the model layer will run, so a 90 day query is not judged against a
// 31 day query's budget while the overall bound stays fixed and predictable.
func logUsageAnalysisTimeout(filter model.LogUsageAnalysisFilter) time.Duration {
	// The filter has already been validated; an error here can only mean the
	// query is going to be rejected anyway, so fall back to the single-segment
	// budget rather than granting a larger one.
	segmentList, err := common.SplitDashboardRange(filter.StartTimestamp, filter.EndTimestamp)
	segments := len(segmentList)
	if err != nil || segments < 1 {
		segments = 1
	}
	timeout := logUsageAnalysisSegmentTimeout * time.Duration(segments)
	if timeout > maxLogUsageAnalysisTimeout {
		timeout = maxLogUsageAnalysisTimeout
	}
	return timeout
}

func writeLogUsageAnalysis(c *gin.Context, userId int, allowAdminFilters bool) {
	filter, err := getLogUsageAnalysisFilter(c, userId, allowAdminFilters)
	if err != nil {
		// Analysis is a public HTTP API boundary. Unlike legacy handlers that
		// use the application's 200+success:false envelope, malformed filters
		// and self-scope violations must be visible to clients as 4xx.
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	queryContext, cancel := context.WithTimeout(c.Request.Context(), logUsageAnalysisTimeout(filter))
	defer cancel()
	filter.Context = queryContext
	rows, err := model.GetLogUsageAnalysis(filter)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, model.ErrLogUsageAnalysisTooManyRows) || errors.Is(err, model.ErrLogUsageAnalysisTooManyBuckets) {
			status = http.StatusBadRequest
		} else if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
			status = http.StatusGatewayTimeout
		}
		body := gin.H{
			"success": false,
			"message": err.Error(),
		}
		if errors.Is(err, model.ErrLogUsageAnalysisTooManyRows) {
			// Keep the existing human-readable message while giving both Classic
			// and Default clients a stable signal to retry with a lower-cardinality
			// projection instead of showing a generic HTTP error.
			body["code"] = "analysis_too_many_rows"
			body["hint"] = "可自动降级为仅按时间分组；也可以缩小筛选范围或降低时间粒度。"
		}
		if errors.Is(err, model.ErrLogUsageAnalysisTooManyBuckets) {
			// A bucket overflow is not fixable by dropping dimensions, so it must
			// not be reported with the auto-downgrade code.
			body["code"] = "analysis_too_many_buckets"
			body["hint"] = "请缩小时间范围或降低时间粒度。"
		}
		c.AbortWithStatusJSON(status, body)
		return
	}
	common.ApiSuccess(c, logUsageAnalysisResponse{
		Rows:          rows,
		Granularity:   filter.Granularity,
		Dimensions:    filter.Dimensions,
		MarginStatus:  "unknown",
		CostBasisNote: "当前日志仅有平台计费额度，未关联可审计的上游成本台账；毛利率不计算、不展示为 0。",
	})
}

func GetLogUsageAnalysis(c *gin.Context) {
	writeLogUsageAnalysis(c, 0, true)
}

func GetLogSelfUsageAnalysis(c *gin.Context) {
	userId, ok := selfScopedUserId(c)
	if !ok {
		return
	}
	writeLogUsageAnalysis(c, userId, false)
}

func GetAllLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	requestId := c.Query("request_id")
	logs, total, err := model.GetAllLogs(logType, startTimestamp, endTimestamp, modelName, username, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), channel, group, requestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
	return
}

func GetUserLogs(c *gin.Context) {
	// model.GetUserLogs always applies `user_id = ?`, so a zero id returns rows
	// for user 0 rather than leaking another tenant's. The guard is still
	// applied so every /self handler refuses an unauthenticated identity the
	// same way instead of issuing a pointless query.
	userId, ok := selfScopedUserId(c)
	if !ok {
		return
	}
	pageInfo := common.GetPageQuery(c)
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	group := c.Query("group")
	requestId := c.Query("request_id")
	logs, total, err := model.GetUserLogs(userId, logType, startTimestamp, endTimestamp, modelName, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), group, requestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
	return
}

// Deprecated: SearchAllLogs 已废弃，前端未使用该接口。
func SearchAllLogs(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": "该接口已废弃",
	})
}

// Deprecated: SearchUserLogs 已废弃，前端未使用该接口。
func SearchUserLogs(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": "该接口已废弃",
	})
}

func GetLogByKey(c *gin.Context) {
	tokenId := c.GetInt("token_id")
	if tokenId == 0 {
		c.JSON(200, gin.H{
			"success": false,
			"message": "无效的令牌",
		})
		return
	}
	logs, err := model.GetLogByTokenId(tokenId)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "",
		"data":    logs,
	})
}

func GetLogsStat(c *gin.Context) {
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	username := c.Query("username")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	stat, err := model.SumUsedQuota(logType, startTimestamp, endTimestamp, modelName, username, tokenName, channel, group)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	//tokenNum := model.SumUsedToken(logType, startTimestamp, endTimestamp, modelName, username, "")
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"quota": stat.Quota,
			"rpm":   stat.Rpm,
			"tpm":   stat.Tpm,
		},
	})
	return
}

func GetLogsSelfStat(c *gin.Context) {
	username, ok := selfScopedUsername(c)
	if !ok {
		return
	}
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	quotaNum, err := model.SumUsedQuota(logType, startTimestamp, endTimestamp, modelName, username, tokenName, channel, group)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	//tokenNum := model.SumUsedToken(logType, startTimestamp, endTimestamp, modelName, username, tokenName)
	c.JSON(200, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"quota": quotaNum.Quota,
			"rpm":   quotaNum.Rpm,
			"tpm":   quotaNum.Tpm,
			//"token": tokenNum,
		},
	})
	return
}

func DeleteHistoryLogs(c *gin.Context) {
	targetTimestamp, _ := strconv.ParseInt(c.Query("target_timestamp"), 10, 64)
	if targetTimestamp == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "target timestamp is required",
		})
		return
	}
	count, err := model.DeleteOldLog(c.Request.Context(), targetTimestamp, 100)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    count,
	})
	return
}
