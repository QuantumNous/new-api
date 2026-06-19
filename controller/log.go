package controller

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

// parseChannelIdsQuery 兼容两种参数形式：
//   - 新前端：?channel_ids=1&channel_ids=2（多值，多选下拉的产物）
//   - 老前端 / 老脚本：?channel=N（单值字符串，保留兼容直到全部下游升级）
//
// 任一参数为正整数才会被采纳；非正/解析失败被丢弃。
func parseChannelIdsQuery(c *gin.Context) []int {
	ids := make([]int, 0)
	for _, raw := range c.QueryArray("channel_ids") {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 {
			ids = append(ids, v)
		}
	}
	if legacy, err := strconv.Atoi(c.Query("channel")); err == nil && legacy > 0 {
		ids = append(ids, legacy)
	}
	return ids
}

func GetAllLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	channelIds := parseChannelIdsQuery(c)
	group := c.Query("group")
	requestId := c.Query("request_id")
	logs, total, err := model.GetAllLogs(logType, startTimestamp, endTimestamp, modelName, username, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), channelIds, group, requestId)
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
	scope, err := resolveSelfDataScope(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	group := c.Query("group")
	requestId := c.Query("request_id")
	// 子账户无任何绑定 key → 返回空，不查库（防把空集合当不过滤而泄漏企业全量日志）。
	if scope.emptyForSubAccount() {
		pageInfo.SetTotal(0)
		pageInfo.SetItems(make([]*model.Log, 0))
		common.ApiSuccess(c, pageInfo)
		return
	}
	logs, total, err := model.GetUserLogs(scope.userId, logType, startTimestamp, endTimestamp, modelName, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), group, requestId, scope.tokenIds)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
	return
}

// logTypeLabel 与前端 LOG_TYPE_MAP 对齐，CSV 内固定输出中文文案，方便表格直接读。
func logTypeLabel(t int) string {
	switch t {
	case model.LogTypeTopup:
		return "充值"
	case model.LogTypeConsume:
		return "消费"
	case model.LogTypeManage:
		return "管理"
	case model.LogTypeSystem:
		return "系统"
	case model.LogTypeError:
		return "错误"
	case model.LogTypeRefund:
		return "退款"
	default:
		return strconv.Itoa(t)
	}
}

var htmlTagRe = regexp.MustCompile(`<[^>]+>`)
var whitespaceRe = regexp.MustCompile(`\s+`)

// cleanLogContent 去掉 content 里的 HTML 标签并把多余空白压成单空格，
// 与 classic 端 CSV 行为一致。
func cleanLogContent(s string) string {
	if s == "" {
		return ""
	}
	out := htmlTagRe.ReplaceAllString(s, "")
	out = whitespaceRe.ReplaceAllString(out, " ")
	return strings.TrimSpace(out)
}

// writeLogCSVHeader 提交 HTTP 200 + CSV 响应头，写 UTF-8 BOM 和列头行。
// 必须在第一次往 c.Writer 写字节之前调用——一旦调用后端就不能再返回 JSON 错误了。
func writeLogCSVHeader(c *gin.Context, w *csv.Writer, includeAdminCols bool) error {
	filename := fmt.Sprintf("logs_%s.csv", time.Now().Format("20060102_150405"))
	c.Writer.Header().Set("Content-Type", "text/csv; charset=utf-8")
	c.Writer.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Writer.Header().Set("Cache-Control", "no-store")
	c.Writer.WriteHeader(http.StatusOK)
	// UTF-8 BOM, Excel 默认按 GBK 解码会乱码，加 BOM 后能识别 UTF-8。
	if _, err := c.Writer.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
		return err
	}
	headers := []string{"时间", "日志类型"}
	if includeAdminCols {
		headers = append(headers, "渠道ID", "渠道名", "用户")
	}
	headers = append(headers,
		"令牌", "分组", "模型", "用时(s)",
		"输入tokens", "输出tokens",
		"缓存读tokens", "缓存写tokens",
		"原始quota", "费用(CNY)",
		"IP", "请求ID", "详情",
	)
	return w.Write(headers)
}

