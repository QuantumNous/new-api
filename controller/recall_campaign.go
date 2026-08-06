package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

var (
	recallRuntimeProvider              = service.GetRecallRuntime
	notifyRecallSchedulerConfigChanged = service.NotifyRecallSchedulerConfigChanged
)

type recallClaimRequest struct {
	Claim        string `json:"claim"`
	PriceID      string `json:"price_id,omitempty"`
	PurchaseKind string `json:"purchase_kind,omitempty"`
}

type recallRetryRequest struct {
	AcknowledgeUncertain bool `json:"acknowledge_uncertain"`
}

type recallEmailQuotaUpdateRequest struct {
	Limit int `json:"limit"`
}

type recallCodedActionError interface {
	error
	Code() string
	Message() string
}

type recallPreviewResponse struct {
	service.RecallAudiencePreview
	Stripe *service.RecallStripePreview `json:"stripe"`
}

type recallAudienceUserOption struct {
	ID          int    `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
	Status      int    `json:"status"`
}

const maxRecallAudienceUserKeywordRunes = 128

var recallEmailOpenPixelGIF = []byte{
	0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
	0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00,
	0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
	0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
}

func ListRecallCampaigns(c *gin.Context) {
	runtime, err := recallControllerRuntime()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	page := recallPageQuery(c)
	items, total, err := runtime.Campaigns.List(c.Request.Context(), page, c.Query("status"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	page.SetTotal(int(total))
	page.SetItems(items)
	common.ApiSuccess(c, page)
}

func CreateRecallCampaign(c *gin.Context) {
	var draft service.RecallCampaignDraft
	if err := common.DecodeJson(c.Request.Body, &draft); err != nil {
		common.ApiError(c, err)
		return
	}
	runtime, err := recallControllerRuntime()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	campaign, err := runtime.Campaigns.SaveDraft(c.Request.Context(), c.GetInt("id"), draft)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, campaign)
}

func GetRecallCampaign(c *gin.Context) {
	id, err := recallPathID(c, "id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	runtime, err := recallControllerRuntime()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	detail, err := runtime.Campaigns.GetDetail(c.Request.Context(), id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, detail)
}

func UpdateRecallCampaign(c *gin.Context) {
	id, err := recallPathID(c, "id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var draft service.RecallCampaignDraft
	if err := common.DecodeJson(c.Request.Body, &draft); err != nil {
		common.ApiError(c, err)
		return
	}
	runtime, err := recallControllerRuntime()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	campaign, err := runtime.Campaigns.UpdateDraft(c.Request.Context(), c.GetInt("id"), id, draft)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, campaign)
}

func GenerateRecallEmailTranslations(c *gin.Context) {
	id, err := recallPathID(c, "id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var request service.RecallEmailGenerationRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiError(c, err)
		return
	}
	runtime, err := recallControllerRuntime()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response, err := runtime.Campaigns.EnqueueEmailTranslations(c.Request.Context(), c.GetInt("id"), id, request)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recallAccepted(c, response)
}

func GetRecallEmailQuotaStatus(c *gin.Context) {
	limit := operation_setting.GetRecallCampaignSetting().EmailHourlyLimit
	status, err := model.GetRecallEmailQuotaStatusWithContext(c.Request.Context(), limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, status)
}

func UpdateRecallEmailQuotaLimit(c *gin.Context) {
	var request recallEmailQuotaUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request"})
		return
	}
	if request.Limit < 1 || request.Limit > 100000 {
		common.ApiError(c, fmt.Errorf("recall campaign email hourly limit must be between 1 and 100000"))
		return
	}
	if err := model.UpdateOption("recall_campaign_setting.email_hourly_limit", strconv.Itoa(request.Limit)); err != nil {
		common.ApiError(c, err)
		return
	}
	notifyRecallSchedulerConfigChanged()
	status, err := model.GetRecallEmailQuotaStatusWithContext(c.Request.Context(), request.Limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, status)
}

func GetRecallActivitySMTP(c *gin.Context) {
	common.ApiSuccess(c, service.GetRecallActivitySMTPStatus())
}

func UpdateRecallActivitySMTP(c *gin.Context) {
	var request service.RecallActivitySMTPInput
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request"})
		return
	}
	status, err := service.UpdateRecallActivitySMTP(request)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, status)
}

func PreviewRecallCampaign(c *gin.Context) {
	id, err := recallPathID(c, "id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	sampleSize := 20
	if raw := strings.TrimSpace(c.Query("sample_size")); raw != "" {
		sampleSize, err = strconv.Atoi(raw)
		if err != nil || sampleSize < 0 || sampleSize > 100 {
			common.ApiError(c, fmt.Errorf("recall sample_size must be between 0 and 100"))
			return
		}
	}
	runtime, err := recallControllerRuntime()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	audience, stripePreview, err := runtime.Campaigns.Preview(c.Request.Context(), id, sampleSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, recallPreviewResponse{RecallAudiencePreview: audience, Stripe: stripePreview})
}

func PreviewRecallEmailTemplate(c *gin.Context) {
	var request service.RecallEmailPreviewRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiError(c, err)
		return
	}
	preview, err := service.PreviewRecallEmail(request)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, preview)
}

func ListRecallAudienceUsers(c *gin.Context) {
	lookup, empty, err := recallAudienceUserLookupQuery(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if empty {
		common.ApiSuccess(c, []recallAudienceUserOption{})
		return
	}
	users, err := model.ListRecallAudienceUserOptionsWithContext(c.Request.Context(), lookup)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	options := make([]recallAudienceUserOption, 0, len(users))
	for _, user := range users {
		options = append(options, recallAudienceUserOption{
			ID:          user.Id,
			Username:    user.Username,
			DisplayName: user.DisplayName,
			Email:       user.Email,
			Status:      user.Status,
		})
	}
	common.ApiSuccess(c, options)
}

func ActivateRecallCampaign(c *gin.Context) {
	recallCampaignAction(c, func(runtime *service.RecallRuntime, actorID int, campaignID int64) error {
		return runtime.Campaigns.Activate(c.Request.Context(), actorID, campaignID)
	})
}

func PauseRecallCampaign(c *gin.Context) {
	recallCampaignAction(c, func(runtime *service.RecallRuntime, actorID int, campaignID int64) error {
		return runtime.Campaigns.Pause(c.Request.Context(), actorID, campaignID)
	})
}

func ResumeRecallCampaign(c *gin.Context) {
	recallCampaignAction(c, func(runtime *service.RecallRuntime, actorID int, campaignID int64) error {
		return runtime.Campaigns.Resume(c.Request.Context(), actorID, campaignID)
	})
}

func CancelRecallCampaign(c *gin.Context) {
	recallCampaignAction(c, func(runtime *service.RecallRuntime, actorID int, campaignID int64) error {
		return runtime.Campaigns.Cancel(c.Request.Context(), actorID, campaignID)
	})
}

func CompleteRecallCampaign(c *gin.Context) {
	recallCampaignAction(c, func(runtime *service.RecallRuntime, actorID int, campaignID int64) error {
		return runtime.Campaigns.Complete(c.Request.Context(), actorID, campaignID)
	})
}

func ListRecallRecipients(c *gin.Context) {
	id, err := recallPathID(c, "id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	runtime, err := recallControllerRuntime()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	page := recallPageQuery(c)
	items, total, err := runtime.Campaigns.ListRecipients(c.Request.Context(), id, page, c.Query("state"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	page.SetTotal(int(total))
	page.SetItems(items)
	common.ApiSuccess(c, page)
}

func ListRecallEvents(c *gin.Context) {
	id, err := recallPathID(c, "id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	runtime, err := recallControllerRuntime()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	page := recallPageQuery(c)
	items, total, err := runtime.Campaigns.ListEvents(c.Request.Context(), id, page)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	page.SetTotal(int(total))
	page.SetItems(items)
	common.ApiSuccess(c, page)
}

func GetRecallCampaignMetrics(c *gin.Context) {
	id, err := recallPathID(c, "id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	runtime, err := recallControllerRuntime()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	metrics, err := runtime.Attribution.GetMetrics(c.Request.Context(), id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, metrics)
}

func ExportRecallCampaign(c *gin.Context) {
	id, err := recallPathID(c, "id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	runtime, err := recallControllerRuntime()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	data, err := runtime.Campaigns.Export(c.Request.Context(), id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=recall-campaign-%d.csv", id))
	c.Data(http.StatusOK, "text/csv; charset=utf-8", data)
}

func RetryRecallRecipient(c *gin.Context) {
	campaignID, err := recallPathID(c, "id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recipientID, err := recallPathID(c, "rid")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	request := recallRetryRequest{}
	if c.Request.ContentLength != 0 {
		if err := common.DecodeJson(c.Request.Body, &request); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	runtime, err := recallControllerRuntime()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := runtime.Campaigns.RetryRecipient(c.Request.Context(), c.GetInt("id"), campaignID, recipientID, request.AcknowledgeUncertain); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func recallAudienceUserLookupQuery(c *gin.Context) (model.RecallAudienceUserLookup, bool, error) {
	keyword := strings.TrimSpace(c.Query("keyword"))
	rawIDs := strings.TrimSpace(c.Query("ids"))
	hasKeyword := keyword != ""
	hasIDs := rawIDs != ""
	if hasKeyword && hasIDs {
		return model.RecallAudienceUserLookup{}, false, fmt.Errorf("recall audience users require exactly one lookup mode")
	}
	if !hasKeyword && !hasIDs {
		return model.RecallAudienceUserLookup{}, true, nil
	}
	if hasKeyword && len([]rune(keyword)) > maxRecallAudienceUserKeywordRunes {
		return model.RecallAudienceUserLookup{}, false, fmt.Errorf("recall audience users keyword must be at most %d characters", maxRecallAudienceUserKeywordRunes)
	}
	if hasIDs {
		ids, err := parseRecallAudienceUserIDs(rawIDs)
		if err != nil {
			return model.RecallAudienceUserLookup{}, false, err
		}
		return model.RecallAudienceUserLookup{IDs: ids}, false, nil
	}
	pageSize := 20
	if rawPageSize := strings.TrimSpace(c.Query("page_size")); rawPageSize != "" {
		parsed, err := strconv.Atoi(rawPageSize)
		if err != nil || parsed <= 0 {
			return model.RecallAudienceUserLookup{}, false, fmt.Errorf("recall audience users page_size must be positive")
		}
		pageSize = parsed
	}
	if pageSize > 50 {
		pageSize = 50
	}
	return model.RecallAudienceUserLookup{Keyword: keyword, PageSize: pageSize}, false, nil
}

func parseRecallAudienceUserIDs(raw string) ([]int, error) {
	parts := strings.Split(raw, ",")
	if len(parts) == 0 || len(parts) > 500 {
		return nil, fmt.Errorf("recall audience users ids must include 1 to 500 positive integers")
	}
	seen := make(map[int]struct{}, len(parts))
	ids := make([]int, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		id, err := strconv.Atoi(part)
		if err != nil || id <= 0 {
			return nil, fmt.Errorf("recall audience users ids must be positive integers")
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return nil, fmt.Errorf("recall audience users ids must include positive integers")
	}
	return ids, nil
}

func ValidateRecallStripeConfig(c *gin.Context) {
	var draft service.RecallCampaignDraft
	if err := common.DecodeJson(c.Request.Body, &draft); err != nil {
		common.ApiError(c, err)
		return
	}
	runtime, err := recallControllerRuntime()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	preview, err := runtime.Campaigns.ValidateStripe(c.Request.Context(), draft)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, preview)
}

func ValidateRecallClaim(c *gin.Context) {
	request := recallClaimRequest{}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiError(c, err)
		return
	}
	runtime, err := recallControllerRuntime()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	view, err := runtime.Claims.ValidateClaimForPurchase(c.Request.Context(), c.GetInt("id"), request.Claim, request.PurchaseKind, request.PriceID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, view)
}

func ListRecallOffers(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	runtime, err := recallControllerRuntime()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	offers, err := runtime.Claims.ListOffers(c.Request.Context(), c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if offers == nil {
		offers = []service.RecallOfferView{}
	}
	common.ApiSuccess(c, offers)
}

func UnsubscribeRecallEmail(c *gin.Context) {
	runtime, err := recallControllerRuntime()
	if err == nil {
		err = runtime.Claims.Unsubscribe(c.Request.Context(), c.Query("token"))
	}
	zh := strings.HasPrefix(strings.ToLower(strings.TrimSpace(c.GetHeader("Accept-Language"))), "zh")
	if err != nil {
		message := "This unsubscribe link is invalid or expired."
		if zh {
			message = "\u9000\u8ba2\u94fe\u63a5\u65e0\u6548\u6216\u5df2\u8fc7\u671f\u3002"
		}
		c.Data(http.StatusBadRequest, "text/html; charset=utf-8", []byte("<!doctype html><html><body><p>"+message+"</p></body></html>"))
		return
	}
	message := "You have been unsubscribed from recall emails."
	if zh {
		message = "\u4f60\u5df2\u9000\u8ba2\u53ec\u56de\u8425\u9500\u90ae\u4ef6\u3002"
	}
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte("<!doctype html><html><body><p>"+message+"</p></body></html>"))
}

func TrackRecallEmailOpen(c *gin.Context) {
	err := service.RecordRecallEmailOpen(c.Request.Context(), c.Query("token"), time.Now())
	if err != nil && !errors.Is(err, service.ErrRecallEmailOpenInvalid) {
		logger.LogWarn(c.Request.Context(), "record recall email open failed")
	}
	c.Header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
	c.Header("Pragma", "no-cache")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Data(http.StatusOK, "image/gif", recallEmailOpenPixelGIF)
}

// UnsubscribeRecallEmailOneClick implements the RFC 8058 POST target advertised
// by List-Unsubscribe-Post. Mailbox providers post here without user
// interaction, so it renders no page and never redirects.
func UnsubscribeRecallEmailOneClick(c *gin.Context) {
	runtime, err := recallControllerRuntime()
	if err == nil {
		err = runtime.Claims.Unsubscribe(c.Request.Context(), c.Query("token"))
	}
	status := http.StatusOK
	if err != nil {
		status = http.StatusBadRequest
	}
	// The response carries no body, so flush the status explicitly instead of
	// relying on a later write to commit it.
	c.Status(status)
	c.Writer.WriteHeaderNow()
}

func recallCampaignAction(c *gin.Context, action func(*service.RecallRuntime, int, int64) error) {
	id, err := recallPathID(c, "id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	runtime, err := recallControllerRuntime()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := action(runtime, c.GetInt("id"), id); err != nil {
		var blocked *service.RecallActivationBlockedError
		if errors.As(err, &blocked) {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
				"data":    gin.H{"blockers": blocked.Blockers},
			})
			return
		}
		var coded recallCodedActionError
		if errors.As(err, &coded) {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": coded.Message(),
				"data":    gin.H{"code": coded.Code()},
			})
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func recallControllerRuntime() (*service.RecallRuntime, error) {
	runtime := recallRuntimeProvider()
	if runtime == nil {
		return nil, fmt.Errorf("recall runtime is unavailable")
	}
	return runtime, nil
}

func recallPageQuery(c *gin.Context) *common.PageInfo {
	page := common.GetPageQuery(c)
	if page.Page < 1 {
		page.Page = 1
	}
	if page.PageSize < 1 {
		page.PageSize = common.ItemsPerPage
	}
	if page.PageSize > 100 {
		page.PageSize = 100
	}
	return page
}

func recallPathID(c *gin.Context, key string) (int64, error) {
	id, err := strconv.ParseInt(strings.TrimSpace(c.Param(key)), 10, 64)
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("recall %s must be a positive integer", key)
	}
	return id, nil
}
