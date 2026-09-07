package controller

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/plugins"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const maxTaskPluginSourceBytes = 1024 * 1024

type taskPluginUploadRequest struct {
	Source       string `json:"source" binding:"required"`
	Enabled      *bool  `json:"enabled"`
	Remark       string `json:"remark"`
	Force        bool   `json:"force"`
	SourceSha256 string `json:"sourceSha256"`
}

func UploadTaskPlugin(c *gin.Context) {
	var request taskPluginUploadRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	if len(request.Source) > maxTaskPluginSourceBytes {
		common.ApiErrorMsg(c, "plugin source exceeds 1 MiB")
		return
	}
	if expected := strings.TrimSpace(request.SourceSha256); expected != "" {
		actual := fmt.Sprintf("%x", sha256.Sum256([]byte(request.Source)))
		if !strings.EqualFold(actual, expected) {
			common.ApiErrorMsg(c, "plugin source sha256 mismatch")
			return
		}
	}
	temporary := jsplugin.NewRegistry()
	loaded, err := temporary.Register(request.Source, jsplugin.Options{})
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	if err = jsplugin.ValidateV1Meta(loaded.Meta); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	enabled := true
	if request.Enabled != nil {
		enabled = *request.Enabled
	}
	if enabled && !request.Force {
		if err = jsplugin.PreflightRoutingConflict(jsplugin.DefaultRegistry.Generation(), loaded); err != nil {
			common.ApiErrorMsg(c, err.Error())
			return
		}
	}
	plugin := model.TaskPlugin{
		Key: loaded.Meta.Key, APIVersion: loaded.Meta.APIVersion, Version: loaded.Meta.Version,
		Source: request.Source, SourceHash: fmt.Sprintf("%x", sha256.Sum256([]byte(request.Source))),
		Enabled: enabled, Remark: request.Remark,
	}
	if err = model.SaveTaskPlugin(&plugin); err != nil {
		common.ApiError(c, err)
		return
	}
	if err = syncTaskPluginsOnceContext(c.Request.Context()); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, taskPluginDetail{Plugin: &plugin, Meta: loaded.Meta, Source: plugin.Source, Layer: "override"})
}

