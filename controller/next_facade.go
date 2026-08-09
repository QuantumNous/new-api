package controller

import (
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// NextOrderDTO is the stable order contract consumed by the Vue frontend.
// Subscription and marketplace values are reserved for later phases.
type NextOrderDTO struct {
	ID            int     `json:"id"`
	OrderNo       string  `json:"order_no"`
	Type          string  `json:"type"`
	UserID        int     `json:"user_id,omitempty"`
	Username      string  `json:"username,omitempty"`
	Email         string  `json:"email,omitempty"`
	Amount        float64 `json:"amount"`
	Quota         int64   `json:"quota"`
	Currency      string  `json:"currency"`
	Method        string  `json:"method"`
	PaymentMethod string  `json:"payment_method"`
	Status        string  `json:"status"`
	Created       int64   `json:"created"`
	PaidAt        int64   `json:"paid_at"`
}

type nextTopUpRequest struct {
	Amount        int64  `json:"amount" binding:"required,gt=0"`
	PaymentMethod string `json:"payment_method" binding:"required"`
}

type nextEpayPaymentMethod struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Color    string `json:"color,omitempty"`
	MinTopUp int64  `json:"min_topup"`
}

type nextEpayTopUpConfig struct {
	Enabled           bool                    `json:"enable_online_topup"`
	RedemptionEnabled bool                    `json:"enable_redemption"`
	PayMethods        []nextEpayPaymentMethod `json:"pay_methods"`
	MinTopUp          int64                   `json:"min_topup"`
	AmountOptions     []int                   `json:"amount_options"`
}

func nextOrderStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case common.TopUpStatusSuccess:
		return "completed"
	case common.TopUpStatusPending:
		return "pending"
	default:
		return "failed"
	}
}

func nextOrderMethod(topUp *model.TopUp) string {
	provider := strings.ToLower(strings.TrimSpace(topUp.PaymentProvider))
	if provider == "" {
		method := strings.ToLower(strings.TrimSpace(topUp.PaymentMethod))
		switch method {
		case model.PaymentMethodStripe, model.PaymentMethodCreem, model.PaymentMethodWaffo,
			model.PaymentMethodWaffoPancake, model.PaymentMethodBalance:
			return method
		case "":
			return "other"
		default:
			return model.PaymentProviderEpay
		}
	}
	switch provider {
	case model.PaymentProviderEpay, model.PaymentProviderStripe, model.PaymentProviderCreem,
		model.PaymentProviderWaffo, model.PaymentProviderWaffoPancake, model.PaymentProviderBalance:
		return provider
	default:
		return "other"
	}
}

func nextEpayTopUpQuery(query *gorm.DB) *gorm.DB {
	legacyNonEpayMethods := []string{
		model.PaymentMethodStripe,
		model.PaymentMethodCreem,
		model.PaymentMethodWaffo,
		model.PaymentMethodWaffoPancake,
		model.PaymentMethodBalance,
	}
	return query.Where(
		"(top_ups.payment_provider = ? OR (top_ups.payment_provider = '' AND top_ups.payment_method NOT IN ?))",
		model.PaymentProviderEpay,
		legacyNonEpayMethods,
	)
}

func nextOtherTopUpQuery(query *gorm.DB) *gorm.DB {
	knownProviders := []string{
		model.PaymentProviderEpay,
		model.PaymentProviderStripe,
		model.PaymentProviderCreem,
		model.PaymentProviderWaffo,
		model.PaymentProviderWaffoPancake,
		model.PaymentProviderBalance,
	}
	return query.Where(
		"(top_ups.payment_provider <> '' AND top_ups.payment_provider NOT IN ?) OR (top_ups.payment_provider = '' AND top_ups.payment_method = '')",
		knownProviders,
	)
}

