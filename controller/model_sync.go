package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func normalizeLocale(locale string) (string, bool) {
	l := strings.ToLower(strings.TrimSpace(locale))
	switch l {
	case "en", "zh", "ja":
		return l, true
	default:
		return "", false
	}
}

func getUpstreamBase() string {
	return common.GetEnvOrDefaultString("SYNC_UPSTREAM_BASE", "https://basellm.github.io/llm-metadata")
}

func getUpstreamURLs(locale string) (modelsURL, vendorsURL string) {
	base := strings.TrimRight(getUpstreamBase(), "/")
	if l, ok := normalizeLocale(locale); ok && l != "" {
		return fmt.Sprintf("%s/api/i18n/%s/newapi/models.json", base, l),
			fmt.Sprintf("%s/api/i18n/%s/newapi/vendors.json", base, l)
	}
	return fmt.Sprintf("%s/api/newapi/models.json", base), fmt.Sprintf("%s/api/newapi/vendors.json", base)
}

type upstreamEnvelope[T any] struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    []T    `json:"data"`
}

type upstreamModel struct {
	Description string          `json:"description"`
	Endpoints   json.RawMessage `json:"endpoints"`
	Icon        string          `json:"icon"`
	ModelName   string          `json:"model_name"`
	NameRule    int             `json:"name_rule"`
	Status      int             `json:"status"`
	Tags        string          `json:"tags"`
	VendorName  string          `json:"vendor_name"`
}

type upstreamVendor struct {
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Name        string `json:"name"`
	Status      int    `json:"status"`
}

type upstreamData struct {
	Models     []upstreamModel
	Vendors    []upstreamVendor
	ModelsURL  string
	VendorsURL string
	Locale     string
	Source     string
}

var (
	etagCache  = make(map[string]string)
	bodyCache  = make(map[string][]byte)
	cacheMutex sync.RWMutex
)

type overwriteField struct {
	ModelName string   `json:"model_name"`
	Fields    []string `json:"fields"`
}

type syncRequest struct {
	Overwrite []overwriteField `json:"overwrite"`
	Locale    string           `json:"locale"`
}

func newHTTPClient() *http.Client {
	timeoutSec := common.GetEnvOrDefault("SYNC_HTTP_TIMEOUT_SECONDS", 10)
	dialer := &net.Dialer{Timeout: time.Duration(timeoutSec) * time.Second}
	transport := &http.Transport{
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   time.Duration(timeoutSec) * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		ResponseHeaderTimeout: time.Duration(timeoutSec) * time.Second,
	}
	transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
		host, _, err := net.SplitHostPort(addr)
		if err != nil {
			host = addr
		}
		if strings.HasSuffix(host, "github.io") {
			if conn, err := dialer.DialContext(ctx, "tcp4", addr); err == nil {
				return conn, nil
			}
			return dialer.DialContext(ctx, "tcp6", addr)
		}
		return dialer.DialContext(ctx, network, addr)
	}
	return &http.Client{Transport: transport}
}

var httpClient = newHTTPClient()

func parseUpstreamJSON[T any](buf []byte) ([]T, error) {
	var env upstreamEnvelope[T]
	if err := json.Unmarshal(buf, &env); err == nil && (env.Success || len(env.Data) > 0) {
		return env.Data, nil
	}
	var arr []T
	if err := json.Unmarshal(buf, &arr); err == nil {
		return arr, nil
	}
	return nil, errors.New("invalid upstream payload")
}