func GetTaskPluginVersions(c *gin.Context) {
	plugins, err := model.ListTaskPluginVersions(c.Param("key"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, plugins)
}

type taskPluginListItem struct {
	Meta          jsplugin.Meta  `json:"meta"`
	Source        string         `json:"source"`
	Enabled       bool           `json:"enabled"`
	Active        bool           `json:"active"`
	SourceHash    string         `json:"source_hash"`
	Remark        string         `json:"remark"`
	RuntimeStatus string         `json:"runtime_status"`
	RuntimeError  string         `json:"runtime_error,omitempty"`
	FactoryMeta   *jsplugin.Meta `json:"factory_meta,omitempty"`
	ChannelCount  int            `json:"channel_count"`
	InFlightCount int64          `json:"in_flight_count"`
}

type taskPluginRebuildOutcome struct {
	Status           string    `json:"status"`
	AttemptedAt      time.Time `json:"attempted_at"`
	Generation       uint64    `json:"generation"`
	DatabaseRevision string    `json:"database_revision,omitempty"`
	PluginErrorCount int       `json:"plugin_error_count"`
	Error            string    `json:"error,omitempty"`
}

type taskPluginRuntimeStatus struct {
	CurrentGeneration     uint64                   `json:"current_generation"`
	GenerationPublishedAt time.Time                `json:"generation_published_at"`
	DatabaseRevision      string                   `json:"database_revision"`
	DatabaseError         string                   `json:"database_error,omitempty"`
	LastRebuild           taskPluginRebuildOutcome `json:"last_rebuild"`
	PluginErrors          map[string]string        `json:"plugin_errors"`
}

func ListTaskPlugins(c *gin.Context) {
	databasePlugins, err := model.ListTaskPlugins()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	snapshot := jsplugin.DefaultRegistry.Snapshot()
	factory := make(map[string]jsplugin.Meta, len(snapshot.Factory))
	override := make(map[string]jsplugin.Meta, len(snapshot.Override))
	for _, meta := range snapshot.Factory {
		factory[meta.Key] = meta
	}
	for _, meta := range snapshot.Override {
		override[meta.Key] = meta
	}
	activeRows := make(map[string]model.TaskPlugin)
	keys := make(map[string]struct{}, len(factory)+len(databasePlugins))
	for key := range factory {
		keys[key] = struct{}{}
	}
	for _, plugin := range databasePlugins {
		keys[plugin.Key] = struct{}{}
		if plugin.Active {
			activeRows[plugin.Key] = plugin
		}
	}

	runtimeErrors := jsplugin.DefaultRegistry.RoutingErrors()
	taskPluginSyncState.Lock()
	for key, message := range taskPluginSyncState.errors {
		runtimeErrors[key] = message
	}
	taskPluginSyncState.Unlock()

	items := make([]taskPluginListItem, 0, len(keys))
	for key := range keys {
		factoryMeta, hasFactory := factory[key]
		row, hasOverride := activeRows[key]
		item := taskPluginListItem{Enabled: true, Active: true, RuntimeStatus: "registered"}
		if hasOverride {
			item.Source = "override"
			if hasFactory {
				item.Source = "override_over_factory"
				factoryCopy := factoryMeta
				item.FactoryMeta = &factoryCopy
			}
			item.Meta = jsplugin.Meta{Key: row.Key, Version: row.Version, APIVersion: row.APIVersion}
			if compiled, compileErr := jsplugin.NewRegistry().Register(row.Source, jsplugin.Options{Key: row.Key, Version: row.Version}); compileErr == nil {
				item.Meta = compiled.Meta
			}
			item.Enabled = row.Enabled
			item.Active = row.Active
			item.SourceHash = row.SourceHash
			item.Remark = row.Remark
			if !constant.TaskPluginOverrideEnabled {
				item.RuntimeStatus = "disabled_fallback"
			} else if message := runtimeErrors[key]; message != "" {
				item.RuntimeStatus = "compile_failed"
				item.RuntimeError = message
			} else if runtimeMeta, ok := override[key]; ok {
				item.Meta = runtimeMeta
			} else if !row.Enabled {
				item.RuntimeStatus = "disabled_fallback"
			} else {
				item.RuntimeStatus = "not_registered"
			}
		} else {
			item.Source = "factory"
			item.Meta = factoryMeta
			item.Enabled = !setting.IsTaskPluginFactoryDisabled(key)
			source, sourceErr := plugins.Source(key)
			if sourceErr == nil {
				item.SourceHash = fmt.Sprintf("%x", sha256.Sum256([]byte(source)))
			}
			if !item.Enabled {
				item.RuntimeStatus = "disabled"
			} else if message := runtimeErrors[key]; message != "" {
				item.RuntimeStatus = "compile_failed"
				item.RuntimeError = message
			}
		}
		if !hasFactory {
			channels, inFlight, usageErr := model.GetTaskPluginUsage(key)
			if usageErr != nil {
				common.ApiError(c, usageErr)
				return
			}
			item.ChannelCount = len(channels)
			item.InFlightCount = inFlight
		}
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Meta.Key < items[j].Meta.Key })
	common.ApiSuccess(c, items)
}

func GetTaskPluginRuntime(c *gin.Context) {
	routingStatus := jsplugin.DefaultRegistry.RoutingStatus()
	pluginErrors := routingStatus.Errors

	taskPluginSyncState.Lock()
	for key, message := range taskPluginSyncState.errors {
		pluginErrors[key] = message
	}
	lastRebuild := taskPluginSyncState.lastRebuild
	lastDatabaseRevision := lastRebuild.DatabaseRevision
	taskPluginSyncState.Unlock()

	registryRebuild := routingStatus.LastRebuild
	if lastRebuild.AttemptedAt.Before(registryRebuild.AttemptedAt) {
		lastRebuild = taskPluginRebuildOutcome{
			Status:      registryRebuild.Status,
			AttemptedAt: registryRebuild.AttemptedAt,
			Generation:  registryRebuild.Generation,
			Error:       registryRebuild.Error,
		}
	}
	if lastRebuild.Status == "" {
		lastRebuild.Status = "never"
	}
	lastRebuild.PluginErrorCount = len(pluginErrors)
	if lastRebuild.Status == "success" && len(pluginErrors) > 0 {
		lastRebuild.Status = "partial"
	}

	status := taskPluginRuntimeStatus{
		DatabaseRevision: lastDatabaseRevision,
		LastRebuild:      lastRebuild,
		PluginErrors:     pluginErrors,
	}
	databaseSnapshot, err := model.GetTaskPluginSyncSnapshot()
	if err != nil {
		status.DatabaseError = "database snapshot unavailable"
	} else {
		status.DatabaseRevision = databaseSnapshot.Revision
	}
	if routingStatus.Generation != nil {
		status.CurrentGeneration = routingStatus.Generation.Number
		status.GenerationPublishedAt = routingStatus.Generation.PublishedAt
	}
	common.ApiSuccess(c, status)
}

