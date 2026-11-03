package controller

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// partnerServerAccountRequest resolves the authenticated partner and the
// external user ID in the path, writing the error response when either is
// unusable.
func partnerServerAccountRequest(c *gin.Context) (*service.PartnerServerSnapshot, string, bool) {
	if !ensurePartnerOAuthHost(c) || rejectPartnerIntegrationQuery(c) {
		return nil, "", false
	}
	return partnerServerAccountTarget(c)
}

// partnerServerAccountTarget is partnerServerAccountRequest without the query
// check, for the one endpoint that takes query parameters.
func partnerServerAccountTarget(c *gin.Context) (*service.PartnerServerSnapshot, string, bool) {
	principal := middleware.PartnerServerPrincipalFrom(c)
	if principal == nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return nil, "", false
	}
	externalUserID := c.Param("external_user_id")
	if !service.ValidPartnerExternalUserID(externalUserID) {
		writePartnerIntegrationAPIError(c, &service.PartnerOAuthError{Status: http.StatusBadRequest, Code: "invalid_external_user_id",
			Description: "external_user_id must be 32-64 characters of A-Z, a-z, 0-9, '.', '_' or '-'"})
		return nil, "", false
	}
	return principal.Partner, externalUserID, true
}

// readPartnerServerJSON reads a small JSON object body and rejects fields
// outside allowed. An empty body counts as {}.
func readPartnerServerJSON(c *gin.Context, allowed ...string) (map[string]json.RawMessage, error) {
	invalid := func(description string) error {
		return &service.PartnerOAuthError{Status: http.StatusBadRequest, Code: "invalid_request", Description: description}
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, service.PartnerOAuthJSONLimit)
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return nil, invalid("request body is invalid")
	}
	if strings.TrimSpace(string(body)) == "" {
		return map[string]json.RawMessage{}, nil
	}
	media := strings.ToLower(strings.TrimSpace(strings.Split(c.GetHeader("Content-Type"), ";")[0]))
	if media != "application/json" {
		return nil, &service.PartnerOAuthError{Status: http.StatusUnsupportedMediaType, Code: "unsupported_media_type", Description: "content type must be application/json"}
	}
	var fields map[string]json.RawMessage
	if err := common.Unmarshal(body, &fields); err != nil || fields == nil {
		return nil, invalid("request body must be a JSON object")
	}
	for name := range fields {
		if !slices.Contains(allowed, name) {
			return nil, invalid(fmt.Sprintf("unknown field %q", name))
		}
	}
	return fields, nil
}

// writePartnerServerError answers a failed partner server operation. Known
// conditions get their API error; anything else is a generic server error
// with only the request ID logged.
func writePartnerServerError(c *gin.Context, err error) {
	if typed := service.PartnerAccountError(err); typed != nil {
		if typed.Code == "rate_limited" {
			c.Header("Retry-After", "60")
		}
		writePartnerIntegrationAPIError(c, typed)
		return
	}
	if typed := service.AsPartnerOAuthError(err); typed != nil {
		writePartnerIntegrationAPIError(c, typed)
		return
	}
	logger.LogError(c.Request.Context(), common.LogText("partner server request failed (request_id=%s): %s", c.GetString(common.RequestIdKey), err.Error()))
	writePartnerIntegrationAPIError(c, err)
}

func recordPartnerAccountLog(c *gin.Context, action string, partner *service.PartnerServerSnapshot, userID int, reason string, status int) {
	model.RecordPartnerOAuthAuthorizationLog(c, model.PartnerOauthAuthorizationLog{Action: action, Success: true,
		ClientId: partner.ClientId, TargetUserId: userID, Reason: reason, Status: status})
}

func PartnerServerGetAccount(c *gin.Context) {
	partner, externalUserID, ok := partnerServerAccountRequest(c)
	if !ok {
		return
	}
	account, err := model.GetPartnerAccount(partner.ClientId, externalUserID)
	if err != nil {
		writePartnerServerError(c, err)
		return
	}
	view, err := service.BuildPartnerAccountView(account)
	if err != nil {
		writePartnerServerError(c, err)
		return
	}
	c.JSON(http.StatusOK, view)
}

// PartnerServerIssueCredential returns the account's key, creating the
// account and its key on first use. Repeated calls return the same key.
func PartnerServerIssueCredential(c *gin.Context) {
	partner, externalUserID, ok := partnerServerAccountRequest(c)
	if !ok {
		return
	}
	if _, err := readPartnerServerJSON(c); err != nil {
		writePartnerServerError(c, err)
		return
	}
	view, result, err := service.IssuePartnerAccountCredential(partner, externalUserID)
	if err != nil {
		writePartnerServerError(c, err)
		return
	}
	if result.AccountCreated {
		recordPartnerAccountLog(c, "partner_account.create", partner, result.Account.UserId, "", http.StatusOK)
	}
	if result.KeyCreated {
		recordPartnerAccountLog(c, "partner_account.credential_issue", partner, result.Account.UserId, "", http.StatusOK)
	}
	c.JSON(http.StatusOK, view)
}