func nextTopUpQuota(topUp *model.TopUp) int64 {
	if topUp.Status != common.TopUpStatusSuccess {
		return 0
	}
	switch nextOrderMethod(topUp) {
	case model.PaymentProviderStripe:
		return int64(common.QuotaFromFloat(topUp.Money * common.QuotaPerUnit))
	case model.PaymentProviderCreem, model.PaymentProviderBalance:
		return topUp.Amount
	case model.PaymentProviderEpay, model.PaymentProviderWaffo, model.PaymentProviderWaffoPancake:
		return int64(common.QuotaFromDecimal(
			decimal.NewFromInt(topUp.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
		))
	default:
		return 0
	}
}

func nextTopUpDTO(topUp *model.TopUp, user *model.User) NextOrderDTO {
	method := nextOrderMethod(topUp)
	currency := "USD"
	if method == model.PaymentProviderEpay {
		currency = "CNY"
	}
	dto := NextOrderDTO{
		ID: topUp.Id, OrderNo: topUp.TradeNo, Type: "topup", UserID: topUp.UserId,
		Amount: topUp.Money, Quota: nextTopUpQuota(topUp), Currency: currency,
		Method: method, PaymentMethod: topUp.PaymentMethod,
		Status: nextOrderStatus(topUp.Status), Created: topUp.CreateTime, PaidAt: topUp.CompleteTime,
	}
	if user != nil {
		dto.Username = user.Username
		dto.Email = user.Email
	}
	return dto
}

func nextTopUpUsers(topUps []*model.TopUp) (map[int]*model.User, error) {
	ids := make([]int, 0, len(topUps))
	seen := make(map[int]struct{}, len(topUps))
	for _, topUp := range topUps {
		if _, ok := seen[topUp.UserId]; ok {
			continue
		}
		seen[topUp.UserId] = struct{}{}
		ids = append(ids, topUp.UserId)
	}
	usersByID := make(map[int]*model.User, len(ids))
	if len(ids) == 0 {
		return usersByID, nil
	}
	users := make([]*model.User, 0, len(ids))
	if err := model.DB.Select("id", "username", "email").Where("id IN ?", ids).Find(&users).Error; err != nil {
		return nil, err
	}
	for _, user := range users {
		usersByID[user.Id] = user
	}
	return usersByID, nil
}

// NextCreateEpayTopUp starts an Epay recharge while preserving the existing
// payment configuration and callback implementation.
func NextGetEpayTopUpConfig(c *gin.Context) {
	enabled := isEpayTopUpEnabled()
	methods := make([]nextEpayPaymentMethod, 0, len(operation_setting.PayMethods))
	if enabled {
		for _, configured := range operation_setting.PayMethods {
			name := strings.TrimSpace(configured["name"])
			methodType := strings.TrimSpace(configured["type"])
			if name == "" || methodType == "" {
				continue
			}
			minTopUp := getMinTopup()
			if configuredMin, err := strconv.ParseInt(strings.TrimSpace(configured["min_topup"]), 10, 64); err == nil && configuredMin > 0 {
				minTopUp = configuredMin
			}
			methods = append(methods, nextEpayPaymentMethod{
				Name: name, Type: methodType, Color: strings.TrimSpace(configured["color"]), MinTopUp: minTopUp,
			})
		}
	}
	amountOptions := make([]int, 0, len(operation_setting.GetPaymentSetting().AmountOptions))
	for _, amount := range operation_setting.GetPaymentSetting().AmountOptions {
		if amount > 0 {
			amountOptions = append(amountOptions, amount)
		}
	}
	common.ApiSuccess(c, nextEpayTopUpConfig{
		Enabled: enabled, RedemptionEnabled: operation_setting.IsPaymentComplianceConfirmed(),
		PayMethods: methods, MinTopUp: getMinTopup(), AmountOptions: amountOptions,
	})
}

func NextCreateEpayTopUp(c *gin.Context) {
	var req nextTopUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if !isEpayTopUpEnabled() {
		nextBusinessError(c, "epay is not configured", "PAYMENT_UNAVAILABLE")
		return
	}

	method := strings.TrimSpace(strings.TrimPrefix(req.PaymentMethod, "epay:"))
	if method == "" || !operation_setting.ContainsPayMethod(method) {
		nextBusinessError(c, "payment method unavailable", "PAYMENT_UNAVAILABLE")
		return
	}
	if req.Amount < getMinTopup() {
		nextBusinessError(c, fmt.Sprintf("minimum topup is %d", getMinTopup()), "VALIDATION_ERROR")
		return
	}

	userID := c.GetInt("id")
	group, err := model.GetUserGroup(userID, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		nextBusinessError(c, "topup amount is too low", "VALIDATION_ERROR")
		return
	}

	client := GetEpayClient()
	if client == nil {
		nextBusinessError(c, "epay is not configured", "PAYMENT_UNAVAILABLE")
		return
	}
	callbackAddress := service.GetCallbackAddress()
	returnURL, _ := url.Parse(paymentReturnPath("/usage-logs"))
	notifyURL, _ := url.Parse(callbackAddress + "/api/user/epay/notify")
	tradeNo := fmt.Sprintf("USR%dNO%s%d", userID, common.GetRandomString(6), time.Now().Unix())
	uri, params, err := client.Purchase(&epay.PurchaseArgs{
		Type:           method,
		ServiceTradeNo: tradeNo,
		Name:           fmt.Sprintf("TUC%d", req.Amount),
		Money:          strconv.FormatFloat(payMoney, 'f', 2, 64),
		Device:         epay.PC,
		NotifyUrl:      notifyURL,
		ReturnUrl:      returnURL,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}

	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = decimal.NewFromInt(amount).
			Div(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart()
	}
	topUp := &model.TopUp{
		UserId:          userID,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   method,
		PaymentProvider: model.PaymentProviderEpay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, gin.H{
		"trade_no":       tradeNo,
		"status":         "PENDING",
		"amount":         amount,
		"money":          payMoney,
		"payment_method": method,
		"url":            uri,
		"data":           params,
	})
}

func NextListUserOrders(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	topUps, total, err := model.GetUserTopUps(c.GetInt("id"), pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]NextOrderDTO, 0, len(topUps))
	for _, topUp := range topUps {
		items = append(items, nextTopUpDTO(topUp, nil))
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func NextGetUserOrder(c *gin.Context) {
	topUp := model.GetTopUpByTradeNo(c.Param("order_no"))
	if topUp == nil || topUp.UserId != c.GetInt("id") {
		nextBusinessError(c, "order not found", "NOT_FOUND")
		return
	}
	common.ApiSuccess(c, nextTopUpDTO(topUp, nil))
}

func nextAdminOrderQuery(c *gin.Context) *gorm.DB {
	query := model.DB.Model(&model.TopUp{}).
		Joins("LEFT JOIN users ON users.id = top_ups.user_id")
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("top_ups.trade_no LIKE ? OR users.username LIKE ? OR users.email LIKE ?", like, like, like)
	}
	switch strings.ToLower(strings.TrimSpace(c.Query("status"))) {
	case "completed":
		query = query.Where("top_ups.status = ?", common.TopUpStatusSuccess)
	case "pending":
		query = query.Where("top_ups.status = ?", common.TopUpStatusPending)
	case "failed":
		query = query.Where("top_ups.status NOT IN ?", []string{common.TopUpStatusSuccess, common.TopUpStatusPending})
	}
	if method := strings.ToLower(strings.TrimSpace(c.Query("method"))); method != "" {
		if method == model.PaymentProviderEpay {
			query = nextEpayTopUpQuery(query)
		} else if method == "other" {
			query = nextOtherTopUpQuery(query)
		} else {
			query = query.Where("top_ups.payment_provider = ? OR (top_ups.payment_provider = '' AND top_ups.payment_method = ?)", method, method)
		}
	}
	return query
}

func NextListAdminOrders(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	if orderType := strings.TrimSpace(c.Query("type")); orderType != "" && orderType != "topup" {
		common.ApiSuccess(c, gin.H{
			"items": []NextOrderDTO{}, "total": 0, "page": pageInfo.GetPage(), "page_size": pageInfo.GetPageSize(),
			"status_counts": map[string]int{}, "method_counts": map[string]int{}, "type_counts": map[string]int{"topup": 0}, "filtered_epay_revenue": 0,
		})
		return
	}
	query := nextAdminOrderQuery(c)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	aggregates := make([]*model.TopUp, 0)
	if err := nextAdminOrderQuery(c).
		Select("top_ups.status", "top_ups.payment_provider", "top_ups.payment_method", "top_ups.money").
		Find(&aggregates).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	statusCounts := map[string]int{"completed": 0, "pending": 0, "failed": 0}
	methodCounts := make(map[string]int)
	filteredEpayRevenue := 0.0
	for _, item := range aggregates {
		statusCounts[nextOrderStatus(item.Status)]++
		method := nextOrderMethod(item)
		methodCounts[method]++
		if method == model.PaymentProviderEpay && item.Status == common.TopUpStatusSuccess {
			filteredEpayRevenue += item.Money
		}
	}
	topUps := make([]*model.TopUp, 0)
	if err := query.Select("top_ups.*").Order("top_ups.id desc").
		Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topUps).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	usersByID, err := nextTopUpUsers(topUps)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]NextOrderDTO, 0, len(topUps))
	for _, topUp := range topUps {
		items = append(items, nextTopUpDTO(topUp, usersByID[topUp.UserId]))
	}
	common.ApiSuccess(c, gin.H{
		"items": items, "total": total, "page": pageInfo.GetPage(), "page_size": pageInfo.GetPageSize(),
		"status_counts": statusCounts, "method_counts": methodCounts,
		"type_counts": map[string]int{"topup": int(total)}, "filtered_epay_revenue": filteredEpayRevenue,
	})
}