type taskPluginDetail struct {
	Plugin *model.TaskPlugin `json:"plugin,omitempty"`
	Meta   jsplugin.Meta     `json:"meta"`
	Source string            `json:"source"`
	Layer  string            `json:"layer"`
}

func GetTaskPlugin(c *gin.Context) {
	key := c.Param("key")
	version := c.Query("version")
	plugin, err := model.GetTaskPluginVersion(key, version)
	if err == nil {
		loaded, compileErr := jsplugin.NewRegistry().Register(plugin.Source, jsplugin.Options{Key: plugin.Key, Version: plugin.Version})
		if compileErr != nil {
			common.ApiErrorMsg(c, compileErr.Error())
			return
		}
		common.ApiSuccess(c, taskPluginDetail{Plugin: plugin, Meta: loaded.Meta, Source: plugin.Source, Layer: "override"})
		return
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) || version != "" {
		common.ApiError(c, err)
		return
	}
	source, err := plugins.Source(key)
	if err != nil {
		common.ApiErrorMsg(c, "task plugin not found")
		return
	}
	loaded, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: key})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, taskPluginDetail{Meta: loaded.Meta, Source: source, Layer: "factory"})
}

type taskPluginDryRunRequest struct {
	Hook   string            `json:"hook" binding:"required"`
	Member string            `json:"member"`
	Args   []json.RawMessage `json:"args"`
}

func DryRunTaskPlugin(c *gin.Context) {
	var request taskPluginDryRunRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	detailSource := ""
	plugin, err := model.GetTaskPluginVersion(c.Param("key"), "")
	if err == nil {
		detailSource = plugin.Source
	} else if errors.Is(err, gorm.ErrRecordNotFound) {
		detailSource, err = plugins.Source(c.Param("key"))
	}
	if err != nil {
		common.ApiErrorMsg(c, "task plugin not found")
		return
	}
	loaded, err := jsplugin.NewRegistry().Register(detailSource, jsplugin.Options{Key: c.Param("key")})
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	args := make([]any, len(request.Args))
	for index, raw := range request.Args {
		if err = common.Unmarshal(raw, &args[index]); err != nil {
			common.ApiErrorMsg(c, fmt.Sprintf("invalid argument %d: %v", index+1, err))
			return
		}
	}
	var output any
	if request.Member == "" {
		output, err = loaded.Engine.Call(context.Background(), request.Hook, args...)
	} else {
		output, err = loaded.Engine.CallMember(context.Background(), request.Hook, request.Member, args...)
	}
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, output)
}

func DeleteTaskPluginVersion(c *gin.Context) {
	key := c.Param("key")
	version := c.Param("version")
	plugin, lookupErr := model.GetTaskPluginVersion(key, version)
	if lookupErr != nil {
		if errors.Is(lookupErr, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "override plugin version not found; factory plugins cannot be deleted")
			return
		}
		common.ApiError(c, lookupErr)
		return
	}
	if plugin.Active && !taskPluginHasFactory(key) {
		channels, inFlight, usageErr := model.GetTaskPluginUsage(key)
		if usageErr != nil {
			common.ApiError(c, usageErr)
			return
		}
		if (len(channels) > 0 || inFlight > 0) && c.Query("force") != "true" {
			c.JSON(200, gin.H{"success": false, "message": "task plugin is still in use", "data": gin.H{"channels": channels, "in_flight_count": inFlight}})
			return
		}
	}
	_, err := model.DeleteTaskPluginVersion(key, version)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "override plugin version not found; factory plugins cannot be deleted")
			return
		}
		common.ApiError(c, err)
		return
	}
	if err = syncTaskPluginsOnceContext(c.Request.Context()); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

type taskPluginActivateRequest struct {
	Version string `json:"version" binding:"required"`
}

