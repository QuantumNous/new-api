package controller

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	channelContributionMaxModels            = 100
	channelContributionTestResultTTLSeconds = int64(30 * 60)
	channelContributionProbeTimeoutSeconds  = 30
)

type channelContributionInput struct {
	Name         string            `json:"name"`
	Type         int               `json:"type"`
	BaseURL      string            `json:"base_url"`
	APIEndpoint  string            `json:"api_endpoint"`
	APIKey       *string           `json:"api_key"`
	Key          *string           `json:"key"`
	Group        string            `json:"group"`
	Models       []string          `json:"models"`
	ModelMapping map[string]string `json:"model_mapping"`
}

type channelContributionSubmitInput struct {
	TestRunId         int64  `json:"test_run_id"`
	AgreementAccepted bool   `json:"agreement_accepted"`
	AgreementVersion  string `json:"agreement_version"`
}

type channelContributionAdminReviewInput struct {
	TestRunId int64  `json:"test_run_id"`
	Reason    string `json:"reason"`
}

type channelContributionSettingsInput struct {
	Tag                        *string  `json:"tag"`
	AllowedGroups              []string `json:"allowed_groups"`
	AllowedChannelTypes        []int    `json:"allowed_channel_types"`
	Priority                   *int64   `json:"priority"`
	Weight                     *uint    `json:"weight"`
	UnavailableDeleteHours     *int     `json:"unavailable_delete_hours"`
	HealthCheckIntervalMinutes *int     `json:"health_check_interval_minutes"`
	RewardBps                  *int     `json:"reward_bps"`
	AgreementVersion           *string  `json:"agreement_version"`
	AgreementContent           *string  `json:"agreement_content"`
}

type channelContributionChannelTypeOption struct {
	Value int    `json:"value"`
	Label string `json:"label"`
}

type channelContributionSettingsResponse struct {
	operation_setting.ChannelContributionSetting
	SupportedChannelTypes []channelContributionChannelTypeOption `json:"supported_channel_types"`
}

type channelContributionRevisionResponse struct {
	Id                  int                                     `json:"id"`
	RevisionNumber      int                                     `json:"revision_number"`
	Name                string                                  `json:"name"`
	Type                int                                     `json:"type"`
	BaseURL             string                                  `json:"base_url"`
	HasAPIKey           bool                                    `json:"has_api_key"`
	Group               string                                  `json:"group"`
	Models              []string                                `json:"models"`
	ModelMapping        map[string]string                       `json:"model_mapping"`
	Status              model.ChannelContributionRevisionStatus `json:"status"`
	PriceConfigured     bool                                    `json:"price_configured"`
	UnpricedModels      []string                                `json:"unpriced_models"`
	AgreementVersion    string                                  `json:"agreement_version"`
	AgreementHash       string                                  `json:"agreement_hash"`
	AgreementAcceptedAt int64                                   `json:"agreement_accepted_at"`
	SubmittedAt         int64                                   `json:"submitted_at"`
	ReviewerId          int                                     `json:"reviewer_id"`
	ReviewerUsername    string                                  `json:"reviewer_username"`
	ReviewedAt          int64                                   `json:"reviewed_at"`
	ReviewReason        string                                  `json:"review_reason"`
	CreatedAt           int64                                   `json:"created_at"`
	UpdatedAt           int64                                   `json:"updated_at"`
}

type channelContributionModelHealthResponse struct {
	Id             int64  `json:"id"`
	ContributionId int    `json:"contribution_id"`
	RevisionId     int    `json:"revision_id"`
	ChannelId      int    `json:"channel_id"`
	Model          string `json:"model"`
	Healthy        bool   `json:"healthy"`
	FailureSince   int64  `json:"failure_since"`
	LastCheckedAt  int64  `json:"last_checked_at"`
	LastSuccessAt  int64  `json:"last_success_at"`
	LastFailureAt  int64  `json:"last_failure_at"`
	LastError      string `json:"last_error"`
	CreatedAt      int64  `json:"created_at"`
	UpdatedAt      int64  `json:"updated_at"`
}