// otherCacheTokens 从 log.Other JSON 里取缓存读/写 tokens。
//
// 缓存写口径必须与后端唯一来源 service.cacheWriteTokensTotal 对齐：
//   - 若已有归一化后的 cache_write_tokens（service/text_quota.go:449 写入），直接用；
//   - 否则按 canonical 公式：当 5m 或 1h 拆分存在时取 max(cache_creation_tokens, 5m+1h)，
//     否则用 cache_creation_tokens 聚合值。
//
// 简单求 5m+1h 之和会丢掉某些 provider 把聚合写入 cache_creation_tokens、却没下发拆分残量的场景，
// 测试见 service/text_quota_test.go:151。
func otherCacheTokens(other string) (read, write int) {
	if other == "" {
		return 0, 0
	}
	m, err := common.StrToMap(other)
	if err != nil || m == nil {
		return 0, 0
	}
	toInt := func(v any) int {
		switch x := v.(type) {
		case float64:
			return int(x)
		case int:
			return x
		case int64:
			return int(x)
		case string:
			n, _ := strconv.Atoi(x)
			return n
		}
		return 0
	}
	read = toInt(m["cache_tokens"])

	// 1) 现有日志若已携带归一化字段，直接采用，避免我们自己再算出和它不一致的值。
	if v, ok := m["cache_write_tokens"]; ok {
		if n := toInt(v); n > 0 {
			return read, n
		}
	}
	// 2) 老日志/没写归一化字段：复刻 cacheWriteTokensTotal 的口径。
	creation := toInt(m["cache_creation_tokens"])
	split := toInt(m["cache_creation_tokens_5m"]) + toInt(m["cache_creation_tokens_1h"])
	if split > 0 {
		if creation > split {
			write = creation
		} else {
			write = split
		}
	} else {
		write = creation
	}
	return read, write
}

// streamExportCSV 把"延迟响应头 + 中途错误标记"两件事封装起来。
//   - 首批查询失败：headerWritten 仍为 false，由调用方走 common.ApiError 返回 JSON 500。
//   - 首批查询成功但后续批次出错：CSV 头已写出，无法再切回 JSON，
//     于是写一行 `# EXPORT ERROR,<msg>` 作为 trailer，让人/Excel 看到截断警告。
//   - 完整成功：照常 flush。
//
// 返回值：
//   - csvStarted=false 表示尚未写过 c.Writer，调用方可以走 ApiError；
//   - csvStarted=true  表示已经写过 CSV header（含空结果时写空表头）。
func streamExportCSV(
	c *gin.Context,
	includeAdminCols bool,
	stream func(perBatch func(logs []*model.Log) error) error,
) (csvStarted bool) {
	var w *csv.Writer
	headerWritten := false
	mkWriter := func() error {
		w = csv.NewWriter(c.Writer)
		if err := writeLogCSVHeader(c, w, includeAdminCols); err != nil {
			return err
		}
		headerWritten = true
		return nil
	}

	streamErr := stream(func(batch []*model.Log) error {
		if !headerWritten {
			if err := mkWriter(); err != nil {
				return err
			}
		}
		for _, l := range batch {
			if err := w.Write(logToRow(l, includeAdminCols)); err != nil {
				return err
			}
		}
		w.Flush()
		return w.Error()
	})

	// 首批就失败：还没动 c.Writer，可以返回 JSON 错误。
	if streamErr != nil && !headerWritten {
		return false
	}

	// 没有任何行（空结果）：仍然写出只含 BOM + header 的 CSV，让前端拿到 200 + 空表。
	if !headerWritten {
		if err := mkWriter(); err != nil {
			common.SysError("export logs: write empty header failed: " + err.Error())
			return true
		}
		w.Flush()
		return true
	}

	// 流中错误：补一行 trailer，让用户/Excel 能看到导出被截断。
	if streamErr != nil {
		_ = w.Write([]string{"# EXPORT ERROR", streamErr.Error()})
		w.Flush()
		common.SysError("export logs: stream truncated: " + streamErr.Error())
		return true
	}

	w.Flush()
	return true
}

