package controller

import (
	"crypto/rand"
	"errors"
	"math/big"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	cliDeviceAuthorizationTTL              = 10 * 60
	cliDeviceAuthorizationInterval         = 5
	cliDeviceAuthorizationRetention        = 24 * 60 * 60
	cliDeviceAuthorizationCleanupInterval  = 5 * 60
	cliDeviceAuthorizationCleanupBatchSize = 100
	cliDeviceAuthorizationMaxClientName    = 64
	cliDeviceAuthorizationMaxClientVersion = 32
	cliDeviceAuthorizationMaxDeviceId      = 128
	defaultCliClientName                   = "flatkey-cli"
	cliUserCodeChars                       = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
)

var (
	nextCliDeviceAuthorizationCleanupAt   atomic.Int64
	cleanupExpiredCliDeviceAuthorizations = model.CleanupExpiredCliDeviceAuthorizations
)

type createCliDeviceAuthorizationRequest struct {
	ClientName    string `json:"client_name"`
	ClientVersion string `json:"client_version"`
	DeviceId      string `json:"device_id"`
}

type pollCliDeviceAuthorizationRequest struct {
	DeviceCode string `json:"device_code"`
}

func CreateCliDeviceAuthorization(c *gin.Context) {
	request := createCliDeviceAuthorizationRequest{}
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	clientName := strings.TrimSpace(request.ClientName)
	clientVersion := strings.TrimSpace(request.ClientVersion)
	deviceId := strings.TrimSpace(request.DeviceId)
	if deviceId == "" {
		common.ApiErrorI18n(c, i18n.MsgCliDeviceIdMissing)
		return
	}
	if len(clientName) > cliDeviceAuthorizationMaxClientName ||
		len(clientVersion) > cliDeviceAuthorizationMaxClientVersion ||
		len(deviceId) > cliDeviceAuthorizationMaxDeviceId {
		common.ApiErrorI18n(c, i18n.MsgCliDeviceMetadataTooLong)
		return
	}

	deviceCode, err := common.GenerateRandomCharsKey(64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userCode, err := generateCliUserCode()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	now := common.GetTimestamp()
	if clientName == "" {
		clientName = defaultCliClientName
	}
	maybeCleanupExpiredCliDeviceAuthorizations(now)
	auth := model.CliDeviceAuthorization{
		DeviceCodeHash: hashCliDeviceCode(deviceCode),
		UserCodeHash:   hashCliUserCode(userCode),
		Status:         model.CliDeviceAuthorizationStatusPending,
		ClientName:     clientName,
		ClientVersion:  clientVersion,
		DeviceIdHash:   hashCliDeviceId(deviceId),
		CreatedTime:    now,
		ExpiresAt:      now + cliDeviceAuthorizationTTL,
	}
	if err := model.CreateCliDeviceAuthorization(&auth); err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, gin.H{
		"device_code":               deviceCode,
		"user_code":                 userCode,
		"verification_uri":          buildCliVerificationURL(""),
		"verification_uri_complete": buildCliVerificationURL(userCode),
		"expires_in":                cliDeviceAuthorizationTTL,
		"interval":                  cliDeviceAuthorizationInterval,
	})
}

func PollCliDeviceAuthorization(c *gin.Context) {
	request := pollCliDeviceAuthorizationRequest{}
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	consumption, err := model.ConsumeCliDeviceAuthorization(hashCliDeviceCode(request.DeviceCode), common.GetTimestamp())
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorI18n(c, i18n.MsgCliDeviceCodeInvalid)
			return
		}
		common.ApiError(c, err)
		return
	}

	auth := consumption.Authorization
	data := gin.H{"status": auth.Status}
	if consumption.Consumed {
		token := consumption.Token
		data["api_key"] = tokenKeyWithPrefix(token.GetFullKey())
		data["token_id"] = token.Id
		data["user_id"] = token.UserId
		data["expires_at"] = auth.ExpiresAt
		data["consumed_at"] = auth.ConsumedAt
	}
	common.ApiSuccess(c, data)
}

func GetCliDeviceAuthorization(c *gin.Context) {
	auth, ok := getCliAuthorizationForUserCode(c, c.Param("user_code"))
	if !ok {
		return
	}
	common.ApiSuccess(c, cliAuthorizationResponse(auth, common.GetTimestamp()))
}