func NextGetAdminOrder(c *gin.Context) {
	topUp := model.GetTopUpByTradeNo(c.Param("order_no"))
	if topUp == nil {
		nextBusinessError(c, "order not found", "NOT_FOUND")
		return
	}
	user, err := model.GetUserById(topUp.UserId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nextTopUpDTO(topUp, user))
}

func nextEpayRail(method string) string {
	value := strings.ToLower(strings.TrimSpace(method))
	switch {
	case strings.Contains(value, "ali"):
		return "alipay"
	case strings.Contains(value, "wx"), strings.Contains(value, "wechat"):
		return "wechat"
	default:
		return "other"
	}
}

func NextGetAdminOrderStats(c *gin.Context) {
	rangeDays, err := strconv.Atoi(c.DefaultQuery("range", "30"))
	if err != nil || (rangeDays != 7 && rangeDays != 30 && rangeDays != 90) {
		nextBusinessError(c, "invalid statistics range", "VALIDATION_ERROR")
		return
	}
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	start := today.AddDate(0, 0, -(rangeDays - 1))
	topUps := make([]*model.TopUp, 0)
	statsQuery := model.DB.Model(&model.TopUp{}).Where(
		"top_ups.status = ? AND (top_ups.complete_time >= ? OR (top_ups.complete_time = 0 AND top_ups.create_time >= ?))",
		common.TopUpStatusSuccess, start.Unix(), start.Unix(),
	)
	if err := nextEpayTopUpQuery(statsQuery).
		Order("top_ups.complete_time asc, top_ups.create_time asc").Find(&topUps).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	type dailyValue struct {
		Revenue float64
		Orders  int
	}
	dailyByDate := make(map[string]dailyValue, rangeDays)
	for offset := 0; offset < rangeDays; offset++ {
		dailyByDate[start.AddDate(0, 0, offset).Format("2006-01-02")] = dailyValue{}
	}
	totalRevenue := 0.0
	todayRevenue := 0.0
	todayOrders := 0
	paymentShares := make(map[string]struct {
		Amount float64
		Count  int
	})
	type spenderValue struct {
		Amount float64
		Orders int
	}
	spenders := make(map[int]spenderValue)
	for _, topUp := range topUps {
		completedTime := topUp.CompleteTime
		if completedTime == 0 {
			completedTime = topUp.CreateTime
		}
		completedAt := time.Unix(completedTime, 0).In(now.Location())
		date := completedAt.Format("2006-01-02")
		daily := dailyByDate[date]
		daily.Revenue += topUp.Money
		daily.Orders++
		dailyByDate[date] = daily
		totalRevenue += topUp.Money
		if !completedAt.Before(today) {
			todayRevenue += topUp.Money
			todayOrders++
		}
		rail := nextEpayRail(topUp.PaymentMethod)
		share := paymentShares[rail]
		share.Amount += topUp.Money
		share.Count++
		paymentShares[rail] = share
		spender := spenders[topUp.UserId]
		spender.Amount += topUp.Money
		spender.Orders++
		spenders[topUp.UserId] = spender
	}
	daily := make([]gin.H, 0, rangeDays)
	for offset := 0; offset < rangeDays; offset++ {
		date := start.AddDate(0, 0, offset).Format("2006-01-02")
		value := dailyByDate[date]
		daily = append(daily, gin.H{"date": date, "revenue": value.Revenue, "orders": value.Orders})
	}
	paymentShare := make([]gin.H, 0, len(paymentShares))
	for method, value := range paymentShares {
		paymentShare = append(paymentShare, gin.H{"method": method, "amount": value.Amount, "count": value.Count})
	}
	sort.Slice(paymentShare, func(i, j int) bool {
		return paymentShare[i]["amount"].(float64) > paymentShare[j]["amount"].(float64)
	})
	usersByID, err := nextTopUpUsers(topUps)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	topSpenders := make([]gin.H, 0, len(spenders))
	for userID, value := range spenders {
		user := usersByID[userID]
		username, email := "", ""
		if user != nil {
			username, email = user.Username, user.Email
		}
		topSpenders = append(topSpenders, gin.H{
			"user_id": userID, "username": username, "email": email,
			"amount": value.Amount, "orders": value.Orders,
		})
	}
	sort.Slice(topSpenders, func(i, j int) bool {
		return topSpenders[i]["amount"].(float64) > topSpenders[j]["amount"].(float64)
	})
	if len(topSpenders) > 10 {
		topSpenders = topSpenders[:10]
	}
	averageAmount := 0.0
	if len(topUps) > 0 {
		averageAmount = totalRevenue / float64(len(topUps))
	}
	common.ApiSuccess(c, gin.H{
		"range": rangeDays, "generated_at": now.Unix(), "currency": "CNY",
		"today_revenue": todayRevenue, "today_orders": todayOrders,
		"total_revenue": totalRevenue, "total_orders": len(topUps), "average_amount": averageAmount,
		"daily": daily, "payment_share": paymentShare, "top_spenders": topSpenders,
	})
}
