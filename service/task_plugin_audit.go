package service

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/gin-gonic/gin"
)

// TaskExecutionSnapshotFromContext captures immutable request and plugin
// provenance at submission time. It never copies plugin source or payloads.
func TaskExecutionSnapshotFromContext(ctx *gin.Context) *model.TaskExecutionSnapshot {
	if ctx == nil {
		return nil
	}
	snapshot := &model.TaskExecutionSnapshot{
		RequestID: ctx.GetString(common.RequestIdKey),
	}
	if ctx.Request != nil && ctx.Request.URL != nil {
		snapshot.RequestPath = ctx.Request.URL.Path
	}

	pinnedValue, exists := ctx.Get(pluginruntime.ContextKeyPinnedPlugin)
	if exists {
		pinned, ok := pinnedValue.(pluginruntime.PinnedPlugin)
		if ok && pinned.Plugin != nil {
			generation := uint64(0)
			if pinned.Generation != nil {
				generation = pinned.Generation.Number
			}
			meta := pinned.Plugin.Meta
			snapshot.TaskPlugin = &model.TaskPluginSnapshot{
				Key:     meta.Key,
				Name:    meta.Name,
				Version: meta.Version,
				Author: &model.TaskPluginAuthorSnapshot{
					Name: meta.Author.Name,
					URL:  meta.Author.URL,
				},
				APIVersion: meta.APIVersion,
				Generation: generation,
			}
		}
	}

	if snapshot.RequestID == "" && snapshot.RequestPath == "" && snapshot.TaskPlugin == nil {
		return nil
	}
	return snapshot
}

// AppendTaskPluginAuditInfo writes role-separated, credential-free plugin
// provenance into a usage log.
func AppendTaskPluginAuditInfo(other map[string]interface{}, snapshot *model.TaskPluginSnapshot) {
	if other == nil || snapshot == nil || snapshot.Key == "" {
		return
	}
	adminInfo, ok := other["admin_info"].(map[string]interface{})
	if !ok || adminInfo == nil {
		adminInfo = map[string]interface{}{}
		other["admin_info"] = adminInfo
	}
	taskPlugin := map[string]interface{}{
		"key":     snapshot.Key,
		"name":    snapshot.Name,
		"version": snapshot.Version,
	}
	if snapshot.Author != nil && snapshot.Author.Name != "" {
		author := map[string]interface{}{"name": snapshot.Author.Name}
		if snapshot.Author.URL != "" {
			author["url"] = snapshot.Author.URL
		}
		taskPlugin["author"] = author
	}
	adminInfo["task_plugin"] = taskPlugin

	rootInfo, ok := other["root_info"].(map[string]interface{})
	if !ok || rootInfo == nil {
		rootInfo = map[string]interface{}{}
		other["root_info"] = rootInfo
	}
	rootInfo["task_plugin"] = map[string]interface{}{
		"key":         snapshot.Key,
		"version":     snapshot.Version,
		"api_version": snapshot.APIVersion,
		"generation":  snapshot.Generation,
	}
}

// AppendTaskPluginContextAuditInfo is used before a task row exists, such as
// an upstream submission error log.
func AppendTaskPluginContextAuditInfo(ctx *gin.Context, other map[string]interface{}) {
	execution := TaskExecutionSnapshotFromContext(ctx)
	if execution == nil {
		return
	}
	AppendTaskPluginAuditInfo(other, execution.TaskPlugin)
}