type channelContributionResponse struct {
	Id                 int                                      `json:"id"`
	UserId             int                                      `json:"user_id"`
	Username           string                                   `json:"username"`
	Status             model.ChannelContributionStatus          `json:"status"`
	RevisionStatus     model.ChannelContributionRevisionStatus  `json:"revision_status"`
	ChannelId          *int                                     `json:"channel_id"`
	CurrentRevisionId  *int                                     `json:"current_revision_id"`
	PendingRevisionId  *int                                     `json:"pending_revision_id"`
	ApprovedRevisionId *int                                     `json:"approved_revision_id"`
	CurrentRevision    *channelContributionRevisionResponse     `json:"current_revision"`
	PendingRevision    *channelContributionRevisionResponse     `json:"pending_revision"`
	ApprovedRevision   *channelContributionRevisionResponse     `json:"approved_revision"`
	LatestTestRun      *channelContributionTestRunResponse      `json:"latest_test_run"`
	SubmittedAt        int64                                    `json:"submitted_at"`
	ReviewerId         int                                      `json:"reviewer_id"`
	ReviewerUsername   string                                   `json:"reviewer_username"`
	ReviewedAt         int64                                    `json:"reviewed_at"`
	ReviewReason       string                                   `json:"review_reason"`
	UnavailableSince   int64                                    `json:"unavailable_since"`
	ModelHealth        []channelContributionModelHealthResponse `json:"model_health,omitempty"`
	CreatedAt          int64                                    `json:"created_at"`
	UpdatedAt          int64                                    `json:"updated_at"`
}

func channelContributionAgreementHash(content string) string {
	sum := sha256.Sum256([]byte(content))
	return fmt.Sprintf("%x", sum[:])
}

func channelContributionModels(raw string) []string {
	parts := strings.Split(raw, ",")
	models := make([]string, 0, len(parts))
	for _, item := range parts {
		item = strings.TrimSpace(item)
		if item != "" {
			models = append(models, item)
		}
	}
	return models
}

func channelContributionMapping(raw string) map[string]string {
	mapping := map[string]string{}
	if strings.TrimSpace(raw) != "" {
		_ = common.UnmarshalJsonStr(raw, &mapping)
	}
	return mapping
}

func channelContributionPriceStatus(models []string) (bool, []string) {
	unpriced := make([]string, 0)
	for _, modelName := range models {
		if !helper.HasModelBillingConfig(modelName) {
			unpriced = append(unpriced, modelName)
		}
	}
	return len(models) > 0 && len(unpriced) == 0, unpriced
}

func channelContributionTypeOptions(channelTypes []int) []channelContributionChannelTypeOption {
	options := make([]channelContributionChannelTypeOption, 0, len(channelTypes))
	for _, channelType := range channelTypes {
		options = append(options, channelContributionChannelTypeOption{
			Value: channelType,
			Label: constant.GetChannelTypeName(channelType),
		})
	}
	return options
}

func buildChannelContributionSettingsResponse(setting operation_setting.ChannelContributionSetting) channelContributionSettingsResponse {
	return channelContributionSettingsResponse{
		ChannelContributionSetting: setting,
		SupportedChannelTypes:      channelContributionTypeOptions(operation_setting.GetSupportedChannelContributionTypes()),
	}
}

