package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func GetAgentPromotion(c *gin.Context) {
	promotion, err := service.GetAgentPromotion(c.GetInt("id"))
	if err != nil {
		writeAgentError(c, err)
		return
	}
	common.ApiSuccess(c, promotion)
}

func GetAgentCustomers(c *gin.Context) {
	page, ok := parseAgentQueryPage(c)
	if !ok {
		return
	}
	customers, total, err := service.ListAgentCustomers(c.GetInt("id"), service.AgentCustomerQuery{
		Keyword: c.Query("keyword"), SortBy: c.Query("sort_by"), SortOrder: c.Query("sort_order"),
		Offset: page.Offset, Limit: page.PageSize,
	})
	if err != nil {
		writeAgentError(c, err)
		return
	}
	writeAgentQueryPage(c, page, total, customers)
}

func GetAgentCustomerLogs(c *gin.Context) {
	page, ok := parseAgentQueryPage(c)
	if !ok {
		return
	}
	query, ok := parseAgentCustomerLogQuery(c)
	if !ok {
		return
	}
	query.Offset = page.Offset
	query.Limit = page.PageSize
	logs, total, err := service.ListAgentCustomerLogs(c.GetInt("id"), query)
	if err != nil {
		writeAgentError(c, err)
		return
	}
	sanitizeLogsForRequester(c, logs)
	model.FormatUserLogsForRequester(logs, page.Offset)
	writeAgentQueryPage(c, page, total, logs)
}

func GetAgentCustomerLogStats(c *gin.Context) {
	query, ok := parseAgentCustomerLogQuery(c)
	if !ok {
		return
	}
	stat, err := service.GetAgentCustomerLogStats(c.GetInt("id"), query)
	if err != nil {
		writeAgentError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"quota": stat.Quota, "rpm": stat.Rpm, "tpm": stat.Tpm})
}

func parseAgentCustomerLogQuery(c *gin.Context) (service.AgentCustomerLogQuery, bool) {
	userID, ok := parseAgentOptionalPositiveInt(c, "user_id")
	if !ok {
		return service.AgentCustomerLogQuery{}, false
	}
	logType := model.LogTypeUnknown
	if value := c.Query("type"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < model.LogTypeUnknown || parsed > model.LogTypeLogin {
			common.ApiErrorMsg(c, "invalid log type")
			return service.AgentCustomerLogQuery{}, false
		}
		logType = parsed
	}
	startTimestamp, endTimestamp, ok := parseAgentTimeRange(c)
	if !ok {
		return service.AgentCustomerLogQuery{}, false
	}
	return service.AgentCustomerLogQuery{
		UserID: userID, Username: c.Query("username"), Type: logType,
		ModelName: c.Query("model_name"), TokenName: c.Query("token_name"), Group: c.Query("group"),
		StartTimestamp: startTimestamp, EndTimestamp: endTimestamp,
	}, true
}
