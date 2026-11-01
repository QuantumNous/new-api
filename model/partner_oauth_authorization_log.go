package model

import (
	"context"
	"errors"
	"net"
	"regexp"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/gin-gonic/gin"
)

// PartnerOauthAuthorizationLog contains only allowlisted metadata, never OAuth
// credentials, raw request paths, query parameters or request/response bodies.
// The spelling Oauth preserves GORM's prefixed partner_oauth_authorization_logs
// naming without a hardcoded TableName override.
type PartnerOauthAuthorizationLog struct {
	EventId      string `json:"event_id" gorm:"type:varchar(64);primaryKey"`
	CreatedAt    int64  `json:"created_at" gorm:"type:bigint;index"`
	Action       string `json:"action" gorm:"type:varchar(64);index"`
	Success      bool   `json:"success"`
	Reason       string `json:"reason" gorm:"type:varchar(32)"`
	ActorUserId  int    `json:"actor_user_id"`
	TargetUserId int    `json:"target_user_id" gorm:"index"`
	ClientId     string `json:"client_id" gorm:"type:varchar(64);index"`
	BindingId    string `json:"binding_id" gorm:"type:varchar(64)"`
	RequestId    string `json:"request_id" gorm:"type:varchar(64)"`
	Ip           string `json:"ip" gorm:"type:varchar(64)"`
	Route        string `json:"route" gorm:"type:varchar(128)"`
	Status       int    `json:"status"`
}

type PartnerOauthAuthorizationLogFilter struct {
	Action       string
	Success      *bool
	ClientId     string
	TargetUserId int
	Start        int64
	End          int64
}

// 13 columns per row keeps a batch far below every dialect's bind-parameter limit.
const partnerOAuthLogBatchSize = 500