func normalizeChannelContributionInput(input channelContributionInput, previous *model.ChannelContributionRevision) (*model.ChannelContributionRevision, error) {
	setting := operation_setting.GetChannelContributionSetting()
	revision := &model.ChannelContributionRevision{}

	revision.Name = strings.TrimSpace(input.Name)
	if revision.Name == "" || len(revision.Name) > 128 {
		return nil, errors.New("name must contain 1 to 128 characters")
	}

	revision.Type = input.Type
	if revision.Type == 0 && previous != nil {
		revision.Type = previous.Type
	}
	if revision.Type == 0 {
		revision.Type = constant.ChannelTypeOpenAI
	}
	if err := model.ValidateContributionChannelType(revision.Type); err != nil {
		return nil, err
	}
	if !setting.IsChannelTypeAllowed(revision.Type) {
		return nil, errors.New("channel type is not enabled for contribution")
	}

	revision.BaseURL = strings.TrimSpace(input.BaseURL)
	if revision.BaseURL == "" {
		revision.BaseURL = strings.TrimSpace(input.APIEndpoint)
	}
	revision.BaseURL = strings.TrimRight(revision.BaseURL, "/")
	parsedURL, err := url.ParseRequestURI(revision.BaseURL)
	if err != nil || parsedURL.Host == "" || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") || parsedURL.User != nil || parsedURL.RawQuery != "" || parsedURL.Fragment != "" {
		return nil, errors.New("base_url must be an absolute HTTP or HTTPS URL without credentials, query, or fragment")
	}
	if err := service.ValidateStrictSSRFProtectedFetchURL(revision.BaseURL); err != nil {
		return nil, fmt.Errorf("base_url is not allowed: %w", err)
	}

	if input.APIKey != nil && input.Key != nil && strings.TrimSpace(*input.APIKey) != strings.TrimSpace(*input.Key) {
		return nil, errors.New("api_key and key must match when both are provided")
	}
	providedKey := input.APIKey
	if providedKey == nil {
		providedKey = input.Key
	}
	if providedKey != nil && strings.TrimSpace(*providedKey) != "" {
		revision.Key = strings.TrimSpace(*providedKey)
	} else if previous != nil {
		revision.Key = previous.Key
	}
	if revision.Key == "" {
		return nil, errors.New("api_key is required")
	}
	if len(revision.Key) > 16_384 || strings.ContainsAny(revision.Key, "\r\n") {
		return nil, errors.New("api_key must be a single key no longer than 16384 characters")
	}

	revision.Group = strings.TrimSpace(input.Group)
	if revision.Group == "" && previous != nil {
		revision.Group = previous.Group
	}
	if revision.Group == "" && len(setting.AllowedGroups) > 0 {
		revision.Group = strings.TrimSpace(setting.AllowedGroups[0])
	}
	if !setting.IsGroupAllowed(revision.Group) {
		return nil, errors.New("group is not enabled for contribution")
	}

	seenModels := make(map[string]struct{}, len(input.Models))
	models := make([]string, 0, len(input.Models))
	for _, rawModel := range input.Models {
		modelName := strings.TrimSpace(rawModel)
		if modelName == "" || len(modelName) > 255 || strings.Contains(modelName, ",") {
			return nil, errors.New("models contains an invalid model name")
		}
		if _, exists := seenModels[modelName]; exists {
			continue
		}
		seenModels[modelName] = struct{}{}
		models = append(models, modelName)
	}
	if len(models) > channelContributionMaxModels {
		return nil, fmt.Errorf("at most %d models may be contributed", channelContributionMaxModels)
	}

	mapping := make(map[string]string, len(input.ModelMapping))
	for modelName, upstreamName := range input.ModelMapping {
		modelName = strings.TrimSpace(modelName)
		upstreamName = strings.TrimSpace(upstreamName)
		if _, exists := seenModels[modelName]; !exists {
			return nil, fmt.Errorf("model mapping source %q is not in models", modelName)
		}
		if upstreamName == "" || len(upstreamName) > 255 {
			return nil, fmt.Errorf("model mapping target for %q is invalid", modelName)
		}
		mapping[modelName] = upstreamName
	}
	mappingJSON, err := common.Marshal(mapping)
	if err != nil {
		return nil, err
	}
	revision.Models = strings.Join(models, ",")
	revision.ModelMapping = string(mappingJSON)

	if len(models) > 0 {
		revisionForProbe := *revision
		if _, err := resolveChannelContributionProbeSpecs(&revisionForProbe); err != nil {
			return nil, err
		}
	}

	revision.ConfigHash, err = model.ComputeChannelContributionConfigHash(revision)
	if err != nil {
		return nil, err
	}
	return revision, nil
}