func ApproveCliDeviceAuthorization(c *gin.Context) {
	auth, ok := getCliAuthorizationForUserCode(c, c.Param("user_code"))
	if !ok {
		return
	}
	now := common.GetTimestamp()
	if auth.Status != model.CliDeviceAuthorizationStatusPending {
		common.ApiSuccess(c, cliAuthorizationResponse(auth, now))
		return
	}
	if auth.ExpiresAt <= now {
		var err error
		auth, err = model.ExpireCliDeviceAuthorization(auth.Id, now)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		common.ApiSuccess(c, cliAuthorizationResponse(auth, now))
		return
	}

	key, err := common.GenerateKey()
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgTokenGenerateFailed)
		common.SysLog("failed to generate cli token key: " + err.Error())
		return
	}
	token := model.Token{
		Name:             "Flatkey CLI",
		Key:              key,
		CreatedTime:      now,
		AccessedTime:     now,
		ExpiredTime:      -1,
		UnlimitedQuota:   true,
		Source:           model.TokenSourceCLI,
		DeviceIdHash:     auth.DeviceIdHash,
		ClientName:       auth.ClientName,
		ClientVersion:    auth.ClientVersion,
		LastUsedClientAt: now,
	}
	cleanToken, err := buildTokenForInsert(c, token, key)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := applyInitialTokenDefaults(c, &cleanToken); err != nil {
		common.ApiError(c, err)
		return
	}
	approval, err := model.ApproveCliDeviceAuthorizationWithToken(
		auth.Id,
		c.GetInt("id"),
		cleanToken,
		operation_setting.GetMaxUserTokens(),
		model.InviteRewardTriggerManualTokenCreate,
		now,
	)
	if err != nil {
		if errors.Is(err, model.ErrUserTokenLimitReached) {
			common.ApiErrorI18n(c, i18n.MsgTokenLimitReached, map[string]any{"Max": operation_setting.GetMaxUserTokens()})
			return
		}
		common.ApiError(c, err)
		return
	}
	if approval == nil {
		common.ApiErrorI18n(c, i18n.MsgCliAuthorizationTokenCreateFail)
		return
	}
	common.ApiSuccess(c, cliAuthorizationResponse(&approval.Authorization, now))
}

func DenyCliDeviceAuthorization(c *gin.Context) {
	auth, ok := getCliAuthorizationForUserCode(c, c.Param("user_code"))
	if !ok {
		return
	}
	now := common.GetTimestamp()
	auth, err := model.DenyCliDeviceAuthorization(auth.Id, now)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, cliAuthorizationResponse(auth, now))
}

func getCliAuthorizationForUserCode(c *gin.Context, userCode string) (*model.CliDeviceAuthorization, bool) {
	normalized := normalizeCliUserCode(userCode)
	if normalized == "" {
		common.ApiErrorI18n(c, i18n.MsgCliAuthorizationCodeMissing)
		return nil, false
	}
	auth, err := model.GetCliDeviceAuthorizationByUserCodeHash(hashCliUserCode(normalized))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": i18n.T(c, i18n.MsgCliAuthorizationNotFound)})
			return nil, false
		}
		common.ApiError(c, err)
		return nil, false
	}
	return auth, true
}

func cliAuthorizationResponse(auth *model.CliDeviceAuthorization, now int64) gin.H {
	status := auth.Status
	if status == model.CliDeviceAuthorizationStatusPending && auth.ExpiresAt <= now {
		status = model.CliDeviceAuthorizationStatusExpired
	}
	return gin.H{
		"status":         status,
		"client_name":    auth.ClientName,
		"client_version": auth.ClientVersion,
		"expires_at":     auth.ExpiresAt,
		"approved_at":    auth.ApprovedAt,
	}
}

func maybeCleanupExpiredCliDeviceAuthorizations(now int64) {
	next := nextCliDeviceAuthorizationCleanupAt.Load()
	if now < next || !nextCliDeviceAuthorizationCleanupAt.CompareAndSwap(next, now+cliDeviceAuthorizationCleanupInterval) {
		return
	}
	deleted, err := cleanupExpiredCliDeviceAuthorizations(now-cliDeviceAuthorizationRetention, cliDeviceAuthorizationCleanupBatchSize)
	if err != nil {
		common.SysLog("failed to cleanup expired cli device authorizations: " + err.Error())
		return
	}
	if deleted > 0 {
		common.SysLog("cleaned expired cli device authorizations: " + strconv.FormatInt(deleted, 10))
	}
}

func generateCliUserCode() (string, error) {
	code := make([]byte, 8)
	max := big.NewInt(int64(len(cliUserCodeChars)))
	for i := range code {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		code[i] = cliUserCodeChars[n.Int64()]
	}
	return string(code[:4]) + "-" + string(code[4:]), nil
}

func normalizeCliUserCode(code string) string {
	return strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(code), "-", ""))
}

func hashCliUserCode(code string) string {
	return common.GenerateHMAC("cli_user_code:" + normalizeCliUserCode(code))
}

func hashCliDeviceCode(code string) string {
	return common.GenerateHMAC("cli_device_code:" + strings.TrimSpace(code))
}

func hashCliDeviceId(deviceId string) string {
	return common.GenerateHMAC("cli_device_id:" + strings.TrimSpace(deviceId))
}

func tokenKeyWithPrefix(key string) string {
	if strings.HasPrefix(key, "sk-") {
		return key
	}
	return "sk-" + key
}

func buildCliVerificationURL(userCode string) string {
	base := cliConsoleReturnPath("/cli/authorize")
	if userCode == "" {
		return base
	}
	return base + "?user_code=" + url.QueryEscape(userCode)
}

func cliConsoleReturnPath(suffix string) string {
	base, err := system_setting.NormalizeAppConsoleOrigin(system_setting.GetAppConsoleSettings().Origin)
	if err != nil || base == "" {
		base, err = system_setting.NormalizeAppConsoleOrigin(system_setting.ServerAddress)
		if err != nil || base == "" {
			base = "http://localhost:3000"
		}
	}
	return strings.TrimRight(base, "/") + common.ThemeAwarePath(suffix)
}
