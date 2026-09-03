package controller

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/gin-gonic/gin"
)

var (
	metaproxyRevisionPattern = regexp.MustCompile(`^[0-9a-f]{40}$`)
	metaproxyDigestPattern   = regexp.MustCompile(`^[0-9a-f]{64}$`)
)

type metaproxyProvisionChannelRequest struct {
	Type           int    `json:"type"`
	Key            string `json:"key"`
	Name           string `json:"name"`
	BaseURL        string `json:"base_url"`
	Models         string `json:"models"`
	ModelMapping   string `json:"model_mapping"`
	Group          string `json:"group"`
	Priority       int64  `json:"priority"`
	Weight         uint   `json:"weight"`
	Status         int    `json:"status"`
	TestModel      string `json:"test_model"`
	HeaderOverride string `json:"header_override"`
}

type metaproxyProvisionOptionsRequest struct {
	ModelRatio       string `json:"model_ratio"`
	CompletionRatio  string `json:"completion_ratio"`
	CacheRatio       string `json:"cache_ratio"`
	ModelBillingMode string `json:"model_billing_mode"`
	ModelBillingExpr string `json:"model_billing_expr"`
	GroupRatio       string `json:"group_ratio"`
	UserUsableGroups string `json:"user_usable_groups"`
}

type metaproxyProvisionRequest struct {
	Revision string                             `json:"revision"`
	Digest   string                             `json:"digest"`
	Channels []metaproxyProvisionChannelRequest `json:"channels"`
	Options  metaproxyProvisionOptionsRequest   `json:"options"`
}

func parseRatioMap(name, raw string, allowZero bool) (map[string]float64, error) {
	values := make(map[string]float64)
	if err := common.Unmarshal([]byte(raw), &values); err != nil {
		return nil, fmt.Errorf("%s must be a JSON object of numbers: %w", name, err)
	}
	for key, value := range values {
		if strings.TrimSpace(key) == "" || math.IsNaN(value) || math.IsInf(value, 0) {
			return nil, fmt.Errorf("%s contains an invalid value for %q", name, key)
		}
		if value < 0 || (!allowZero && value == 0) {
			return nil, fmt.Errorf("%s must contain positive values: %q", name, key)
		}
	}
	return values, nil
}

func parseUserUsableGroups(raw string) (map[string]string, error) {
	values := make(map[string]string)
	if err := common.Unmarshal([]byte(raw), &values); err != nil {
		return nil, fmt.Errorf("UserUsableGroups must be a JSON object of strings: %w", err)
	}
	for group, label := range values {
		if strings.TrimSpace(group) == "" || strings.TrimSpace(label) == "" {
			return nil, fmt.Errorf("UserUsableGroups contains an empty group or label")
		}
	}
	return values, nil
}

func parseStringMap(name, raw string) (map[string]string, error) {
	values := make(map[string]string)
	if strings.TrimSpace(raw) == "" {
		return values, nil
	}
	if err := common.Unmarshal([]byte(raw), &values); err != nil {
		return nil, fmt.Errorf("%s must be a JSON object of strings: %w", name, err)
	}
	for key, value := range values {
		if strings.TrimSpace(key) == "" || strings.TrimSpace(value) == "" {
			return nil, fmt.Errorf("%s contains an empty model or value", name)
		}
	}
	return values, nil
}

func validateOptionalJSONObject(name, raw string) error {
	if raw == "" {
		return nil
	}
	value := make(map[string]any)
	if err := common.Unmarshal([]byte(raw), &value); err != nil {
		return fmt.Errorf("%s must be a JSON object: %w", name, err)
	}
	return nil
}

func commaValues(raw string) ([]string, error) {
	parts := strings.Split(raw, ",")
	seen := make(map[string]struct{}, len(parts))
	for index, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			return nil, errors.New("contains an empty item")
		}
		if _, duplicate := seen[part]; duplicate {
			return nil, fmt.Errorf("contains duplicate item %q", part)
		}
		seen[part] = struct{}{}
		parts[index] = part
	}
	return parts, nil
}