var (
	partnerOAuthLogClientID  = regexp.MustCompile(`^pc_[0-9a-f]{32}$`)
	partnerOAuthLogBindingID = regexp.MustCompile(`^bnd_[0-9a-f]{32}$`)
	partnerOAuthLogRequestID = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,64}$`)
)

func ValidPartnerOAuthLogClientID(id string) bool {
	return partnerOAuthLogClientID.MatchString(id)
}

func ValidPartnerOAuthLogBindingID(id string) bool {
	return partnerOAuthLogBindingID.MatchString(id)
}

func ValidPartnerOAuthLogAction(action string) bool {
	switch action {
	case "partner_oauth.consent.approve", "partner_oauth.consent.deny",
		"partner_oauth.token.issue", "partner_oauth.code.replay_detected",
		"partner_oauth.refresh.reuse_detected", "partner_oauth.binding.revoke",
		"partner_oauth.binding.admin_revoke", "partner_oauth.binding.client_delete",
		"partner_oauth.credential.issue", "partner_oauth.payment.order_create",
		"partner_server.token_issue", "partner_server.token_issue_failed", "partner_server.auth_denied",
		"partner_server.secret_issue", "partner_server.secret_revoke",
		"partner_server.suspend", "partner_server.resume", "partner_server.keys_revoke_all",
		"partner_account.create", "partner_account.credential_issue", "partner_account.credential_rotate",
		"partner_account.credential_rate_limited", "partner_account.disable", "partner_account.enable",
		"partner_account.payment_order_create":
		return true
	}
	return false
}

func ValidPartnerOAuthLogReason(reason string) bool {
	switch reason {
	case "", "code_replay", "refresh_reuse", "revoked", "user_revoked", "admin_revoked", "client_deleted",
		"invalid_secret", "ip_not_allowed", "partner_unavailable", "invalid_token", "rate_limited",
		"immediately", "after_grace":
		return true
	}
	return false
}

// RecordPartnerOAuthAuthorizationLog validates every stored field before insertion.
// A failed write is surfaced in server logs by request ID, without including DB
// errors (which may contain input). The authorization result is never changed.
func RecordPartnerOAuthAuthorizationLog(c *gin.Context, entry PartnerOauthAuthorizationLog) {
	RecordPartnerOAuthAuthorizationLogs(c, []PartnerOauthAuthorizationLog{entry})
}

// RecordPartnerOAuthAuthorizationLogs writes the valid entries of one request in
// batches, so bulk revocations do not cost one log database round-trip per row.
func RecordPartnerOAuthAuthorizationLogs(c *gin.Context, entries []PartnerOauthAuthorizationLog) {
	ctx := context.Background()
	requestID, ip, route := "", "", ""
	if c != nil && c.Request != nil {
		ctx = c.Request.Context()
		requestID = c.GetString(common.RequestIdKey)
		ip = c.ClientIP()
		route = c.FullPath()
	}
	if !partnerOAuthLogRequestID.MatchString(requestID) {
		requestID = common.NewRequestId()
	}
	if net.ParseIP(ip) == nil {
		ip = ""
	}
	valid := make([]PartnerOauthAuthorizationLog, 0, len(entries))
	for _, entry := range entries {
		entry.EventId = common.NewRequestId() // Never persist a caller-provided identifier.
		entry.RequestId = requestID
		entry.Ip = ip
		entry.Route = route
		if entry.CreatedAt == 0 {
			entry.CreatedAt = common.GetTimestamp()
		}
		if !ValidPartnerOAuthLogAction(entry.Action) || !ValidPartnerOAuthLogReason(entry.Reason) ||
			(entry.ClientId != "" && !ValidPartnerOAuthLogClientID(entry.ClientId)) ||
			(entry.BindingId != "" && !ValidPartnerOAuthLogBindingID(entry.BindingId)) ||
			entry.ActorUserId < 0 || entry.TargetUserId < 0 || entry.Status < 100 || entry.Status > 599 ||
			len(entry.Ip) > 64 || len(entry.Route) > 128 ||
			(c != nil && entry.Route == "") {
			logger.LogError(ctx, common.LogText("partner oauth authorization log rejected (request_id=%s): invalid metadata", requestID))
			continue
		}
		valid = append(valid, entry)
	}
	if len(valid) == 0 {
		return
	}
	if LOG_DB == nil {
		logger.LogError(ctx, common.LogText("partner oauth authorization log write failed (request_id=%s): log database unavailable", requestID))
		return
	}
	var err error
	if common.UsingLogDatabase(common.DatabaseTypeClickHouse) {
		err = LOG_DB.Table("partner_oauth_authorization_logs").CreateInBatches(&valid, partnerOAuthLogBatchSize).Error
	} else {
		err = LOG_DB.CreateInBatches(&valid, partnerOAuthLogBatchSize).Error
	}
	if err != nil {
		logger.LogError(ctx, common.LogText("partner oauth authorization log write failed (request_id=%s): database error", requestID))
	}
}

func GetPartnerOAuthAuthorizationLogs(filter PartnerOauthAuthorizationLogFilter, offset, limit int) ([]PartnerOauthAuthorizationLog, int64, error) {
	if LOG_DB == nil {
		return nil, 0, errors.New("log database unavailable")
	}
	query := LOG_DB.Model(&PartnerOauthAuthorizationLog{})
	if filter.Action != "" {
		query = query.Where("action = ?", filter.Action)
	}
	if filter.Success != nil {
		query = query.Where("success = ?", *filter.Success)
	}
	if filter.ClientId != "" {
		query = query.Where("client_id = ?", filter.ClientId)
	}
	if filter.TargetUserId > 0 {
		query = query.Where("target_user_id = ?", filter.TargetUserId)
	}
	if filter.Start > 0 {
		query = query.Where("created_at >= ?", filter.Start)
	}
	if filter.End > 0 {
		query = query.Where("created_at <= ?", filter.End)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	items := make([]PartnerOauthAuthorizationLog, 0)
	err := query.Order("created_at DESC").Order("event_id DESC").Offset(offset).Limit(limit).Find(&items).Error
	return items, total, err
}

func MigratePartnerOAuthAuthorizationLogs() error {
	if !common.UsingLogDatabase(common.DatabaseTypeClickHouse) {
		return LOG_DB.AutoMigrate(&PartnerOauthAuthorizationLog{})
	}
	return LOG_DB.Exec(`CREATE TABLE IF NOT EXISTS partner_oauth_authorization_logs (
		event_id String, created_at Int64, action String, success UInt8, reason String,
		actor_user_id Int64, target_user_id Int64, client_id String, binding_id String,
		request_id String, ip String, route String, status Int32
	) ENGINE = MergeTree()
	PARTITION BY toYYYYMM(toDateTime(created_at))
	ORDER BY (created_at, event_id)`).Error
}