func fetchJSON[T any](ctx context.Context, url string, out *upstreamEnvelope[T]) error {
	var lastErr error
	attempts := common.GetEnvOrDefault("SYNC_HTTP_RETRY", 3)
	if attempts < 1 {
		attempts = 1
	}
	baseDelay := 200 * time.Millisecond
	maxMB := common.GetEnvOrDefault("SYNC_HTTP_MAX_MB", 10)
	maxBytes := int64(maxMB) << 20
	for attempt := 0; attempt < attempts; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		// ETag conditional request
		cacheMutex.RLock()
		if et := etagCache[url]; et != "" {
			req.Header.Set("If-None-Match", et)
		}
		cacheMutex.RUnlock()

		resp, err := httpClient.Do(req)
		if err != nil {
			lastErr = err
			// backoff with jitter
			sleep := baseDelay * time.Duration(1<<attempt)
			jitter := time.Duration(rand.Intn(150)) * time.Millisecond
			time.Sleep(sleep + jitter)
			continue
		}
		func() {
			defer resp.Body.Close()
			switch resp.StatusCode {
			case http.StatusOK:
				// read body into buffer for caching and flexible decode
				limited := io.LimitReader(resp.Body, maxBytes)
				buf, err := io.ReadAll(limited)
				if err != nil {
					lastErr = err
					return
				}
				// cache body and ETag
				cacheMutex.Lock()
				if et := resp.Header.Get("ETag"); et != "" {
					etagCache[url] = et
				}
				bodyCache[url] = buf
				cacheMutex.Unlock()

				// Try decode as envelope first
				if err := json.Unmarshal(buf, out); err != nil {
					// Try decode as pure array
					var arr []T
					if err2 := json.Unmarshal(buf, &arr); err2 != nil {
						lastErr = err
						return
					}
					out.Success = true
					out.Data = arr
					out.Message = ""
				} else {
					if !out.Success && len(out.Data) == 0 && out.Message == "" {
						out.Success = true
					}
				}
				lastErr = nil
			case http.StatusNotModified:
				// use cache
				cacheMutex.RLock()
				buf := bodyCache[url]
				cacheMutex.RUnlock()
				if len(buf) == 0 {
					lastErr = errors.New("cache miss for 304 response")
					return
				}
				if err := json.Unmarshal(buf, out); err != nil {
					var arr []T
					if err2 := json.Unmarshal(buf, &arr); err2 != nil {
						lastErr = err
						return
					}
					out.Success = true
					out.Data = arr
					out.Message = ""
				} else {
					if !out.Success && len(out.Data) == 0 && out.Message == "" {
						out.Success = true
					}
				}
				lastErr = nil
			default:
				lastErr = errors.New(resp.Status)
			}
		}()
		if lastErr == nil {
			return nil
		}
		sleep := baseDelay * time.Duration(1<<attempt)
		jitter := time.Duration(rand.Intn(150)) * time.Millisecond
		time.Sleep(sleep + jitter)
	}
	return lastErr
}

func ensureVendorID(vendorName string, vendorByName map[string]upstreamVendor, vendorIDCache map[string]int, createdVendors *int) int {
	if vendorName == "" {
		return 0
	}
	if id, ok := vendorIDCache[vendorName]; ok {
		return id
	}
	var existing model.Vendor
	if err := model.DB.Where("name = ?", vendorName).First(&existing).Error; err == nil {
		vendorIDCache[vendorName] = existing.Id
		return existing.Id
	}
	uv := vendorByName[vendorName]
	v := &model.Vendor{
		Name:        vendorName,
		Description: uv.Description,
		Icon:        coalesce(uv.Icon, ""),
		Status:      chooseStatus(uv.Status, 1),
	}
	if err := v.Insert(); err == nil {
		*createdVendors++
		vendorIDCache[vendorName] = v.Id
		return v.Id
	}
	vendorIDCache[vendorName] = 0
	return 0
}

