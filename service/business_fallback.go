package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	businessfallback "github.com/QuantumNous/new-api/setting/business_fallback"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

type BusinessFallbackAttempt struct {
	Family      string
	SelectModel string
}

type BusinessFallbackPlan struct {
	SourceFamily string
	Attempts     []BusinessFallbackAttempt
}

type BusinessImageRequest struct {
	image  *dto.ImageRequest
	gemini *dto.GeminiChatRequest
}

const (
	businessFallbackContextFamilyKey = "business_fallback_model_family"
	businessFallbackContextActiveKey = "business_fallback_active"
)

func ResolveImageBusinessFallbackPlan(modelName string) (*BusinessFallbackPlan, bool) {
	cfg := businessfallback.GetConfig()
	if !cfg.Enabled {
		return nil, false
	}
	sourceFamily := MatchImageBusinessFallbackFamily(modelName)
	if sourceFamily == "" {
		return nil, false
	}
	chain := cfg.ImageGeneration.Chains[sourceFamily]
	if len(chain) == 0 {
		chain = []string{sourceFamily}
	}
	attempts := make([]BusinessFallbackAttempt, 0, len(chain))
	for _, familyID := range chain {
		family, ok := cfg.ImageGeneration.Families[familyID]
		if !ok || strings.TrimSpace(family.SelectModel) == "" {
			continue
		}
		attempts = append(attempts, BusinessFallbackAttempt{
			Family:      familyID,
			SelectModel: family.SelectModel,
		})
	}
	if len(attempts) == 0 {
		return nil, false
	}
	return &BusinessFallbackPlan{SourceFamily: sourceFamily, Attempts: attempts}, true
}

func NewBusinessImageRequest(request dto.Request) (*BusinessImageRequest, error) {
	switch r := request.(type) {
	case *dto.ImageRequest:
		imageReq, err := common.DeepCopy(r)
		if err != nil {
			return nil, fmt.Errorf("copy image request: %w", err)
		}
		return &BusinessImageRequest{image: imageReq}, nil
	case *dto.GeminiChatRequest:
		geminiReq, err := common.DeepCopy(r)
		if err != nil {
			return nil, fmt.Errorf("copy gemini request: %w", err)
		}
		return &BusinessImageRequest{gemini: geminiReq}, nil
	default:
		return nil, fmt.Errorf("unsupported business image request type %T", request)
	}
}

func (r *BusinessImageRequest) ToImageRequest(modelName, family string) (*dto.ImageRequest, error) {
	if r == nil {
		return nil, errors.New("business image request is nil")
	}
	if r.image != nil {
		imageReq, err := common.DeepCopy(r.image)
		if err != nil {
			return nil, fmt.Errorf("copy image request: %w", err)
		}
		imageReq.SetModelName(modelName)
		return imageReq, nil
	}
	if r.gemini == nil {
		return nil, errors.New("business image request has no source request")
	}

	promptParts := make([]string, 0)
	images := make([]string, 0)
	for _, content := range r.gemini.Contents {
		for _, part := range content.Parts {
			if strings.TrimSpace(part.Text) != "" {
				promptParts = append(promptParts, part.Text)
			}
			if part.InlineData != nil && strings.HasPrefix(part.InlineData.MimeType, "image/") && part.InlineData.Data != "" {
				images = append(images, fmt.Sprintf("data:%s;base64,%s", part.InlineData.MimeType, part.InlineData.Data))
			}
			if part.FileData != nil && strings.HasPrefix(part.FileData.MimeType, "image/") && part.FileData.FileUri != "" {
				images = append(images, part.FileData.FileUri)
			}
		}
	}
	prompt := strings.TrimSpace(strings.Join(promptParts, "\n"))
	if prompt == "" {
		return nil, errors.New("gemini image request prompt is empty")
	}

	imageReq := &dto.ImageRequest{
		Model:          modelName,
		Prompt:         prompt,
		ResponseFormat: "b64_json",
	}
	if r.gemini.GenerationConfig.CandidateCount != nil && *r.gemini.GenerationConfig.CandidateCount > 0 {
		imageReq.N = common.GetPointer(uint(*r.gemini.GenerationConfig.CandidateCount))
	}
	size, quality := geminiImageRequestSizeAndQuality(r.gemini.GenerationConfig.ImageConfig, family)
	imageReq.Size = size
	imageReq.Quality = quality

	if len(images) > 0 {
		imagesJSON, err := common.Marshal(images)
		if err != nil {
			return nil, fmt.Errorf("marshal gemini image inputs: %w", err)
		}
		imageReq.Images = imagesJSON
	}

	if family == "gemini_image" {
		extraFields, err := common.Marshal(map[string]any{
			"gemini": map[string]any{
				"contents":          r.gemini.Contents,
				"safetySettings":    r.gemini.SafetySettings,
				"generationConfig":  r.gemini.GenerationConfig,
				"tools":             r.gemini.Tools,
				"toolConfig":        r.gemini.ToolConfig,
				"systemInstruction": r.gemini.SystemInstructions,
				"cachedContent":     r.gemini.CachedContent,
			},
		})
		if err != nil {
			return nil, fmt.Errorf("marshal gemini image config: %w", err)
		}
		imageReq.ExtraFields = extraFields
	}

	return imageReq, nil
}