func ActivateTaskPlugin(c *gin.Context) {
	var request taskPluginActivateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	versions, err := model.ListTaskPluginVersions(c.Param("key"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var target *model.TaskPlugin
	for i := range versions {
		if versions[i].Version == request.Version {
			target = &versions[i]
			break
		}
	}
	if target == nil {
		common.ApiErrorMsg(c, "plugin version not found")
		return
	}
	if _, err = jsplugin.NewRegistry().Register(target.Source, jsplugin.Options{Key: target.Key, Version: target.Version}); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	if err = model.ActivateTaskPlugin(target.Key, target.Version); err != nil {
		common.ApiError(c, err)
		return
	}
	if err = syncTaskPluginsOnceContext(c.Request.Context()); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

type taskPluginStatusRequest struct {
	Enabled *bool `json:"enabled" binding:"required"`
}

func SetTaskPluginStatus(c *gin.Context) {
	var request taskPluginStatusRequest
	if err := c.ShouldBindJSON(&request); err != nil || request.Enabled == nil {
		common.ApiErrorMsg(c, "enabled is required")
		return
	}
	key := c.Param("key")
	disabledChannels := 0
	if !*request.Enabled {
		channels, inFlight, usageErr := model.GetTaskPluginUsage(key)
		if usageErr != nil {
			common.ApiError(c, usageErr)
			return
		}
		cascade := c.Query("cascade") == "true"
		force := c.Query("force") == "true"
		if (len(channels) > 0 && !cascade) || (inFlight > 0 && !force) {
			c.JSON(200, gin.H{"success": false, "message": "task plugin is still in use", "data": gin.H{"channels": channels, "in_flight_count": inFlight}})
			return
		}
		if cascade {
			for _, channel := range channels {
				if model.UpdateChannelStatus(channel.Id, "", common.ChannelStatusManuallyDisabled, "task plugin disabled") {
					disabledChannels++
				}
			}
		}
	}
	_, lookupErr := model.GetTaskPluginVersion(key, "")
	hasActiveOverride := lookupErr == nil
	if lookupErr != nil && !errors.Is(lookupErr, gorm.ErrRecordNotFound) {
		common.ApiError(c, lookupErr)
		return
	}
	// The disabled set suppresses only the factory fallback layer. An enabled
	// override for the same key keeps serving and is toggled independently.
	if taskPluginHasFactory(key) && !hasActiveOverride {
		keys := setting.GetTaskPluginDisabledFactoryKeys()
		if *request.Enabled {
			next := make([]string, 0, len(keys))
			for _, item := range keys {
				if item != key {
					next = append(next, item)
				}
			}
			keys = next
		} else {
			keys = append(append([]string{}, keys...), key)
		}
		if err := setting.SetTaskPluginDisabledFactoryKeysOption(keys); err != nil {
			common.ApiError(c, err)
			return
		}
		encoded, err := common.Marshal(setting.GetTaskPluginDisabledFactoryKeys())
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if err = model.UpdateOption(setting.TaskPluginDisabledFactoryKeysKey, string(encoded)); err != nil {
			common.ApiError(c, err)
			return
		}
		common.ApiSuccess(c, gin.H{"plugin_enabled": *request.Enabled, "disabled_channels": disabledChannels})
		return
	}
	if err := model.SetTaskPluginEnabled(key, *request.Enabled); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := syncTaskPluginsOnceContext(c.Request.Context()); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"plugin_enabled": *request.Enabled, "disabled_channels": disabledChannels})
}

func taskPluginHasFactory(key string) bool {
	for _, meta := range jsplugin.DefaultRegistry.Snapshot().Factory {
		if meta.Key == key {
			return true
		}
	}
	return false
}

func GetTaskPluginMarketplaceSources(c *gin.Context) {
	common.ApiSuccess(c, setting.GetTaskPluginMarketplaceSources())
}

func UpdateTaskPluginMarketplaceSources(c *gin.Context) {
	var sources []setting.TaskPluginMarketplaceSource
	if err := c.ShouldBindJSON(&sources); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	if sources == nil {
		sources = []setting.TaskPluginMarketplaceSource{}
	}
	for i := range sources {
		name := strings.TrimSpace(sources[i].Name)
		indexURL := strings.TrimSpace(sources[i].IndexURL)
		if name == "" {
			common.ApiErrorMsg(c, "marketplace source name is required")
			return
		}
		parsed, err := url.Parse(indexURL)
		if err != nil || !parsed.IsAbs() || parsed.Host == "" || (!strings.EqualFold(parsed.Scheme, "http") && !strings.EqualFold(parsed.Scheme, "https")) {
			common.ApiErrorMsg(c, "marketplace source index_url must be an absolute http(s) URL")
			return
		}
		sources[i].Name = name
		sources[i].IndexURL = indexURL
	}
	encoded, err := common.Marshal(sources)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err = model.UpdateOption(setting.TaskPluginMarketplaceSourcesKey, string(encoded)); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, sources)
}