// SyncUpstreamModels 同步上游模型与供应商，仅对「未配置模型」生效
func SyncUpstreamModels(c *gin.Context) {
	var req syncRequest
	// 允许空体
	_ = c.ShouldBindJSON(&req)
	hasOverwrite := len(req.Overwrite) > 0

	// 1) 拉取上游数据
	upstream, err := fetchUpstreamData(c, req.Locale)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "获取上游模型失败: " + err.Error()})
		return
	}

	// 2) 准备同步上下文
	ctxData, err := buildSyncContext(upstream)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	// 3) 无缺失且无覆盖直接返回
	if len(ctxData.missing) == 0 && !hasOverwrite {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
			"created_models":  0,
			"created_vendors": 0,
			"skipped_models":  []string{},
			"updated_models":  0,
			"created_list":    []string{},
			"updated_list":    []string{},
			"source": gin.H{
				"locale":      upstream.Locale,
				"models_url":  upstream.ModelsURL,
				"vendors_url": upstream.VendorsURL,
				"source":      upstream.Source,
			},
		}})
		return
	}

	// 4) 执行同步
	result := applySync(ctxData, req.Overwrite)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"created_models":  result.createdModels,
			"created_vendors": result.createdVendors,
			"updated_models":  result.updatedModels,
			"skipped_models":  result.skipped,
			"created_list":    result.createdList,
			"updated_list":    result.updatedList,
			"source": gin.H{
				"locale":      upstream.Locale,
				"models_url":  upstream.ModelsURL,
				"vendors_url": upstream.VendorsURL,
				"source":      upstream.Source,
			},
		},
	})
}

func containsField(fields []string, key string) bool {
	key = strings.ToLower(strings.TrimSpace(key))
	for _, f := range fields {
		if strings.ToLower(strings.TrimSpace(f)) == key {
			return true
		}
	}
	return false
}

func coalesce(a, b string) string {
	if strings.TrimSpace(a) != "" {
		return a
	}
	return b
}

func chooseStatus(primary, fallback int) int {
	if primary == 0 && fallback != 0 {
		return fallback
	}
	if primary != 0 {
		return primary
	}
	return 1
}

// SyncUpstreamPreview 预览上游与本地的差异（仅用于弹窗选择）
func SyncUpstreamPreview(c *gin.Context) {
	locale := c.Query("locale")
	upstream, err := fetchUpstreamData(c, locale)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "获取上游模型失败: " + err.Error(), "locale": locale})
		return
	}
	syncCtx, err := buildSyncContext(upstream)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	conflicts := calculateConflicts(syncCtx)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"missing":   syncCtx.missing,
			"conflicts": conflicts,
			"source": gin.H{
				"locale":      locale,
				"models_url":  upstream.ModelsURL,
				"vendors_url": upstream.VendorsURL,
				"source":      upstream.Source,
			},
		},
	})
}

// --- 共享同步逻辑 ---

type syncContext struct {
	vendorByName  map[string]upstreamVendor
	modelByName   map[string]upstreamModel
	upstreamNames []string
	locals        []model.Model
	idToVendor    map[int]string
	missing       []string
	source        upstreamData
}

type syncResult struct {
	createdModels  int
	createdVendors int
	updatedModels  int
	skipped        []string
	createdList    []string
	updatedList    []string
}

type conflictField struct {
	Field    string      `json:"field"`
	Local    interface{} `json:"local"`
	Upstream interface{} `json:"upstream"`
}

type conflictItem struct {
	ModelName string          `json:"model_name"`
	Fields    []conflictField `json:"fields"`
}

func fetchUpstreamData(c *gin.Context, locale string) (upstreamData, error) {
	timeoutSec := common.GetEnvOrDefault("SYNC_HTTP_TIMEOUT_SECONDS", 15)
	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Duration(timeoutSec)*time.Second)
	defer cancel()
	modelsURL, vendorsURL := getUpstreamURLs(locale)
	models, vendors, err := fetchUpstreamPayload(ctx, modelsURL, vendorsURL)
	if err != nil {
		return upstreamData{}, err
	}
	return upstreamData{
		Models:     models,
		Vendors:    vendors,
		ModelsURL:  modelsURL,
		VendorsURL: vendorsURL,
		Locale:     locale,
		Source:     "official",
	}, nil
}

