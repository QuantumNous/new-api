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

const maxLogUsageExportRangeSeconds int64 = 31 * 24 * 60 * 60
const logUsageAnalysisTimeout = 5 * time.Second

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

func getLogUsageSummaryFilter(c *gin.Context, userId int, allowAdminFilters bool) (model.LogUsageSummaryFilter, error) {
	startTimestamp, err := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	if err != nil || startTimestamp <= 0 {
		return model.LogUsageSummaryFilter{}, errors.New("请选择有效的导出开始时间")
	}
	endTimestamp, err := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if err != nil || endTimestamp <= 0 {
		return model.LogUsageSummaryFilter{}, errors.New("请选择有效的导出结束时间")
	}
	if endTimestamp < startTimestamp {
		return model.LogUsageSummaryFilter{}, errors.New("导出结束时间不能早于开始时间")
	}
	if endTimestamp-startTimestamp > maxLogUsageExportRangeSeconds {
		return model.LogUsageSummaryFilter{}, errors.New("单次导出时间范围不能超过 31 天")
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
	filter, err := getLogUsageSummaryFilter(c, 0, true)
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

func GetLogSelfUsageSummary(c *gin.Context) {
	filter, err := getLogUsageSummaryFilter(c, c.GetInt("id"), false)
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
	base, err := getLogUsageSummaryFilter(c, userId, allowAdminFilters)
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
	queryContext, cancel := context.WithTimeout(c.Request.Context(), logUsageAnalysisTimeout)
	defer cancel()
	filter.Context = queryContext
	rows, err := model.GetLogUsageAnalysis(filter)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, model.ErrLogUsageAnalysisTooManyRows) {
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
	writeLogUsageAnalysis(c, c.GetInt("id"), false)
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
	pageInfo := common.GetPageQuery(c)
	userId := c.GetInt("id")
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
	username := c.GetString("username")
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