func GetTaskPluginOptions(c *gin.Context) {
	snapshot := jsplugin.DefaultRegistry.Snapshot()
	seen := make(map[string]bool)
	options := make([]gin.H, 0, len(snapshot.Factory)+len(snapshot.Override))
	for layer, metas := range [][]jsplugin.Meta{snapshot.Override, snapshot.Factory} {
		for _, meta := range metas {
			if seen[meta.Key] {
				continue
			}
			// Disabled factory keys are omitted from bind options. The disabled
			// set suppresses only the factory fallback; an enabled override for
			// the same key is listed in the override pass and still appears.
			if layer == 1 && setting.IsTaskPluginFactoryDisabled(meta.Key) {
				continue
			}
			if _, ok := jsplugin.DefaultRegistry.Get(meta.Key); !ok {
				continue
			}
			seen[meta.Key] = true
			options = append(options, gin.H{
				"key":         meta.Key,
				"name":        meta.Name,
				"models":      meta.Models,
				"usageSchema": meta.UsageSchema,
			})
		}
	}
	sort.Slice(options, func(i, j int) bool { return options[i]["key"].(string) < options[j]["key"].(string) })
	common.ApiSuccess(c, options)
}

var taskPluginSyncState = struct {
	sync.Mutex
	hashes      map[string]string
	errors      map[string]string
	lastRebuild taskPluginRebuildOutcome
}{hashes: map[string]string{}, errors: map[string]string{}}

func syncTaskPluginsOnce() error {
	return syncTaskPluginsOnceContext(context.Background())
}