func fetchUpstreamPayload(ctx context.Context, modelsURL, vendorsURL string) ([]upstreamModel, []upstreamVendor, error) {
	var vendorsEnv upstreamEnvelope[upstreamVendor]
	var modelsEnv upstreamEnvelope[upstreamModel]
	var fetchErr error
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		_ = fetchJSON(ctx, vendorsURL, &vendorsEnv)
	}()
	go func() {
		defer wg.Done()
		if err := fetchJSON(ctx, modelsURL, &modelsEnv); err != nil {
			fetchErr = err
		}
	}()
	wg.Wait()
	if fetchErr != nil {
		return nil, nil, fetchErr
	}
	return modelsEnv.Data, vendorsEnv.Data, nil
}

func buildSyncContext(up upstreamData) (syncContext, error) {
	vendorByName := make(map[string]upstreamVendor)
	for _, v := range up.Vendors {
		if v.Name != "" {
			vendorByName[v.Name] = v
		}
	}

	modelByName := make(map[string]upstreamModel)
	upstreamNames := make([]string, 0, len(up.Models))
	for _, m := range up.Models {
		if m.ModelName != "" {
			modelByName[m.ModelName] = m
			upstreamNames = append(upstreamNames, m.ModelName)
		}
	}

	var locals []model.Model
	if len(upstreamNames) > 0 {
		_ = model.DB.Where("model_name IN ? AND (sync_official IS NULL OR sync_official <> 0)", upstreamNames).Find(&locals).Error
	}

	vendorIdSet := make(map[int]struct{})
	for _, m := range locals {
		if m.VendorID != 0 {
			vendorIdSet[m.VendorID] = struct{}{}
		}
	}
	vendorIDs := make([]int, 0, len(vendorIdSet))
	for id := range vendorIdSet {
		vendorIDs = append(vendorIDs, id)
	}
	idToVendorName := make(map[int]string)
	if len(vendorIDs) > 0 {
		var dbVendors []model.Vendor
		_ = model.DB.Where("id IN ?", vendorIDs).Find(&dbVendors).Error
		for _, v := range dbVendors {
			idToVendorName[v.Id] = v.Name
		}
	}

	existingSet := make(map[string]struct{}, len(locals))
	for _, m := range locals {
		if m.ModelName != "" {
			existingSet[m.ModelName] = struct{}{}
		}
	}
	missingSet := make(map[string]struct{})
	for _, name := range upstreamNames {
		if _, ok := existingSet[name]; !ok {
			missingSet[name] = struct{}{}
		}
	}
	if abilityMissing, err := model.GetMissingModels(); err == nil {
		for _, name := range abilityMissing {
			if _, ok := modelByName[name]; ok {
				if _, existed := existingSet[name]; !existed {
					missingSet[name] = struct{}{}
				}
			}
		}
	}
	missing := make([]string, 0, len(missingSet))
	for name := range missingSet {
		missing = append(missing, name)
	}

	return syncContext{
		vendorByName:  vendorByName,
		modelByName:   modelByName,
		upstreamNames: upstreamNames,
		locals:        locals,
		idToVendor:    idToVendorName,
		missing:       missing,
		source:        up,
	}, nil
}