func PartnerServerRotateCredential(c *gin.Context) {
	partner, externalUserID, ok := partnerServerAccountRequest(c)
	if !ok {
		return
	}
	keyHash, err := service.ValidatePartnerOAuthIdempotencyKey(c.GetHeader("Idempotency-Key"))
	if err != nil {
		writePartnerServerError(c, err)
		return
	}
	fields, err := readPartnerServerJSON(c, "revoke_old")
	if err != nil {
		writePartnerServerError(c, err)
		return
	}
	mode := service.PartnerAccountRevokeAfterGrace
	if raw, present := fields["revoke_old"]; present {
		if common.Unmarshal(raw, &mode) != nil || (mode != service.PartnerAccountRevokeAfterGrace && mode != service.PartnerAccountRevokeImmediately) {
			writePartnerServerError(c, &service.PartnerOAuthError{Status: http.StatusBadRequest, Code: "invalid_request", Description: `revoke_old must be "after_grace" or "immediately"`})
			return
		}
	}
	view, result, err := service.RotatePartnerAccountCredential(partner, externalUserID, keyHash, mode)
	if err != nil {
		writePartnerServerError(c, err)
		return
	}
	if !result.Replayed {
		recordPartnerAccountLog(c, "partner_account.credential_rotate", partner, result.Account.UserId, mode, http.StatusOK)
	}
	c.JSON(http.StatusOK, view)
}

func partnerServerSetAccountEnabled(c *gin.Context, enabled bool) {
	partner, externalUserID, ok := partnerServerAccountRequest(c)
	if !ok {
		return
	}
	if _, err := readPartnerServerJSON(c); err != nil {
		writePartnerServerError(c, err)
		return
	}
	account, err := service.SetPartnerAccountEnabled(partner, externalUserID, enabled)
	if err != nil {
		writePartnerServerError(c, err)
		return
	}
	action := "partner_account.disable"
	if enabled {
		action = "partner_account.enable"
	}
	recordPartnerAccountLog(c, action, partner, account.UserId, "", http.StatusOK)
	view, err := service.BuildPartnerAccountView(account)
	if err != nil {
		writePartnerServerError(c, err)
		return
	}
	c.JSON(http.StatusOK, view)
}

func PartnerServerDisableAccount(c *gin.Context) {
	partnerServerSetAccountEnabled(c, false)
}

func PartnerServerEnableAccount(c *gin.Context) {
	partnerServerSetAccountEnabled(c, true)
}

const (
	partnerServerUsageMaxSpan     = 31 * 24 * 60 * 60
	partnerServerUsageMaxLookback = 90 * 24 * 60 * 60
	partnerServerUsageMaxPageSize = 100
	partnerServerUsageMaxOffset   = 10000
)

// parsePartnerServerUsageQuery reads the bounded usage query: a time range of
// at most 31 days within the last 90 days, and a page of at most 100 rows.
func parsePartnerServerUsageQuery(c *gin.Context, now int64) (start, end int64, page, pageSize int, err error) {
	invalid := func(description string) error {
		return &service.PartnerOAuthError{Status: http.StatusBadRequest, Code: "invalid_request", Description: description}
	}
	values, parseErr := url.ParseQuery(c.Request.URL.RawQuery)
	if parseErr != nil {
		return 0, 0, 0, 0, invalid("query is invalid")
	}
	ints := map[string]int64{"start_time": 0, "end_time": now, "page": 1, "page_size": 50}
	for name, items := range values {
		if _, known := ints[name]; !known {
			return 0, 0, 0, 0, invalid(fmt.Sprintf("unknown parameter %q", name))
		}
		if len(items) != 1 {
			return 0, 0, 0, 0, invalid(fmt.Sprintf("parameter %q is repeated", name))
		}
		value, convErr := strconv.ParseInt(items[0], 10, 64)
		if convErr != nil {
			return 0, 0, 0, 0, invalid(fmt.Sprintf("parameter %q must be an integer", name))
		}
		ints[name] = value
	}
	end = ints["end_time"]
	start = ints["start_time"]
	if _, given := values["start_time"]; !given {
		start = end - 24*60*60
	}
	page, pageSize = int(ints["page"]), int(ints["page_size"])
	switch {
	case start >= end:
		return 0, 0, 0, 0, invalid("start_time must be before end_time")
	case end-start > partnerServerUsageMaxSpan:
		return 0, 0, 0, 0, invalid("the time range may span at most 31 days")
	case start < now-partnerServerUsageMaxLookback:
		return 0, 0, 0, 0, invalid("usage is available for the last 90 days")
	case pageSize < 1 || pageSize > partnerServerUsageMaxPageSize:
		return 0, 0, 0, 0, invalid("page_size must be between 1 and 100")
	case page < 1 || (page-1)*pageSize >= partnerServerUsageMaxOffset:
		return 0, 0, 0, 0, invalid("page is out of range; narrow the time range instead")
	}
	return start, end, page, pageSize, nil
}

// PartnerServerAccountUsage lists a sub-account's model usage, newest first.
func PartnerServerAccountUsage(c *gin.Context) {
	if !ensurePartnerOAuthHost(c) {
		return
	}
	partner, externalUserID, ok := partnerServerAccountTarget(c)
	if !ok {
		return
	}
	start, end, page, pageSize, err := parsePartnerServerUsageQuery(c, common.GetTimestamp())
	if err != nil {
		writePartnerServerError(c, err)
		return
	}
	account, err := model.GetPartnerAccount(partner.ClientId, externalUserID)
	if err != nil {
		writePartnerServerError(c, err)
		return
	}
	items, hasMore, err := model.ListPartnerAccountUsage(account.UserId, start, end, (page-1)*pageSize, pageSize)
	if err != nil {
		writePartnerServerError(c, err)
		return
	}
	if items == nil {
		items = []model.PartnerAccountUsage{}
	}
	c.JSON(http.StatusOK, gin.H{"external_user_id": externalUserID, "page": page, "page_size": pageSize, "has_more": hasMore, "items": items})
}