func validateProvisionBaseURL(raw string) error {
	if raw == "" {
		return nil
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return errors.New("base_url must be an absolute HTTP(S) URL")
	}
	if parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return errors.New("base_url must not contain credentials, a query, or a fragment")
	}
	return nil
}

func validateMetaproxyProvisionRequest(
	request metaproxyProvisionRequest,
	idempotencyKey string,
	expectedDigest string,
) error {
	if !metaproxyRevisionPattern.MatchString(request.Revision) {
		return errors.New("revision must be a lowercase 40-character Git SHA")
	}
	if !metaproxyDigestPattern.MatchString(request.Digest) {
		return errors.New("digest must be a lowercase SHA-256 value")
	}
	if idempotencyKey != request.Digest {
		return errors.New("Idempotency-Key must equal the requested configuration digest")
	}
	if expectedDigest != model.MetaproxyProvisionNoDigest &&
		!metaproxyDigestPattern.MatchString(expectedDigest) {
		return errors.New("If-Match must be 'none' or a lowercase SHA-256 value")
	}
	if len(request.Channels) > 256 {
		return errors.New("channels exceeds the 256-channel limit")
	}

	modelRatios, err := parseRatioMap("ModelRatio", request.Options.ModelRatio, true)
	if err != nil {
		return err
	}
	if _, err := parseRatioMap("CompletionRatio", request.Options.CompletionRatio, false); err != nil {
		return err
	}
	if _, err := parseRatioMap("CacheRatio", request.Options.CacheRatio, true); err != nil {
		return err
	}
	billingModes, err := parseStringMap("ModelBillingMode", request.Options.ModelBillingMode)
	if err != nil {
		return err
	}
	billingExprs, err := parseStringMap("ModelBillingExpr", request.Options.ModelBillingExpr)
	if err != nil {
		return err
	}
	for modelName, mode := range billingModes {
		if mode != billing_setting.BillingModeTieredExpr {
			return fmt.Errorf("ModelBillingMode contains unsupported mode %q for %q", mode, modelName)
		}
		expr, ok := billingExprs[modelName]
		if !ok {
			return fmt.Errorf("model %q uses tiered_expr but is missing from ModelBillingExpr", modelName)
		}
		if err := billing_setting.SmokeTestExpr(expr); err != nil {
			return fmt.Errorf("ModelBillingExpr for %q is invalid: %w", modelName, err)
		}
	}
	for modelName := range billingExprs {
		if _, ok := billingModes[modelName]; !ok {
			return fmt.Errorf("model %q has ModelBillingExpr but is missing from ModelBillingMode", modelName)
		}
	}
	groupRatios, err := parseRatioMap("GroupRatio", request.Options.GroupRatio, false)
	if err != nil {
		return err
	}
	usableGroups, err := parseUserUsableGroups(request.Options.UserUsableGroups)
	if err != nil {
		return err
	}
	for group := range usableGroups {
		if _, priced := groupRatios[group]; !priced {
			return fmt.Errorf("offered group %q is missing from GroupRatio", group)
		}
	}
	for group := range groupRatios {
		if _, offered := usableGroups[group]; !offered {
			return fmt.Errorf("priced group %q is missing from UserUsableGroups", group)
		}
	}

	names := make(map[string]struct{}, len(request.Channels))
	for index, channel := range request.Channels {
		prefix := fmt.Sprintf("channels[%d]", index)
		if channel.Type <= 0 {
			return fmt.Errorf("%s.type must be positive", prefix)
		}
		if strings.TrimSpace(channel.Key) == "" {
			return fmt.Errorf("%s.key must not be empty", prefix)
		}
		if strings.TrimSpace(channel.Name) == "" || len(channel.Name) > 255 {
			return fmt.Errorf("%s.name must contain 1 to 255 characters", prefix)
		}
		if _, duplicate := names[channel.Name]; duplicate {
			return fmt.Errorf("duplicate channel name %q", channel.Name)
		}
		names[channel.Name] = struct{}{}
		if err := validateProvisionBaseURL(channel.BaseURL); err != nil {
			return fmt.Errorf("%s.%w", prefix, err)
		}
		models, err := commaValues(channel.Models)
		if err != nil {
			return fmt.Errorf("%s.models %w", prefix, err)
		}
		groups, err := commaValues(channel.Group)
		if err != nil {
			return fmt.Errorf("%s.group %w", prefix, err)
		}
		if channel.Status < 1 || channel.Status > 3 {
			return fmt.Errorf("%s.status must be 1, 2, or 3", prefix)
		}
		if err := validateOptionalJSONObject(prefix+".model_mapping", channel.ModelMapping); err != nil {
			return err
		}
		if err := validateOptionalJSONObject(prefix+".header_override", channel.HeaderOverride); err != nil {
			return err
		}
		if channel.Status != 1 {
			continue
		}
		offered := false
		for _, group := range groups {
			_, groupOffered := usableGroups[group]
			offered = offered || groupOffered
		}
		if !offered {
			continue
		}
		for _, modelName := range models {
			ratio, priced := modelRatios[modelName]
			_, expressionPriced := billingModes[modelName]
			if !priced && !expressionPriced {
				return fmt.Errorf("enabled model %q in an offered group is missing from ModelRatio and ModelBillingMode", modelName)
			}
			if priced && ratio == 0 && !expressionPriced {
				return fmt.Errorf("enabled model %q in an offered group must have a positive ModelRatio", modelName)
			}
		}
	}
	return nil
}