func calculateConflicts(ctx syncContext) []conflictItem {
	var conflicts []conflictItem
	for _, local := range ctx.locals {
		up, ok := ctx.modelByName[local.ModelName]
		if !ok {
			continue
		}
		fields := make([]conflictField, 0, 6)
		if strings.TrimSpace(local.Description) != strings.TrimSpace(up.Description) {
			fields = append(fields, conflictField{Field: "description", Local: local.Description, Upstream: up.Description})
		}
		if strings.TrimSpace(local.Icon) != strings.TrimSpace(up.Icon) {
			fields = append(fields, conflictField{Field: "icon", Local: local.Icon, Upstream: up.Icon})
		}
		if strings.TrimSpace(local.Tags) != strings.TrimSpace(up.Tags) {
			fields = append(fields, conflictField{Field: "tags", Local: local.Tags, Upstream: up.Tags})
		}
		localVendor := ctx.idToVendor[local.VendorID]
		if strings.TrimSpace(localVendor) != strings.TrimSpace(up.VendorName) {
			fields = append(fields, conflictField{Field: "vendor", Local: localVendor, Upstream: up.VendorName})
		}
		if local.NameRule != up.NameRule {
			fields = append(fields, conflictField{Field: "name_rule", Local: local.NameRule, Upstream: up.NameRule})
		}
		if local.Status != chooseStatus(up.Status, local.Status) {
			fields = append(fields, conflictField{Field: "status", Local: local.Status, Upstream: up.Status})
		}
		if len(fields) > 0 {
			conflicts = append(conflicts, conflictItem{ModelName: local.ModelName, Fields: fields})
		}
	}
	return conflicts
}

func applySync(ctx syncContext, overwrite []overwriteField) syncResult {
	createdModels := 0
	createdVendors := 0
	updatedModels := 0
	var skipped []string
	var createdList []string
	var updatedList []string

	vendorIDCache := make(map[string]int)

	for _, name := range ctx.missing {
		up, ok := ctx.modelByName[name]
		if !ok {
			skipped = append(skipped, name)
			continue
		}
		var existing model.Model
		if err := model.DB.Where("model_name = ?", name).First(&existing).Error; err == nil {
			if existing.SyncOfficial == 0 {
				skipped = append(skipped, name)
				continue
			}
		}

		vendorID := ensureVendorID(up.VendorName, ctx.vendorByName, vendorIDCache, &createdVendors)

		mi := &model.Model{
			ModelName:   name,
			Description: up.Description,
			Icon:        up.Icon,
			Tags:        up.Tags,
			VendorID:    vendorID,
			Status:      chooseStatus(up.Status, 1),
			NameRule:    up.NameRule,
		}
		if err := mi.Insert(); err == nil {
			createdModels++
			createdList = append(createdList, name)
		} else {
			skipped = append(skipped, name)
		}
	}

	if len(overwrite) > 0 {
		for _, ow := range overwrite {
			up, ok := ctx.modelByName[ow.ModelName]
			if !ok {
				continue
			}
			var local model.Model
			if err := model.DB.Where("model_name = ?", ow.ModelName).First(&local).Error; err != nil {
				continue
			}
			if local.SyncOfficial == 0 {
				continue
			}
			newVendorID := ensureVendorID(up.VendorName, ctx.vendorByName, vendorIDCache, &createdVendors)
			_ = model.DB.Transaction(func(tx *gorm.DB) error {
				needUpdate := false
				if containsField(ow.Fields, "description") {
					local.Description = up.Description
					needUpdate = true
				}
				if containsField(ow.Fields, "icon") {
					local.Icon = up.Icon
					needUpdate = true
				}
				if containsField(ow.Fields, "tags") {
					local.Tags = up.Tags
					needUpdate = true
				}
				if containsField(ow.Fields, "vendor") {
					local.VendorID = newVendorID
					needUpdate = true
				}
				if containsField(ow.Fields, "name_rule") {
					local.NameRule = up.NameRule
					needUpdate = true
				}
				if containsField(ow.Fields, "status") {
					local.Status = chooseStatus(up.Status, local.Status)
					needUpdate = true
				}
				if !needUpdate {
					return nil
				}
				if err := tx.Save(&local).Error; err != nil {
					return err
				}
				updatedModels++
				updatedList = append(updatedList, ow.ModelName)
				return nil
			})
		}
	}

	return syncResult{
		createdModels:  createdModels,
		createdVendors: createdVendors,
		updatedModels:  updatedModels,
		skipped:        skipped,
		createdList:    createdList,
		updatedList:    updatedList,
	}
}