func buildChannelContributionRevisionResponse(revision *model.ChannelContributionRevision) *channelContributionRevisionResponse {
	if revision == nil {
		return nil
	}
	models := channelContributionModels(revision.Models)
	priceConfigured, unpriced := channelContributionPriceStatus(models)
	return &channelContributionRevisionResponse{
		Id:                  revision.Id,
		RevisionNumber:      revision.RevisionNumber,
		Name:                revision.Name,
		Type:                revision.Type,
		BaseURL:             revision.BaseURL,
		HasAPIKey:           strings.TrimSpace(revision.Key) != "",
		Group:               revision.Group,
		Models:              models,
		ModelMapping:        channelContributionMapping(revision.ModelMapping),
		Status:              revision.Status,
		PriceConfigured:     priceConfigured,
		UnpricedModels:      unpriced,
		AgreementVersion:    revision.AgreementVersion,
		AgreementHash:       revision.AgreementHash,
		AgreementAcceptedAt: revision.AgreementAcceptedAt,
		SubmittedAt:         revision.SubmittedAt,
		ReviewerId:          revision.ReviewerId,
		ReviewerUsername:    revision.ReviewerUsername,
		ReviewedAt:          revision.ReviewedAt,
		ReviewReason:        revision.ReviewReason,
		CreatedAt:           revision.CreatedAt,
		UpdatedAt:           revision.UpdatedAt,
	}
}

func loadChannelContributionRevision(id *int) (*model.ChannelContributionRevision, error) {
	if id == nil || *id <= 0 {
		return nil, nil
	}
	revision, err := model.GetChannelContributionRevisionById(*id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return revision, err
}

func buildChannelContributionResponse(contribution *model.ChannelContribution, includeTestResults bool) (*channelContributionResponse, error) {
	current, err := loadChannelContributionRevision(contribution.CurrentRevisionId)
	if err != nil {
		return nil, err
	}
	pending, err := loadChannelContributionRevision(contribution.PendingRevisionId)
	if err != nil {
		return nil, err
	}
	approved, err := loadChannelContributionRevision(contribution.ApprovedRevisionId)
	if err != nil {
		return nil, err
	}

	var latestRunResponse *channelContributionTestRunResponse
	if current != nil {
		latestRun, runErr := model.GetLatestChannelContributionTestRun(current.Id, current.ConfigHash)
		if runErr == nil {
			latestRunResponse, err = buildChannelContributionTestRunResponse(latestRun, includeTestResults)
			if err != nil {
				return nil, err
			}
		} else if !errors.Is(runErr, gorm.ErrRecordNotFound) {
			return nil, runErr
		}
	}

	var healthResponse []channelContributionModelHealthResponse
	if includeTestResults {
		healthRows, healthErr := model.GetChannelContributionModelHealth(contribution.Id)
		if healthErr != nil {
			return nil, healthErr
		}
		healthResponse = make([]channelContributionModelHealthResponse, 0, len(healthRows))
		for _, health := range healthRows {
			healthResponse = append(healthResponse, channelContributionModelHealthResponse{
				Id:             health.Id,
				ContributionId: health.ContributionId,
				RevisionId:     health.RevisionId,
				ChannelId:      health.ChannelId,
				Model:          health.Model,
				Healthy:        health.Healthy,
				FailureSince:   health.FailureSince,
				LastCheckedAt:  health.LastCheckedAt,
				LastSuccessAt:  health.LastSuccessAt,
				LastFailureAt:  health.LastFailureAt,
				LastError:      health.LastError,
				CreatedAt:      health.CreatedAt,
				UpdatedAt:      health.UpdatedAt,
			})
		}
	}

	revisionStatus := model.ChannelContributionRevisionStatus("")
	if pending != nil {
		revisionStatus = pending.Status
	} else if current != nil {
		revisionStatus = current.Status
	}
	return &channelContributionResponse{
		Id:                 contribution.Id,
		UserId:             contribution.UserId,
		Username:           contribution.Username,
		Status:             contribution.Status,
		RevisionStatus:     revisionStatus,
		ChannelId:          contribution.ChannelId,
		CurrentRevisionId:  contribution.CurrentRevisionId,
		PendingRevisionId:  contribution.PendingRevisionId,
		ApprovedRevisionId: contribution.ApprovedRevisionId,
		CurrentRevision:    buildChannelContributionRevisionResponse(current),
		PendingRevision:    buildChannelContributionRevisionResponse(pending),
		ApprovedRevision:   buildChannelContributionRevisionResponse(approved),
		LatestTestRun:      latestRunResponse,
		SubmittedAt:        contribution.SubmittedAt,
		ReviewerId:         contribution.ReviewerId,
		ReviewerUsername:   contribution.ReviewerUsername,
		ReviewedAt:         contribution.ReviewedAt,
		ReviewReason:       contribution.ReviewReason,
		UnavailableSince:   contribution.UnavailableSince,
		ModelHealth:        healthResponse,
		CreatedAt:          contribution.CreatedAt,
		UpdatedAt:          contribution.UpdatedAt,
	}, nil
}

func channelContributionId(c *gin.Context) (int, error) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		return 0, errors.New("invalid contribution id")
	}
	return id, nil
}