func geminiImageRequestSizeAndQuality(imageConfig []byte, family string) (string, string) {
	if len(imageConfig) == 0 {
		return "", ""
	}
	var cfg map[string]any
	if err := common.Unmarshal(imageConfig, &cfg); err != nil {
		return "", ""
	}

	size := common.Interface2String(cfg["aspectRatio"])
	if size == "" {
		size = common.Interface2String(cfg["aspect_ratio"])
	}
	if family != "gemini_image" {
		size = geminiAspectRatioToOpenAIImageSize(size)
	}

	quality := common.Interface2String(cfg["imageSize"])
	if quality == "" {
		quality = common.Interface2String(cfg["image_size"])
	}
	switch quality {
	case "2K":
		quality = "high"
	case "1K":
		quality = "standard"
	}
	return size, quality
}

func geminiAspectRatioToOpenAIImageSize(aspectRatio string) string {
	switch aspectRatio {
	case "1:1":
		return "1024x1024"
	case "16:9":
		return "1792x1024"
	case "9:16":
		return "1024x1792"
	case "3:2":
		return "1536x1024"
	case "2:3":
		return "1024x1536"
	default:
		return aspectRatio
	}
}

func MatchImageBusinessFallbackFamily(modelName string) string {
	cfg := businessfallback.GetConfig()
	modelName = strings.ToLower(strings.TrimSpace(modelName))
	if modelName == "" {
		return ""
	}
	for familyID, family := range cfg.ImageGeneration.Families {
		for _, matcher := range family.MatchModels {
			matcher = strings.ToLower(strings.TrimSpace(matcher))
			if matcher == "" {
				continue
			}
			if businessFallbackModelMatches(modelName, matcher) {
				return familyID
			}
		}
	}
	return ""
}

func businessFallbackModelMatches(modelName, matcher string) bool {
	if strings.HasPrefix(matcher, "prefix:") {
		prefix := strings.TrimSpace(strings.TrimPrefix(matcher, "prefix:"))
		return prefix != "" && strings.HasPrefix(modelName, prefix)
	}
	if strings.HasSuffix(matcher, "*") {
		prefix := strings.TrimSpace(strings.TrimSuffix(matcher, "*"))
		return prefix != "" && strings.HasPrefix(modelName, prefix)
	}
	return modelName == matcher
}

func SetBusinessFallbackFamily(ctx interface{ Set(string, any) }, family string) {
	if ctx == nil {
		return
	}
	ctx.Set(businessFallbackContextFamilyKey, family)
}

func GetBusinessFallbackFamily(ctx interface{ GetString(string) string }) string {
	if ctx == nil {
		return ""
	}
	return ctx.GetString(businessFallbackContextFamilyKey)
}

func SetBusinessFallbackActive(ctx interface{ Set(string, any) }, active bool) {
	if ctx == nil {
		return
	}
	ctx.Set(businessFallbackContextActiveKey, active)
}

func IsBusinessFallbackActive(ctx interface{ GetBool(string) bool }) bool {
	if ctx == nil {
		return false
	}
	return ctx.GetBool(businessFallbackContextActiveKey)
}