func syncTaskPluginsOnceContext(ctx context.Context) error {
	started := time.Now()
	taskPluginSyncState.Lock()
	defer taskPluginSyncState.Unlock()
	databaseSnapshot, err := model.GetTaskPluginSyncSnapshot()
	if err != nil {
		syncErr := fmt.Errorf("sync task plugins: %w", err)
		taskPluginSyncState.lastRebuild = taskPluginRebuildOutcome{
			Status:           "failed",
			AttemptedAt:      time.Now(),
			Generation:       jsplugin.DefaultRegistry.Generation().Number,
			DatabaseRevision: taskPluginSyncState.lastRebuild.DatabaseRevision,
			Error:            syncErr.Error(),
		}
		logger.LogDebug(
			ctx,
			"task_plugin subsystem=sync event=failed stage=database_snapshot retained_generation=%d elapsed_ms=%d",
			jsplugin.DefaultRegistry.Generation().Number,
			time.Since(started).Milliseconds(),
		)
		return syncErr
	}
	databasePlugins := databaseSnapshot.Plugins
	sort.Slice(databasePlugins, func(i, j int) bool { return databasePlugins[i].Key < databasePlugins[j].Key })
	currentOverrides := jsplugin.DefaultRegistry.OverridePlugins()
	generationBefore := jsplugin.DefaultRegistry.Generation().Number
	logger.LogDebug(
		ctx,
		"task_plugin subsystem=sync event=start database_revision=%q generation=%d desired_plugins=%d current_overrides=%d",
		databaseSnapshot.Revision,
		generationBefore,
		len(databasePlugins),
		len(currentOverrides),
	)
	nextOverrides := make([]*jsplugin.LoadedPlugin, 0, len(databasePlugins))
	nextHashes := make(map[string]string, len(databasePlugins))
	seen := make(map[string]bool, len(databasePlugins))
	for _, plugin := range databasePlugins {
		seen[plugin.Key] = true
		if current := currentOverrides[plugin.Key]; current != nil && taskPluginSyncState.hashes[plugin.Key] == plugin.SourceHash {
			nextOverrides = append(nextOverrides, current)
			nextHashes[plugin.Key] = plugin.SourceHash
			logger.LogDebug(
				ctx,
				"task_plugin subsystem=sync event=plugin plugin=%q version=%q action=reuse",
				plugin.Key,
				plugin.Version,
			)
			continue
		}
		logger.LogDebug(
			ctx,
			"task_plugin subsystem=sync event=plugin plugin=%q version=%q action=compile_start",
			plugin.Key,
			plugin.Version,
		)
		compiled, compileErr := jsplugin.CompilePlugin(plugin.Source, jsplugin.Options{Key: plugin.Key, Version: plugin.Version})
		if compileErr != nil {
			retainedIncumbent := false
			if current := currentOverrides[plugin.Key]; current != nil {
				nextOverrides = append(nextOverrides, current)
				retainedIncumbent = true
				if currentHash := taskPluginSyncState.hashes[plugin.Key]; currentHash != "" {
					nextHashes[plugin.Key] = currentHash
				}
			}
			taskPluginSyncState.errors[plugin.Key] = compileErr.Error()
			common.SysError(fmt.Sprintf("compile task plugin %s@%s: %v", plugin.Key, plugin.Version, compileErr))
			logger.LogDebug(
				ctx,
				"task_plugin subsystem=sync event=plugin plugin=%q version=%q action=compile_failed retained_incumbent=%t",
				plugin.Key,
				plugin.Version,
				retainedIncumbent,
			)
			continue
		}
		nextOverrides = append(nextOverrides, compiled)
		nextHashes[plugin.Key] = plugin.SourceHash
		delete(taskPluginSyncState.errors, plugin.Key)
		logger.LogDebug(
			ctx,
			"task_plugin subsystem=sync event=plugin plugin=%q version=%q action=compile_success",
			plugin.Key,
			plugin.Version,
		)
	}
	if err = jsplugin.DefaultRegistry.ReplaceOverrides(nextOverrides); err != nil {
		syncErr := fmt.Errorf("publish task plugin generation: %w", err)
		taskPluginSyncState.lastRebuild = taskPluginRebuildOutcome{
			Status:           "failed",
			AttemptedAt:      time.Now(),
			Generation:       jsplugin.DefaultRegistry.Generation().Number,
			DatabaseRevision: databaseSnapshot.Revision,
			Error:            syncErr.Error(),
		}
		logger.LogDebug(
			ctx,
			"task_plugin subsystem=sync event=failed stage=publish retained_generation=%d retained_generation_active=true database_revision=%q elapsed_ms=%d",
			jsplugin.DefaultRegistry.Generation().Number,
			databaseSnapshot.Revision,
			time.Since(started).Milliseconds(),
		)
		return syncErr
	}
	taskPluginSyncState.hashes = nextHashes
	for key := range taskPluginSyncState.errors {
		if !seen[key] {
			delete(taskPluginSyncState.errors, key)
		}
	}
	pluginErrors := jsplugin.DefaultRegistry.RoutingErrors()
	for key, message := range taskPluginSyncState.errors {
		pluginErrors[key] = message
	}
	pluginErrorCount := len(pluginErrors)
	status := "success"
	if pluginErrorCount > 0 {
		status = "partial"
	}
	taskPluginSyncState.lastRebuild = taskPluginRebuildOutcome{
		Status:           status,
		AttemptedAt:      time.Now(),
		Generation:       jsplugin.DefaultRegistry.Generation().Number,
		DatabaseRevision: databaseSnapshot.Revision,
		PluginErrorCount: pluginErrorCount,
	}
	logger.LogDebug(
		ctx,
		"task_plugin subsystem=sync event=complete database_revision=%q previous_generation=%d generation=%d status=%q active_overrides=%d plugin_errors=%d elapsed_ms=%d",
		databaseSnapshot.Revision,
		generationBefore,
		jsplugin.DefaultRegistry.Generation().Number,
		status,
		len(jsplugin.DefaultRegistry.ActiveOverridePlugins()),
		pluginErrorCount,
		time.Since(started).Milliseconds(),
	)
	return nil
}

func SyncTaskPluginsOnce() {
	if err := syncTaskPluginsOnce(); err != nil {
		common.SysError(err.Error())
	}
}

func SyncTaskPlugins() {
	SyncTaskPluginsOnce()
	for range time.NewTicker(30 * time.Second).C {
		SyncTaskPluginsOnce()
	}
}
