package controller

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type settleAffiliateCommissionsRequest struct {
	Ids    []int  `json:"ids"`
	Remark string `json:"remark"`
}

type affiliatePayoutProfileRequest struct {
	Method      string `json:"method"`
	Account     string `json:"account"`
	AccountName string `json:"account_name"`
}

func parseAffiliateCommissionQuery(c *gin.Context) (model.AffiliateCommissionQuery, error) {
	query := model.AffiliateCommissionQuery{
		Status:  c.Query("status"),
		TradeNo: c.Query("trade_no"),
	}
	if query.Status != "" &&
		query.Status != model.AffiliateCommissionStatusPending &&
		query.Status != model.AffiliateCommissionStatusSettled {
		return query, fmt.Errorf("无效的佣金状态")
	}

	if value := c.Query("level"); value != "" {
		level, err := strconv.Atoi(value)
		if err != nil || (level != model.AffiliateCommissionLevel1 && level != model.AffiliateCommissionLevel2) {
			return query, fmt.Errorf("无效的分销层级")
		}
		query.Level = level
	}
	if value := c.Query("promoter_id"); value != "" {
		promoterId, err := strconv.Atoi(value)
		if err != nil || promoterId < 0 {
			return query, fmt.Errorf("无效的推广人 ID")
		}
		query.PromoterId = promoterId
	}
	if value := c.Query("buyer_id"); value != "" {
		buyerId, err := strconv.Atoi(value)
		if err != nil || buyerId < 0 {
			return query, fmt.Errorf("无效的购买者 ID")
		}
		query.BuyerId = buyerId
	}
	if value := c.Query("start_time"); value != "" {
		startTime, err := strconv.ParseInt(value, 10, 64)
		if err != nil || startTime < 0 {
			return query, fmt.Errorf("无效的开始时间")
		}
		query.StartTime = startTime
	}
	if value := c.Query("end_time"); value != "" {
		endTime, err := strconv.ParseInt(value, 10, 64)
		if err != nil || endTime < 0 {
			return query, fmt.Errorf("无效的结束时间")
		}
		query.EndTime = endTime
	}
	return query, nil
}

func GetSelfAffiliateSummary(c *gin.Context) {
	query, err := parseAffiliateCommissionQuery(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	query.PromoterId = c.GetInt("id")
	summary, err := model.GetAffiliateCommissionSummary(query)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summary)
}

func GetSelfAffiliateCommissions(c *gin.Context) {
	query, err := parseAffiliateCommissionQuery(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	query.PromoterId = c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	records, total, err := model.ListAffiliateCommissions(query, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(records)
	common.ApiSuccess(c, pageInfo)
}

func GetSelfAffiliatePayoutProfile(c *gin.Context) {
	profile, err := model.GetAffiliatePayoutProfile(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, profile)
}

func UpdateSelfAffiliatePayoutProfile(c *gin.Context) {
	var req affiliatePayoutProfileRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	profile, err := model.SaveAffiliatePayoutProfile(c.GetInt("id"), req.Method, req.Account, req.AccountName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, profile)
}

func AdminListAffiliateCommissions(c *gin.Context) {
	query, err := parseAffiliateCommissionQuery(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo := common.GetPageQuery(c)
	records, total, err := model.ListAffiliateCommissions(query, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(records)
	common.ApiSuccess(c, pageInfo)
}

func AdminAffiliateSummary(c *gin.Context) {
	query, err := parseAffiliateCommissionQuery(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	summary, err := model.GetAffiliateCommissionSummary(query)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summary)
}

func AdminSettleAffiliateCommissions(c *gin.Context) {
	var req settleAffiliateCommissionsRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.SettleAffiliateCommissions(req.Ids, c.GetInt("id"), req.Remark); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func formatMicrosForCSV(micros int64) string {
	return decimal.NewFromInt(micros).
		Div(decimal.NewFromInt(1000000)).
		StringFixed(6)
}

func AdminExportAffiliateCommissions(c *gin.Context) {
	query, err := parseAffiliateCommissionQuery(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	records, err := model.ExportAffiliateCommissions(query, 50000)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	filename := fmt.Sprintf("affiliate-commissions-%s.csv", time.Now().Format("20060102150405"))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Status(http.StatusOK)

	_, _ = c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})
	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	_ = writer.Write([]string{
		"佣金 ID",
		"订单号",
		"买家 ID",
		"买家用户名",
		"推广人 ID",
		"推广人用户名",
		"推广人当前收款方式",
		"推广人当前收款账号",
		"推广人当前收款人",
		"层级",
		"返佣基数",
		"费率 BPS",
		"佣金金额",
		"币种",
		"支付提供方",
		"支付方式",
		"状态",
		"创建时间",
		"结算时间",
		"结算人",
		"结算备注",
		"结算收款方式",
		"结算收款账号",
		"结算收款人",
	})
	for _, record := range records {
		settledAt := ""
		if record.SettledAt > 0 {
			settledAt = strconv.FormatInt(record.SettledAt, 10)
		}
		_ = writer.Write([]string{
			strconv.Itoa(record.Id),
			record.TradeNo,
			strconv.Itoa(record.BuyerId),
			record.BuyerUsername,
			strconv.Itoa(record.PromoterId),
			record.PromoterUsername,
			record.PromoterPayoutMethod,
			record.PromoterPayoutAccount,
			record.PromoterPayoutAccountName,
			strconv.Itoa(record.Level),
			formatMicrosForCSV(record.BaseAmountMicros),
			strconv.Itoa(record.CommissionRateBps),
			formatMicrosForCSV(record.CommissionAmountMicros),
			record.Currency,
			record.PaymentProvider,
			record.PaymentMethod,
			record.Status,
			strconv.FormatInt(record.CreatedAt, 10),
			settledAt,
			record.SettledByUsername,
			record.SettleRemark,
			record.SettledPayoutMethod,
			record.SettledPayoutAccount,
			record.SettledPayoutAccountName,
		})
	}
}