func IsModelAllowedByTokenLimit(c *gin.Context, modelName string) bool {
	if c == nil || !common.GetContextKeyBool(c, constant.ContextKeyTokenModelLimitEnabled) {
		return true
	}
	value, ok := common.GetContextKey(c, constant.ContextKeyTokenModelLimit)
	if !ok {
		return false
	}
	tokenModelLimit, ok := value.(map[string]bool)
	if !ok {
		return false
	}
	matchName := ratio_setting.FormatMatchingModelName(modelName)
	return tokenModelLimit[matchName]
}

func IsBusinessFallbackFamilyBlocked(channelID int, family string) bool {
	if channelID <= 0 || family == "" {
		return false
	}
	cfg := businessfallback.GetConfig().ImageGeneration.Health
	if !cfg.Enabled || !isMonitoredBusinessFallbackFamily(cfg, family) {
		return false
	}
	if common.RedisEnabled && common.RDB != nil {
		_, err := common.RDB.Get(context.Background(), businessFallbackBlockKey(channelID, family)).Result()
		if err == nil {
			return true
		}
		if err != redis.Nil {
			common.SysError("read business fallback block key failed: " + err.Error())
			return memoryBusinessFallbackHealth.isBlocked(channelID, family, time.Now())
		}
		return false
	}
	return memoryBusinessFallbackHealth.isBlocked(channelID, family, time.Now())
}

func RecordBusinessFallbackHealth(channelID int, family string, success bool) {
	if channelID <= 0 || family == "" {
		return
	}
	cfg := businessfallback.GetConfig().ImageGeneration.Health
	if !cfg.Enabled || !isMonitoredBusinessFallbackFamily(cfg, family) {
		return
	}
	now := time.Now()
	if common.RedisEnabled && common.RDB != nil {
		if recordBusinessFallbackHealthRedis(channelID, family, success, cfg, now) {
			return
		}
	}
	memoryBusinessFallbackHealth.record(channelID, family, success, cfg, now)
}

func ShouldRecordBusinessFallbackFailure(err *types.NewAPIError) bool {
	if err == nil || types.IsSkipRetryError(err) {
		return false
	}
	if types.IsChannelError(err) {
		return true
	}
	switch err.GetErrorCode() {
	case types.ErrorCodeDoRequestFailed,
		types.ErrorCodeReadResponseBodyFailed,
		types.ErrorCodeBadResponseStatusCode,
		types.ErrorCodeBadResponse,
		types.ErrorCodeBadResponseBody,
		types.ErrorCodeEmptyResponse,
		types.ErrorCodeChannelResponseTimeExceeded:
		return true
	}
	return err.StatusCode == http.StatusTooManyRequests || err.StatusCode >= http.StatusInternalServerError
}

func isMonitoredBusinessFallbackFamily(cfg businessfallback.HealthConfig, family string) bool {
	for _, monitored := range cfg.MonitoredFamilies {
		if monitored == family {
			return true
		}
	}
	return false
}

func businessFallbackBlockKey(channelID int, family string) string {
	return fmt.Sprintf("business_fallback:block:%d:%s", channelID, family)
}

func businessFallbackBucketKey(channelID int, family string, minute time.Time) string {
	return fmt.Sprintf("business_fallback:health:%d:%s:%s", channelID, family, minute.UTC().Format("200601021504"))
}

func recordBusinessFallbackHealthRedis(channelID int, family string, success bool, cfg businessfallback.HealthConfig, now time.Time) bool {
	ctx := context.Background()
	field := "failure"
	if success {
		field = "success"
	}
	bucketMinute := now.Truncate(time.Minute)
	key := businessFallbackBucketKey(channelID, family, bucketMinute)
	pipe := common.RDB.TxPipeline()
	pipe.HIncrBy(ctx, key, field, 1)
	pipe.Expire(ctx, key, time.Duration(cfg.WindowMinutes+cfg.BlockMinutes+5)*time.Minute)
	if _, err := pipe.Exec(ctx); err != nil {
		common.SysError("record business fallback health failed: " + err.Error())
		return false
	}

	successes, failures := getBusinessFallbackWindowRedis(channelID, family, cfg, now)
	maybeBlockBusinessFallbackFamilyRedis(channelID, family, successes, failures, cfg)
	return true
}