// logToRow 把单条 log 渲染成 CSV 一行字符串切片。
func logToRow(l *model.Log, includeAdminCols bool) []string {
	timeStr := time.Unix(l.CreatedAt, 0).Format("2006-01-02 15:04:05")
	row := []string{timeStr, logTypeLabel(l.Type)}
	if includeAdminCols {
		row = append(row,
			strconv.Itoa(l.ChannelId),
			l.ChannelName,
			l.Username,
		)
	}
	// 费用按 CNY 输出：quota -> USD -> CNY，与前端 renderQuota 的 CNY 分支同款，
	// 也与 controller/billing.go:50 的换算一致。
	//
	// 注意：QuotaPerUnit 与 USDExchangeRate 都是全局可变配置，日志里只存了整型 quota，
	// 不存历史汇率，所以这一列是"按当前配置回算"的，改过汇率后老日志的 CNY 会漂。
	// 这是数据模型的固有限制，前端展示也是同样行为。
	// 汇率 <= 0 时不再 fallback 成 1（那会输出美元数值却挂 CNY 表头），直接留空。
	costCNY := ""
	rate := operation_setting.USDExchangeRate
	if common.QuotaPerUnit > 0 && rate > 0 {
		costCNY = strconv.FormatFloat(float64(l.Quota)/common.QuotaPerUnit*rate, 'f', 6, 64)
	}
	cacheRead, cacheWrite := otherCacheTokens(l.Other)
	row = append(row,
		l.TokenName,
		l.Group,
		l.ModelName,
		strconv.Itoa(l.UseTime),
		strconv.Itoa(l.PromptTokens),
		strconv.Itoa(l.CompletionTokens),
		strconv.Itoa(cacheRead),
		strconv.Itoa(cacheWrite),
		strconv.Itoa(l.Quota),
		costCNY,
		l.Ip,
		l.RequestId,
		cleanLogContent(l.Content),
	)
	return row
}

// ExportAllLogs 管理员视角：流式 CSV 导出所有匹配日志，不受分页 100 条上限制。
func ExportAllLogs(c *gin.Context) {
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	channelIds := parseChannelIdsQuery(c)
	group := c.Query("group")
	requestId := c.Query("request_id")

	var firstBatchErr error
	csvStarted := streamExportCSV(c, true, func(perBatch func(logs []*model.Log) error) error {
		err := model.ExportAllLogs(logType, startTimestamp, endTimestamp, modelName, username, tokenName, channelIds, group, requestId, 1000, perBatch)
		firstBatchErr = err
		return err
	})
	if !csvStarted && firstBatchErr != nil {
		common.ApiError(c, firstBatchErr)
	}
}

// ExportUserLogs 普通用户视角：流式 CSV 导出自己的日志。
func ExportUserLogs(c *gin.Context) {
	scope, err := resolveSelfDataScope(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	group := c.Query("group")
	requestId := c.Query("request_id")

	var firstBatchErr error
	csvStarted := streamExportCSV(c, false, func(perBatch func(logs []*model.Log) error) error {
		// 子账户无绑定 → 导出空 CSV（仅表头），不查库、不过滤泄漏。
		if scope.emptyForSubAccount() {
			return nil
		}
		err := model.ExportUserLogs(scope.userId, logType, startTimestamp, endTimestamp, modelName, tokenName, group, requestId, scope.tokenIds, 1000, perBatch)
		firstBatchErr = err
		return err
	})
	if !csvStarted && firstBatchErr != nil {
		common.ApiError(c, firstBatchErr)
	}
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
	channelIds := parseChannelIdsQuery(c)
	group := c.Query("group")
	stat, err := model.SumUsedQuota(logType, startTimestamp, endTimestamp, modelName, username, tokenName, channelIds, group, nil)
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
	scope, err := resolveSelfDataScope(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	channelIds := parseChannelIdsQuery(c)
	group := c.Query("group")
	// 子账户无绑定 → 零统计，不查库。
	if scope.emptyForSubAccount() {
		c.JSON(200, gin.H{
			"success": true,
			"message": "",
			"data":    gin.H{"quota": 0, "rpm": 0, "tpm": 0},
		})
		return
	}
	// 子账户按企业主账户用户名 + 绑定 token 集合统计；普通用户 tokenIds=nil 不过滤。
	quotaNum, err := model.SumUsedQuota(logType, startTimestamp, endTimestamp, modelName, scope.username, tokenName, channelIds, group, scope.tokenIds)
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
