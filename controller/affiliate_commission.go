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
)

type settleAffiliateCommissionsRequest struct {
	Ids    []int  `json:"ids"`
	Remark string `json:"remark"`
}

type offlineCashbackAffiliateRewardPointsRequest struct {
	PromoterId int    `json:"promoter_id"`
	Points     int    `json:"points"`
	Remark     string `json:"remark"`
}

type redeemAffiliateRewardPointsRequest struct {
	Points *int `json:"points"`
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
		return query, fmt.Errorf("无效的奖励积分状态")
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

func parseAffiliateRewardPointSettlementQuery(c *gin.Context) (model.AffiliateRewardPointSettlementQuery, error) {
	query := model.AffiliateRewardPointSettlementQuery{
		SettlementType: c.Query("settlement_type"),
	}
	if query.SettlementType != "" &&
		query.SettlementType != model.AffiliateCommissionSettlementTypeWallet &&
		query.SettlementType != model.AffiliateCommissionSettlementTypeOfflineCashback {
		return query, fmt.Errorf("无效的积分处理方式")
	}
	if value := c.Query("promoter_id"); value != "" {
		promoterId, err := strconv.Atoi(value)
		if err != nil || promoterId < 0 {
			return query, fmt.Errorf("无效的推广人 ID")
		}
		query.PromoterId = promoterId
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

func requireSelfAffiliatePermission(c *gin.Context) bool {
	user, err := model.GetUserById(c.GetInt("id"), false)
	if err != nil {
		common.ApiError(c, err)
		return false
	}
	if !user.DistributionEnabled {
		common.ApiErrorMsg(c, "未开通代理分销权限")
		return false
	}
	return true
}

func GetSelfAffiliateSummary(c *gin.Context) {
	if !requireSelfAffiliatePermission(c) {
		return
	}
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
	if !requireSelfAffiliatePermission(c) {
		return
	}
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

func GetSelfAffiliateRewardPointSettlements(c *gin.Context) {
	if !requireSelfAffiliatePermission(c) {
		return
	}
	query, err := parseAffiliateRewardPointSettlementQuery(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	query.PromoterId = c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	records, total, err := model.ListAffiliateRewardPointSettlements(query, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(records)
	common.ApiSuccess(c, pageInfo)
}

func GetSelfAffiliatePayoutProfile(c *gin.Context) {
	if !requireSelfAffiliatePermission(c) {
		return
	}
	profile, err := model.GetAffiliatePayoutProfile(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, profile)
}

func UpdateSelfAffiliatePayoutProfile(c *gin.Context) {
	if !requireSelfAffiliatePermission(c) {
		return
	}
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

func RedeemSelfAffiliateRewardPoints(c *gin.Context) {
	if !requireSelfAffiliatePermission(c) {
		return
	}
	var req redeemAffiliateRewardPointsRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	var redemption model.AffiliateRewardPointRedemptionResult
	var err error
	if req.Points != nil {
		redemption, err = model.RedeemAffiliateRewardPoints(c.GetInt("id"), nil, *req.Points)
	} else {
		redemption, err = model.RedeemAffiliateRewardPoints(c.GetInt("id"), nil)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, redemption)
}

func QuoteSelfAffiliateRewardPoints(c *gin.Context) {
	if !requireSelfAffiliatePermission(c) {
		return
	}
	var req redeemAffiliateRewardPointsRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if req.Points == nil {
		common.ApiErrorMsg(c, "兑换积分不能为空")
		return
	}
	quote, err := model.QuoteAffiliateRewardPointRedemption(c.GetInt("id"), *req.Points)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, quote)
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

func AdminListAffiliateRewardPointSettlements(c *gin.Context) {
	query, err := parseAffiliateRewardPointSettlementQuery(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo := common.GetPageQuery(c)
	records, total, err := model.ListAffiliateRewardPointSettlements(query, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(records)
	common.ApiSuccess(c, pageInfo)
}

func AdminOfflineCashbackAffiliateRewardPoints(c *gin.Context) {
	var req offlineCashbackAffiliateRewardPointsRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	result, err := model.OfflineCashbackAffiliateRewardPoints(req.PromoterId, req.Points, c.GetInt("id"), req.Remark)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
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

	filename := fmt.Sprintf("affiliate-reward-points-%s.csv", time.Now().Format("20060102150405"))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Status(http.StatusOK)

	_, _ = c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})
	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	_ = writer.Write([]string{
		"奖励 ID",
		"订单号",
		"买家 ID",
		"买家用户名",
		"推广人 ID",
		"推广人用户名",
		"层级",
		"到账 Token",
		"奖励积分",
		"已处理积分",
		"待处理积分",
		"钱包到账额度",
		"费率 BPS",
		"支付提供方",
		"支付方式",
		"状态",
		"处理方式",
		"创建时间",
		"处理时间",
		"操作人",
		"备注",
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
			strconv.Itoa(record.Level),
			strconv.Itoa(record.BaseQuota),
			strconv.Itoa(record.RewardPoints),
			strconv.Itoa(record.SettledPoints),
			strconv.Itoa(record.PendingPoints),
			strconv.FormatInt(record.WalletQuota, 10),
			strconv.Itoa(record.CommissionRateBps),
			record.PaymentProvider,
			record.PaymentMethod,
			record.Status,
			record.SettlementType,
			strconv.FormatInt(record.CreatedAt, 10),
			settledAt,
			record.SettledByUsername,
			record.SettleRemark,
		})
	}
}