func getBusinessFallbackWindowRedis(channelID int, family string, cfg businessfallback.HealthConfig, now time.Time) (int64, int64) {
	ctx := context.Background()
	var successes int64
	var failures int64
	for i := 0; i < cfg.WindowMinutes; i++ {
		key := businessFallbackBucketKey(channelID, family, now.Add(-time.Duration(i)*time.Minute).Truncate(time.Minute))
		values, err := common.RDB.HGetAll(ctx, key).Result()
		if err != nil && err != redis.Nil {
			continue
		}
		successes += parseRedisInt64(values["success"])
		failures += parseRedisInt64(values["failure"])
	}
	return successes, failures
}

func parseRedisInt64(value string) int64 {
	n, _ := strconv.ParseInt(value, 10, 64)
	return n
}

func maybeBlockBusinessFallbackFamilyRedis(channelID int, family string, successes, failures int64, cfg businessfallback.HealthConfig) {
	total := successes + failures
	if total < int64(cfg.MinSamples) {
		return
	}
	successRate := float64(successes) / float64(total)
	if successRate >= cfg.SuccessRateThreshold {
		return
	}
	key := businessFallbackBlockKey(channelID, family)
	reason := fmt.Sprintf("success_rate=%.2f,total=%d,success=%d,failure=%d", successRate, total, successes, failures)
	if err := common.RDB.Set(context.Background(), key, reason, time.Duration(cfg.BlockMinutes)*time.Minute).Err(); err != nil {
		common.SysError("block business fallback family failed: " + err.Error())
		return
	}
	common.SysLog(fmt.Sprintf("business fallback blocked channel #%d family %s for %d minutes: %s", channelID, family, cfg.BlockMinutes, reason))
}

type memoryHealthBucket struct {
	Success int64
	Failure int64
}

type memoryBusinessFallbackHealthStore struct {
	mu      sync.Mutex
	buckets map[string]memoryHealthBucket
	blocks  map[string]time.Time
}

var memoryBusinessFallbackHealth = &memoryBusinessFallbackHealthStore{
	buckets: make(map[string]memoryHealthBucket),
	blocks:  make(map[string]time.Time),
}

func (s *memoryBusinessFallbackHealthStore) record(channelID int, family string, success bool, cfg businessfallback.HealthConfig, now time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()

	bucketKey := businessFallbackBucketKey(channelID, family, now.Truncate(time.Minute))
	bucket := s.buckets[bucketKey]
	if success {
		bucket.Success++
	} else {
		bucket.Failure++
	}
	s.buckets[bucketKey] = bucket
	s.pruneLocked(cfg, now)

	var successes int64
	var failures int64
	for i := 0; i < cfg.WindowMinutes; i++ {
		key := businessFallbackBucketKey(channelID, family, now.Add(-time.Duration(i)*time.Minute).Truncate(time.Minute))
		b := s.buckets[key]
		successes += b.Success
		failures += b.Failure
	}
	total := successes + failures
	if total < int64(cfg.MinSamples) {
		return
	}
	successRate := float64(successes) / float64(total)
	if successRate >= cfg.SuccessRateThreshold {
		return
	}
	blockKey := businessFallbackBlockKey(channelID, family)
	s.blocks[blockKey] = now.Add(time.Duration(cfg.BlockMinutes) * time.Minute)
	common.SysLog(fmt.Sprintf("business fallback blocked channel #%d family %s for %d minutes: success_rate=%.2f,total=%d,success=%d,failure=%d", channelID, family, cfg.BlockMinutes, successRate, total, successes, failures))
}

func (s *memoryBusinessFallbackHealthStore) isBlocked(channelID int, family string, now time.Time) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := businessFallbackBlockKey(channelID, family)
	until, ok := s.blocks[key]
	if !ok {
		return false
	}
	if now.After(until) {
		delete(s.blocks, key)
		return false
	}
	return true
}

func (s *memoryBusinessFallbackHealthStore) pruneLocked(cfg businessfallback.HealthConfig, now time.Time) {
	cutoff := now.Add(-time.Duration(cfg.WindowMinutes+cfg.BlockMinutes+5) * time.Minute).UTC().Format("200601021504")
	for key := range s.buckets {
		parts := strings.Split(key, ":")
		if len(parts) == 0 {
			continue
		}
		if parts[len(parts)-1] < cutoff {
			delete(s.buckets, key)
		}
	}
	for key, until := range s.blocks {
		if now.After(until) {
			delete(s.blocks, key)
		}
	}
}