// --- 配置文件同步 ---

func parseUpstreamBundle(body []byte) ([]upstreamModel, []upstreamVendor, error) {
	type bundle struct {
		Models  []upstreamModel  `json:"models"`
		Vendors []upstreamVendor `json:"vendors"`
		Data    []upstreamModel  `json:"data"`
		Success bool             `json:"success"`
		Message string           `json:"message"`
	}
	var b bundle
	if err := json.Unmarshal(body, &b); err == nil {
		models := b.Models
		if len(models) == 0 {
			models = b.Data
		}
		if len(models) > 0 || len(b.Vendors) > 0 {
			return models, b.Vendors, nil
		}
	}
	if models, err := parseUpstreamJSON[upstreamModel](body); err == nil {
		return models, []upstreamVendor{}, nil
	}
	return nil, nil, errors.New("无法解析上传的 JSON 文件")
}

func parseOverwriteFromForm(c *gin.Context) ([]overwriteField, error) {
	raw := c.PostForm("overwrite")
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	var ow []overwriteField
	if err := json.Unmarshal([]byte(raw), &ow); err != nil {
		return nil, err
	}
	return ow, nil
}

func parseUploadedUpstream(c *gin.Context) (upstreamData, error) {
	file, err := c.FormFile("file")
	if err != nil {
		return upstreamData{}, errors.New("请上传 models.json 文件")
	}
	f, err := file.Open()
	if err != nil {
		return upstreamData{}, err
	}
	defer f.Close()
	body, err := io.ReadAll(f)
	if err != nil {
		return upstreamData{}, err
	}
	models, vendors, err := parseUpstreamBundle(body)
	if err != nil {
		return upstreamData{}, err
	}
	locale := c.PostForm("locale")
	return upstreamData{
		Models:     models,
		Vendors:    vendors,
		ModelsURL:  "upload",
		VendorsURL: "upload",
		Locale:     locale,
		Source:     "config_file",
	}, nil
}

// SyncConfigPreview 预览上传文件与本地的差异
func SyncConfigPreview(c *gin.Context) {
	upstream, err := parseUploadedUpstream(c)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	syncCtx, err := buildSyncContext(upstream)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	conflicts := calculateConflicts(syncCtx)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"missing":   syncCtx.missing,
			"conflicts": conflicts,
			"source": gin.H{
				"locale":      upstream.Locale,
				"models_url":  upstream.ModelsURL,
				"vendors_url": upstream.VendorsURL,
				"source":      upstream.Source,
			},
		},
	})
}

// SyncConfigModels 同步上传文件的模型元数据
func SyncConfigModels(c *gin.Context) {
	upstream, err := parseUploadedUpstream(c)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	overwrite, err := parseOverwriteFromForm(c)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "解析 overwrite 失败: " + err.Error()})
		return
	}
	hasOverwrite := len(overwrite) > 0
	syncCtx, err := buildSyncContext(upstream)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	if len(syncCtx.missing) == 0 && !hasOverwrite {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
			"created_models":  0,
			"created_vendors": 0,
			"skipped_models":  []string{},
			"updated_models":  0,
			"created_list":    []string{},
			"updated_list":    []string{},
			"source": gin.H{
				"locale":      upstream.Locale,
				"models_url":  upstream.ModelsURL,
				"vendors_url": upstream.VendorsURL,
				"source":      upstream.Source,
			},
		}})
		return
	}
	result := applySync(syncCtx, overwrite)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"created_models":  result.createdModels,
			"created_vendors": result.createdVendors,
			"updated_models":  result.updatedModels,
			"skipped_models":  result.skipped,
			"created_list":    result.createdList,
			"updated_list":    result.updatedList,
			"source": gin.H{
				"locale":      upstream.Locale,
				"models_url":  upstream.ModelsURL,
				"vendors_url": upstream.VendorsURL,
				"source":      upstream.Source,
			},
		},
	})
}
