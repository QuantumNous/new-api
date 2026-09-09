package controller

import (
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const (
	schedulerEnabledKey              = "SchedulerEnabled"
	schedulerURLKey                  = "SchedulerURL"
	schedulerBootstrapURLsKey        = "SchedulerBootstrapURLs"
	schedulerLocalURLKey             = "SchedulerLocalURL"
	schedulerTokenKey                = "SchedulerToken"
	schedulerModeKey                 = "SchedulerMode"
	schedulerCanaryPercentKey        = "SchedulerCanaryPercent"
	schedulerCanarySaltKey           = "SchedulerCanarySalt"
	schedulerShadowTimeoutMSKey      = "SchedulerShadowTimeoutMS"
	schedulerRuntimePrefixKey        = "SchedulerRuntimePrefix"
	schedulerHighWatermarkKey        = "SchedulerRuntimeHighWatermark"
	schedulerSigningSecretKey        = "SchedulerSigningSecret"
	schedulerEmergencyNativeKey      = "SchedulerEmergencyNativeRouting"
	schedulerEmergencyMaxDurationKey = "SchedulerEmergencyMaxDurationSeconds"
	schedulerEmergencyGroupsKey      = "SchedulerEmergencyGroups"
	schedulerEmergencyModelsKey      = "SchedulerEmergencyModels"
	schedulerKillSwitchKey           = "SchedulerKillSwitch"
)

type SchedulerConfigResponse struct {
	Enabled                     bool    `json:"enabled"`
	URL                         string  `json:"url"`
	BootstrapURLs               string  `json:"bootstrap_urls"`
	LocalURL                    string  `json:"local_url"`
	TokenSet                    bool    `json:"token_set"`
	Mode                        string  `json:"mode"`
	CanaryPercent               int     `json:"canary_percent"`
	CanarySalt                  string  `json:"canary_salt"`
	ShadowTimeoutMS             int     `json:"shadow_timeout_ms"`
	RuntimePrefix               string  `json:"runtime_prefix"`
	RuntimeHighWatermark        float64 `json:"runtime_high_watermark"`
	SigningSecretSet            bool    `json:"signing_secret_set"`
	CatalogTokenSet             bool    `json:"catalog_token_set"`
	EmergencyNativeRouting      bool    `json:"emergency_native_routing"`
	EmergencyMaxDurationSeconds int     `json:"emergency_max_duration_seconds"`
	EmergencyGroups             string  `json:"emergency_groups"`
	EmergencyModels             string  `json:"emergency_models"`
	EmergencyLocalSwitch        bool    `json:"emergency_local_switch"`
	KillSwitch                  bool    `json:"kill_switch"`
}

type SchedulerConfigUpdateRequest struct {
	Enabled                     *bool    `json:"enabled"`
	URL                         *string  `json:"url"`
	BootstrapURLs               *string  `json:"bootstrap_urls"`
	LocalURL                    *string  `json:"local_url"`
	Token                       *string  `json:"token"`
	Mode                        *string  `json:"mode"`
	CanaryPercent               *int     `json:"canary_percent"`
	CanarySalt                  *string  `json:"canary_salt"`
	ShadowTimeoutMS             *int     `json:"shadow_timeout_ms"`
	RuntimePrefix               *string  `json:"runtime_prefix"`
	RuntimeHighWatermark        *float64 `json:"runtime_high_watermark"`
	SigningSecret               *string  `json:"signing_secret"`
	EmergencyNativeRouting      *bool    `json:"emergency_native_routing"`
	EmergencyMaxDurationSeconds *int     `json:"emergency_max_duration_seconds"`
	EmergencyGroups             *string  `json:"emergency_groups"`
	EmergencyModels             *string  `json:"emergency_models"`
	KillSwitch                  *bool    `json:"kill_switch"`
}

func schedulerConfigValue(key, envKey, fallback string) string {
	common.OptionMapRWMutex.RLock()
	value, ok := common.OptionMap[key]
	common.OptionMapRWMutex.RUnlock()
	if ok && strings.TrimSpace(value) != "" {
		return value
	}
	if value = strings.TrimSpace(getenv(envKey)); value != "" {
		return value
	}
	return fallback
}

// getenv is isolated to keep configuration access easy to test.
var getenv = func(key string) string { return os.Getenv(key) }

func schedulerConfigResponse() SchedulerConfigResponse {
	percent, _ := strconv.Atoi(schedulerConfigValue(schedulerCanaryPercentKey, "SCHEDULER_CANARY_PERCENT", "0"))
	timeout, _ := strconv.Atoi(schedulerConfigValue(schedulerShadowTimeoutMSKey, "SCHEDULER_SHADOW_TIMEOUT_MS", "100"))
	highWatermark, err := strconv.ParseFloat(schedulerConfigValue(schedulerHighWatermarkKey, "SCHEDULER_RUNTIME_HIGH_WATERMARK", "0.8"), 64)
	if err != nil || highWatermark <= 0 || highWatermark >= 1 {
		highWatermark = 0.8
	}
	emergencyDuration, _ := strconv.Atoi(schedulerConfigValue(schedulerEmergencyMaxDurationKey, "", "600"))
	if emergencyDuration <= 0 {
		emergencyDuration = 600
	}
	config := service.SchedulerClient()
	return SchedulerConfigResponse{
		Enabled:                     schedulerConfigValue(schedulerEnabledKey, "SCHEDULER_ENABLED", "false") == "true",
		URL:                         config.BaseURL,
		BootstrapURLs:               strings.Join(config.BootstrapURLs, ","),
		LocalURL:                    config.LocalURL,
		TokenSet:                    schedulerConfigValue(schedulerTokenKey, "SCHEDULER_TOKEN", "") != "",
		Mode:                        strings.ToLower(schedulerConfigValue(schedulerModeKey, "SCHEDULER_MODE", "shadow")),
		CanaryPercent:               percent,
		CanarySalt:                  schedulerConfigValue(schedulerCanarySaltKey, "SCHEDULER_CANARY_SALT", "scheduler-v2"),
		ShadowTimeoutMS:             timeout,
		RuntimePrefix:               schedulerConfigValue(schedulerRuntimePrefixKey, "SCHEDULER_RUNTIME_PREFIX", service.SchedulerRuntimePrefix),
		RuntimeHighWatermark:        highWatermark,
		SigningSecretSet:            schedulerConfigValue(schedulerSigningSecretKey, "SCHEDULER_SIGNING_SECRET", "") != "",
		CatalogTokenSet:             strings.TrimSpace(getenv("SCHEDULER_CATALOG_TOKEN")) != "",
		EmergencyNativeRouting:      schedulerConfigValue(schedulerEmergencyNativeKey, "", "false") == "true",
		EmergencyMaxDurationSeconds: emergencyDuration,
		EmergencyGroups:             strings.TrimSpace(schedulerConfigValue(schedulerEmergencyGroupsKey, "", "")),
		EmergencyModels:             strings.TrimSpace(schedulerConfigValue(schedulerEmergencyModelsKey, "", "")),
		EmergencyLocalSwitch:        strings.EqualFold(strings.TrimSpace(getenv("SCHEDULER_EMERGENCY_NATIVE_ROUTING")), "true") || strings.TrimSpace(getenv("SCHEDULER_EMERGENCY_NATIVE_ROUTING")) == "1",
		KillSwitch:                  schedulerConfigValue(schedulerKillSwitchKey, "SCHEDULER_KILL_SWITCH", "false") == "true",
	}
}

func GetSchedulerConfig(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": schedulerConfigResponse()})
}

func UpdateSchedulerConfig(c *gin.Context) {
	var req SchedulerConfigUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的调度配置"})
		return
	}
	values := make(map[string]string)
	if req.Enabled != nil {
		values[schedulerEnabledKey] = strconv.FormatBool(*req.Enabled)
	}
	if req.URL != nil {
		value := strings.TrimSpace(*req.URL)
		if value != "" {
			if _, err := url.ParseRequestURI(value); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Scheduler 地址无效"})
				return
			}
		}
		values[schedulerURLKey] = strings.TrimRight(value, "/")
	}
	if req.BootstrapURLs != nil {
		values[schedulerBootstrapURLsKey] = strings.TrimSpace(*req.BootstrapURLs)
	}
	if req.LocalURL != nil {
		value := strings.TrimSpace(*req.LocalURL)
		if value != "" {
			if _, err := url.ParseRequestURI(value); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Scheduler 本机地址无效"})
				return
			}
		}
		values[schedulerLocalURLKey] = strings.TrimRight(value, "/")
	}
	if req.Token != nil && strings.TrimSpace(*req.Token) != "" {
		values[schedulerTokenKey] = strings.TrimSpace(*req.Token)
	}
	if req.SigningSecret != nil {
		values[schedulerSigningSecretKey] = strings.TrimSpace(*req.SigningSecret)
	}
	if req.Mode != nil {
		mode := strings.ToLower(strings.TrimSpace(*req.Mode))
		if mode != "shadow" && mode != "enforced" && mode != "canary" {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "调度模式无效"})
			return
		}
		values[schedulerModeKey] = mode
	}
	if req.CanaryPercent != nil && (*req.CanaryPercent < 0 || *req.CanaryPercent > 100) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Canary 百分比必须在 0-100 之间"})
		return
	}
	if req.CanaryPercent != nil {
		values[schedulerCanaryPercentKey] = strconv.Itoa(*req.CanaryPercent)
	}
	if req.CanarySalt != nil {
		values[schedulerCanarySaltKey] = strings.TrimSpace(*req.CanarySalt)
	}
	if req.ShadowTimeoutMS != nil && *req.ShadowTimeoutMS < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "超时时间必须大于 0"})
		return
	}
	if req.ShadowTimeoutMS != nil {
		values[schedulerShadowTimeoutMSKey] = strconv.Itoa(*req.ShadowTimeoutMS)
	}
	if req.RuntimePrefix != nil {
		value := strings.TrimSpace(*req.RuntimePrefix)
		if value == "" {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Runtime 前缀不能为空"})
			return
		}
		values[schedulerRuntimePrefixKey] = value
	}
	if req.RuntimeHighWatermark != nil {
		if *req.RuntimeHighWatermark <= 0 || *req.RuntimeHighWatermark >= 1 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Runtime 软水位必须在 0 和 1 之间"})
			return
		}
		values[schedulerHighWatermarkKey] = strconv.FormatFloat(*req.RuntimeHighWatermark, 'f', -1, 64)
	}
	if req.EmergencyNativeRouting != nil {
		values[schedulerEmergencyNativeKey] = strconv.FormatBool(*req.EmergencyNativeRouting)
	}
	if req.EmergencyMaxDurationSeconds != nil {
		if *req.EmergencyMaxDurationSeconds < 1 || *req.EmergencyMaxDurationSeconds > 86400 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "应急降级最长时长必须在 1-86400 秒之间"})
			return
		}
		values[schedulerEmergencyMaxDurationKey] = strconv.Itoa(*req.EmergencyMaxDurationSeconds)
	}
	if req.EmergencyGroups != nil {
		values[schedulerEmergencyGroupsKey] = strings.TrimSpace(*req.EmergencyGroups)
	}
	if req.EmergencyModels != nil {
		values[schedulerEmergencyModelsKey] = strings.TrimSpace(*req.EmergencyModels)
	}
	if req.KillSwitch != nil {
		values[schedulerKillSwitchKey] = strconv.FormatBool(*req.KillSwitch)
	}
	if err := model.UpdateOptionsBulk(values); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	service.ReloadSchedulerClient()
	recordManageAudit(c, "scheduler.config.update", map[string]interface{}{"keys": keys(values)})
	c.JSON(http.StatusOK, gin.H{"success": true, "data": schedulerConfigResponse()})
}