func GetChannelContributionConfig(c *gin.Context) {
	setting := operation_setting.GetChannelContributionSetting()
	types := channelContributionTypeOptions(setting.AllowedChannelTypes)
	common.ApiSuccess(c, gin.H{
		"enabled":                       true,
		"allowed_groups":                setting.AllowedGroups,
		"allowed_channel_types":         types,
		"max_models":                    channelContributionMaxModels,
		"test_result_ttl_seconds":       channelContributionTestResultTTLSeconds,
		"probe_timeout_seconds":         channelContributionProbeTimeoutSeconds,
		"unavailable_delete_hours":      setting.UnavailableDeleteHours,
		"health_check_interval_minutes": setting.HealthCheckIntervalMinutes,
		"reward_bps":                    setting.RewardBps,
		"agreement_version":             setting.AgreementVersion,
		"agreement_content":             setting.AgreementContent,
		"agreement_hash":                channelContributionAgreementHash(setting.AgreementContent),
	})
}

func ListUserChannelContributions(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	contributions, total, err := model.ListUserChannelContributions(c.GetInt("id"), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]*channelContributionResponse, 0, len(contributions))
	for _, contribution := range contributions {
		item, err := buildChannelContributionResponse(contribution, false)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		items = append(items, item)
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func CreateChannelContribution(c *gin.Context) {
	var input channelContributionInput
	if err := common.DecodeJson(c.Request.Body, &input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request body"})
		return
	}
	revision, err := normalizeChannelContributionInput(input, nil)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	contribution := &model.ChannelContribution{
		UserId:   c.GetInt("id"),
		Username: c.GetString("username"),
		Status:   model.ChannelContributionStatusDraft,
	}
	if err := model.CreateChannelContributionWithRevision(contribution, revision); err != nil {
		common.ApiError(c, err)
		return
	}
	response, err := buildChannelContributionResponse(contribution, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, response)
}

func GetUserChannelContribution(c *gin.Context) {
	id, err := channelContributionId(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	contribution, err := model.GetUserChannelContributionById(id, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response, err := buildChannelContributionResponse(contribution, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, response)
}

func UpdateUserChannelContribution(c *gin.Context) {
	id, err := channelContributionId(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	contribution, err := model.GetUserChannelContributionById(id, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	current, err := loadChannelContributionRevision(contribution.CurrentRevisionId)
	if err != nil || current == nil {
		if err == nil {
			err = errors.New("current revision is missing")
		}
		common.ApiError(c, err)
		return
	}
	var input channelContributionInput
	if err := common.DecodeJson(c.Request.Body, &input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request body"})
		return
	}
	revision, err := normalizeChannelContributionInput(input, current)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.CreateChannelContributionRevision(id, c.GetInt("id"), revision); err != nil {
		common.ApiError(c, err)
		return
	}
	contribution, err = model.GetUserChannelContributionById(id, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response, err := buildChannelContributionResponse(contribution, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, response)
}

func FetchChannelContributionModels(c *gin.Context) {
	id, err := channelContributionId(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	contribution, err := model.GetUserChannelContributionById(id, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	revision, err := loadChannelContributionRevision(contribution.CurrentRevisionId)
	if err != nil || revision == nil {
		if err == nil {
			err = errors.New("current revision is missing")
		}
		common.ApiError(c, err)
		return
	}
	baseURL := revision.BaseURL
	mapping := revision.ModelMapping
	channel := &model.Channel{
		Type:         revision.Type,
		Key:          revision.Key,
		Name:         revision.Name,
		BaseURL:      &baseURL,
		Group:        revision.Group,
		ModelMapping: &mapping,
	}
	strictClient := *service.GetStrictSSRFProtectedHTTPClient()
	strictClient.Timeout = channelContributionProbeTimeoutSeconds * time.Second
	models, err := fetchChannelUpstreamModelIDsWithOptions(channel, fetchChannelModelsOptions{
		UseSSRFProtectedClient: true,
		HTTPClient:             &strictClient,
	})
	if err != nil {
		common.ApiError(c, sanitizeChannelCredentialError(err, revision.Key, revision.BaseURL))
		return
	}
	normalized := make([]string, 0, len(models))
	seen := make(map[string]struct{}, len(models))
	for _, modelName := range models {
		modelName = strings.TrimSpace(modelName)
		if modelName == "" || len(modelName) > 255 || strings.Contains(modelName, ",") {
			continue
		}
		if _, exists := seen[modelName]; exists {
			continue
		}
		seen[modelName] = struct{}{}
		normalized = append(normalized, modelName)
	}
	sort.Strings(normalized)
	if len(normalized) > channelContributionMaxModels {
		normalized = normalized[:channelContributionMaxModels]
	}
	common.ApiSuccess(c, gin.H{"models": normalized})
}

func SubmitUserChannelContribution(c *gin.Context) {
	id, err := channelContributionId(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var input channelContributionSubmitInput
	if err := common.DecodeJson(c.Request.Body, &input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request body"})
		return
	}
	if !input.AgreementAccepted {
		common.ApiErrorMsg(c, "channel contribution agreement must be accepted")
		return
	}
	setting := operation_setting.GetChannelContributionSetting()
	if input.AgreementVersion != setting.AgreementVersion {
		common.ApiErrorMsg(c, "channel contribution agreement version has changed")
		return
	}
	contribution, err := model.GetUserChannelContributionById(id, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	revision, err := loadChannelContributionRevision(contribution.CurrentRevisionId)
	if err != nil || revision == nil {
		if err == nil {
			err = errors.New("current revision is missing")
		}
		common.ApiError(c, err)
		return
	}
	computedConfigHash, err := model.ComputeChannelContributionConfigHash(revision)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if computedConfigHash != revision.ConfigHash {
		common.ApiErrorMsg(c, "channel contribution configuration changed; save and test it again")
		return
	}
	if err := validateChannelContributionSubmissionRun(input.TestRunId, contribution, revision, model.ChannelContributionTestActorUser); err != nil {
		common.ApiError(c, err)
		return
	}
	priceReady, unpriced := channelContributionPriceStatus(channelContributionModels(revision.Models))
	if !priceReady {
		common.ApiError(c, fmt.Errorf("models without configured price: %s", strings.Join(unpriced, ", ")))
		return
	}
	now := common.GetTimestamp()
	agreementContent := setting.AgreementContent
	if err := model.SubmitChannelContribution(
		id,
		c.GetInt("id"),
		revision.Id,
		revision.ConfigHash,
		setting.AgreementVersion,
		agreementContent,
		channelContributionAgreementHash(agreementContent),
		now,
	); err != nil {
		common.ApiError(c, err)
		return
	}
	contribution, err = model.GetUserChannelContributionById(id, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response, err := buildChannelContributionResponse(contribution, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, response)
}

func WithdrawUserChannelContribution(c *gin.Context) {
	id, err := channelContributionId(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.WithdrawChannelContribution(id, c.GetInt("id")); err != nil {
		common.ApiError(c, err)
		return
	}
	contribution, err := model.GetUserChannelContributionById(id, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response, err := buildChannelContributionResponse(contribution, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, response)
}

func ListAdminChannelContributions(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	status := model.ChannelContributionStatus(strings.TrimSpace(c.Query("status")))
	if status != "" && !model.IsValidChannelContributionStatus(status) {
		common.ApiErrorMsg(c, "invalid contribution status")
		return
	}
	contributions, total, err := model.ListChannelContributions(status, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]*channelContributionResponse, 0, len(contributions))
	for _, contribution := range contributions {
		item, err := buildChannelContributionResponse(contribution, false)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		items = append(items, item)
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetAdminChannelContribution(c *gin.Context) {
	id, err := channelContributionId(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	contribution, err := model.GetChannelContributionById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response, err := buildChannelContributionResponse(contribution, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, response)
}

func ApproveAdminChannelContribution(c *gin.Context) {
	id, err := channelContributionId(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var input channelContributionAdminReviewInput
	if err := common.DecodeJson(c.Request.Body, &input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request body"})
		return
	}
	contribution, err := model.GetChannelContributionById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	revision, err := loadChannelContributionRevision(contribution.PendingRevisionId)
	if err != nil || revision == nil {
		if err == nil {
			err = errors.New("pending revision is missing")
		}
		common.ApiError(c, err)
		return
	}
	computedConfigHash, err := model.ComputeChannelContributionConfigHash(revision)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if computedConfigHash != revision.ConfigHash {
		common.ApiErrorMsg(c, "channel contribution configuration changed; submit and test it again")
		return
	}
	if err := validateChannelContributionSubmissionRun(input.TestRunId, contribution, revision, model.ChannelContributionTestActorAdmin); err != nil {
		common.ApiError(c, err)
		return
	}
	priceReady, unpriced := channelContributionPriceStatus(channelContributionModels(revision.Models))
	if !priceReady {
		common.ApiError(c, fmt.Errorf("models without configured price: %s", strings.Join(unpriced, ", ")))
		return
	}
	setting := operation_setting.GetChannelContributionSetting()
	approved, _, err := model.ApproveChannelContribution(id, revision.Id, model.ChannelContributionApproval{
		ReviewerId:       c.GetInt("id"),
		ReviewerUsername: c.GetString("username"),
		Tag:              setting.Tag,
		Priority:         setting.Priority,
		Weight:           setting.Weight,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response, err := buildChannelContributionResponse(approved, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, response)
}

func RejectAdminChannelContribution(c *gin.Context) {
	id, err := channelContributionId(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var input channelContributionAdminReviewInput
	if err := common.DecodeJson(c.Request.Body, &input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request body"})
		return
	}
	reason := strings.TrimSpace(input.Reason)
	if reason == "" || len(reason) > 500 {
		common.ApiErrorMsg(c, "reason must contain 1 to 500 characters")
		return
	}
	contribution, err := model.GetChannelContributionById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if contribution.PendingRevisionId == nil {
		common.ApiErrorMsg(c, "pending revision is missing")
		return
	}
	if err := model.RejectChannelContribution(id, *contribution.PendingRevisionId, c.GetInt("id"), c.GetString("username"), reason); err != nil {
		common.ApiError(c, err)
		return
	}
	contribution, err = model.GetChannelContributionById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response, err := buildChannelContributionResponse(contribution, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, response)
}

func DeleteAdminChannelContribution(c *gin.Context) {
	id, err := channelContributionId(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	reason := strings.TrimSpace(c.Query("reason"))
	if len(reason) > 500 {
		common.ApiErrorMsg(c, "reason must not exceed 500 characters")
		return
	}
	if err := model.DeleteChannelContribution(id, c.GetInt("id"), c.GetString("username"), reason); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func GetAdminChannelContributionSettings(c *gin.Context) {
	setting := *operation_setting.GetChannelContributionSetting()
	common.ApiSuccess(c, buildChannelContributionSettingsResponse(setting))
}

func UpdateAdminChannelContributionSettings(c *gin.Context) {
	var input channelContributionSettingsInput
	if err := common.DecodeJson(c.Request.Body, &input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request body"})
		return
	}
	current := *operation_setting.GetChannelContributionSetting()
	updated := current
	if input.Tag != nil {
		updated.Tag = strings.TrimSpace(*input.Tag)
	}
	if input.AllowedGroups != nil {
		updated.AllowedGroups = input.AllowedGroups
	}
	if input.AllowedChannelTypes != nil {
		updated.AllowedChannelTypes = input.AllowedChannelTypes
	}
	if input.Priority != nil {
		updated.Priority = *input.Priority
	}
	if input.Weight != nil {
		updated.Weight = *input.Weight
	}
	if input.UnavailableDeleteHours != nil {
		updated.UnavailableDeleteHours = *input.UnavailableDeleteHours
	}
	if input.HealthCheckIntervalMinutes != nil {
		updated.HealthCheckIntervalMinutes = *input.HealthCheckIntervalMinutes
	}
	if input.RewardBps != nil {
		updated.RewardBps = *input.RewardBps
	}
	if input.AgreementVersion != nil {
		updated.AgreementVersion = strings.TrimSpace(*input.AgreementVersion)
	}
	if input.AgreementContent != nil {
		updated.AgreementContent = *input.AgreementContent
	}
	versionChanged := updated.AgreementVersion != current.AgreementVersion
	contentChanged := updated.AgreementContent != current.AgreementContent
	if versionChanged != contentChanged {
		common.ApiErrorMsg(c, "agreement_version and agreement_content must change together")
		return
	}

	groupsJSON, err := common.Marshal(updated.AllowedGroups)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	typesJSON, err := common.Marshal(updated.AllowedChannelTypes)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	values := map[string]string{
		operation_setting.ChannelContributionSettingPrefix + "tag":                           updated.Tag,
		operation_setting.ChannelContributionSettingPrefix + "allowed_groups":                string(groupsJSON),
		operation_setting.ChannelContributionSettingPrefix + "allowed_channel_types":         string(typesJSON),
		operation_setting.ChannelContributionSettingPrefix + "priority":                      strconv.FormatInt(updated.Priority, 10),
		operation_setting.ChannelContributionSettingPrefix + "weight":                        strconv.FormatUint(uint64(updated.Weight), 10),
		operation_setting.ChannelContributionSettingPrefix + "unavailable_delete_hours":      strconv.Itoa(updated.UnavailableDeleteHours),
		operation_setting.ChannelContributionSettingPrefix + "health_check_interval_minutes": strconv.Itoa(updated.HealthCheckIntervalMinutes),
		operation_setting.ChannelContributionSettingPrefix + "reward_bps":                    strconv.Itoa(updated.RewardBps),
		operation_setting.ChannelContributionSettingPrefix + "agreement_version":             updated.AgreementVersion,
		operation_setting.ChannelContributionSettingPrefix + "agreement_content":             updated.AgreementContent,
	}
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		if err := operation_setting.ValidateChannelContributionOption(key, values[key]); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if err := model.UpdateOptionsBulk(values); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, buildChannelContributionSettingsResponse(*operation_setting.GetChannelContributionSetting()))
}