func toMetaproxyProvisionConfig(request metaproxyProvisionRequest) model.MetaproxyProvisionConfig {
	if strings.TrimSpace(request.Options.ModelBillingMode) == "" {
		request.Options.ModelBillingMode = "{}"
	}
	if strings.TrimSpace(request.Options.ModelBillingExpr) == "" {
		request.Options.ModelBillingExpr = "{}"
	}
	channels := make([]model.MetaproxyProvisionChannel, 0, len(request.Channels))
	for _, channel := range request.Channels {
		models, _ := commaValues(channel.Models)
		groups, _ := commaValues(channel.Group)
		channels = append(channels, model.MetaproxyProvisionChannel{
			Type:           channel.Type,
			Key:            channel.Key,
			Name:           channel.Name,
			BaseURL:        channel.BaseURL,
			Models:         strings.Join(models, ","),
			ModelMapping:   channel.ModelMapping,
			Group:          strings.Join(groups, ","),
			Priority:       channel.Priority,
			Weight:         channel.Weight,
			Status:         channel.Status,
			TestModel:      channel.TestModel,
			HeaderOverride: channel.HeaderOverride,
		})
	}
	return model.MetaproxyProvisionConfig{
		Revision: request.Revision,
		Digest:   request.Digest,
		Channels: channels,
		Options: model.MetaproxyProvisionOptions{
			ModelRatio:       request.Options.ModelRatio,
			CompletionRatio:  request.Options.CompletionRatio,
			CacheRatio:       request.Options.CacheRatio,
			ModelBillingMode: request.Options.ModelBillingMode,
			ModelBillingExpr: request.Options.ModelBillingExpr,
			GroupRatio:       request.Options.GroupRatio,
			UserUsableGroups: request.Options.UserUsableGroups,
		},
	}
}

func ApplyMetaproxyProvision(c *gin.Context) {
	var request metaproxyProvisionRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid JSON body"})
		return
	}
	expectedDigest := strings.Trim(c.GetHeader("If-Match"), `"`)
	if err := validateMetaproxyProvisionRequest(
		request,
		c.GetHeader("Idempotency-Key"),
		expectedDigest,
	); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	result, err := model.ApplyMetaproxyProvision(toMetaproxyProvisionConfig(request), expectedDigest)
	if errors.Is(err, model.ErrMetaproxyProvisionRequiresMemoryCache) {
		c.JSON(http.StatusPreconditionFailed, gin.H{"success": false, "message": err.Error()})
		return
	}
	if errors.Is(err, model.ErrMetaproxyProvisionConflict) {
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "metaproxy.provision.apply", map[string]interface{}{
		"revision":        request.Revision,
		"digest":          request.Digest,
		"channel_count":   len(request.Channels),
		"already_applied": result.AlreadyApplied,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"revision":        request.Revision,
			"digest":          request.Digest,
			"previous_digest": result.PreviousDigest,
			"already_applied": result.AlreadyApplied,
		},
	})
}