func keys(values map[string]string) []string {
	result := make([]string, 0, len(values))
	for key := range values {
		result = append(result, key)
	}
	return result
}

func GetSchedulerMonitor(c *gin.Context) {
	config := service.SchedulerClient()
	urls := config.URLs()
	result := gin.H{"configured": config.Enabled && len(urls) > 0, "url": config.BaseURL, "urls": urls, "reachable": false, "checked_at": time.Now(), "nodes": []gin.H{}}
	if len(urls) == 0 {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
		return
	}
	client := &http.Client{Timeout: config.Timeout}
	for _, baseURL := range urls {
		node := gin.H{"url": baseURL, "reachable": false}
		resp, err := client.Get(baseURL + "/health/live")
		if err == nil {
			reachable := resp.StatusCode >= 200 && resp.StatusCode < 300
			node["reachable"] = reachable
			result["reachable"] = result["reachable"].(bool) || reachable
			_ = resp.Body.Close()
		}
		result["nodes"] = append(result["nodes"].([]gin.H), node)
		if config.Token != "" && result["observability"] == nil && node["reachable"].(bool) {
			monitorURL := baseURL + "/admin/observability"
			if query := c.Request.URL.Query(); len(query) > 0 {
				monitorURL += "?" + query.Encode()
			}
			req, _ := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, monitorURL, nil)
			req.Header.Set("Authorization", "Bearer "+config.Token)
			if response, requestErr := client.Do(req); requestErr == nil {
				defer response.Body.Close()
				var payload json.RawMessage
				if common.DecodeJson(response.Body, &payload) == nil {
					result["observability"] = payload
				}
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
}

func TestSchedulerConnection(c *gin.Context) {
	config := service.SchedulerClient()
	urls := config.URLs()
	if len(urls) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Scheduler 地址未配置"})
		return
	}
	client := &http.Client{Timeout: config.Timeout}
	checked := make([]gin.H, 0, len(urls))
	for _, baseURL := range urls {
		item := gin.H{"url": baseURL, "reachable": false}
		resp, err := client.Get(baseURL + "/health/live")
		if err == nil {
			item["reachable"] = resp.StatusCode >= 200 && resp.StatusCode < 300
			_ = resp.Body.Close()
		}
		checked = append(checked, item)
		if item["reachable"].(bool) {
			c.JSON(http.StatusOK, gin.H{"success": true, "message": "Scheduler 连接正常", "data": gin.H{"checked": checked}})
			return
		}
	}
	c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "所有 Scheduler 节点都不可达", "data": gin.H{"checked": checked}})
}
