package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/mediastore"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// PersistTaskResultToOBS 把一个任务成功产物搬到 OBS，成功返回落库占位符 obs://<key> 与 true；
// 总开关关闭 / 非可搬来源 / 失败均返回 ("", false)，由调用方回退到老行为（§5.1/§5.2）。绝不阻塞任务返回。
//
// 两类来源，优先级从高到低：
//  1. nfsPath —— adaptor 显式给出的成品绝对路径（自建模型，GPUStack/LightX2V），须在 NFSOutputRoot 之下；
//  2. rawURL —— 上游临时 URL（第三方渠道，下载后落盘）；或历史上把 nfs 路径塞进 Url 的启发式兜底。
func PersistTaskResultToOBS(ctx context.Context, task *model.Task, nfsPath, rawURL string) (string, bool) {
	if !mediastore.Enabled() || task == nil {
		return "", false
	}
	s := system_setting.GetMediaStorageSettings()
	root := s.NFSRoot()

	// 1) 显式 nfs_path（最规范：无需猜）。
	if nfsPath != "" && s.IngestNFSPath && isUnderRoot(root, nfsPath) {
		key := mediastore.KeyFromNFSPath(root, nfsPath)
		if ok := persistToOBS(ctx, task, key, mediastore.PersistSource{NFSPath: nfsPath}); ok {
			return mediastore.WrapKey(key), true
		}
		return "", false
	}

	// 2) rawURL：nfs 路径塞进 Url 的启发式兜底 / 第三方上游 URL。
	if rawURL != "" {
		switch {
		case s.IngestNFSPath && isUnderRoot(root, rawURL):
			key := mediastore.KeyFromNFSPath(root, rawURL)
			if ok := persistToOBS(ctx, task, key, mediastore.PersistSource{NFSPath: rawURL}); ok {
				return mediastore.WrapKey(key), true
			}
		case s.IngestUpstreamURL && (strings.HasPrefix(rawURL, "http://") || strings.HasPrefix(rawURL, "https://")):
			key := buildTaskObjectKey(task, rawURL)
			if key != "" {
				if ok := persistToOBS(ctx, task, key, mediastore.PersistSource{UpstreamURL: rawURL}); ok {
					return mediastore.WrapKey(key), true
				}
			}
		}
	}
	return "", false
}

// isUnderRoot 判断 p 是否落在 root 目录之下（简单前缀，最终越权校验在 mediastore.ValidateNFSPath）。
func isUnderRoot(root, p string) bool {
	return strings.HasPrefix(p, strings.TrimRight(root, "/")+"/")
}

// persistToOBS 执行落盘并写审计 metadata，失败记日志。
func persistToOBS(ctx context.Context, task *model.Task, key string, src mediastore.PersistSource) bool {
	meta := map[string]string{
		"user-id":  strconv.Itoa(task.UserId),
		"task-id":  task.TaskID,
		"model":    task.Properties.OriginModelName,
		"platform": string(task.Platform),
	}
	if err := mediastore.Persist(ctx, key, src, meta); err != nil {
		common.SysError("mediastore: persist task result failed, fallback to raw url: " + err.Error())
		return false
	}
	return true
}

// ResolveResultURL 序列化层统一 hook（§5.4）：obs:// 占位符 → 实时签名 URL；
// 其它原样返回。供 relay / controller 各读取入口复用。
func ResolveResultURL(ctx context.Context, raw string) string {
	return mediastore.ResolveResultURL(ctx, raw)
}

// PersistImageNFSToOBS 把一张成品图（nfs_path）落 OBS 并返回实时签名 URL。
// 用于同步生图链路（/v1/images/generations，无 Task 记录，当场返回 URL）。
// 总开关关闭 / 路径非法 / 落盘失败均返回错误——同步链路必须拿到可访问 URL，不做静默降级。
func PersistImageNFSToOBS(ctx context.Context, userID int, nfsPath string) (string, error) {
	if !mediastore.Enabled() {
		return "", fmt.Errorf("media storage 未启用，无法对外提供生图结果 URL")
	}
	s := system_setting.GetMediaStorageSettings()
	if !s.IngestNFSPath {
		return "", fmt.Errorf("nfs_path 落盘已关闭")
	}
	root := s.NFSRoot()
	if !isUnderRoot(root, nfsPath) {
		return "", fmt.Errorf("nfs_path %q 不在挂载根 %q 之下", nfsPath, root)
	}
	key := mediastore.KeyFromNFSPath(root, nfsPath)
	meta := map[string]string{
		"user-id": strconv.Itoa(userID),
	}
	if err := mediastore.Persist(ctx, key, mediastore.PersistSource{NFSPath: nfsPath}, meta); err != nil {
		return "", fmt.Errorf("落盘 OBS 失败: %w", err)
	}
	return mediastore.Sign(ctx, key)
}

// RewriteImageResponseToOBS 把一份 OpenAI 图片响应里的第三方结果统一搬到 OBS（§一、目标）。
// 逐项 best-effort：url 下载落盘 / b64_json 解码落盘 → 换成我方 OBS 签名 URL。
// 「只有 OBS 不可用时才降级透传」——单项落盘失败则保留该项原始 url（或原 b64），不整体失败。
// 已经是我方 OBS 的 url（如自建 gpustackplus 渠道产出）跳过，不重复搬运。
//
// responseFormat 为客户端请求的 response_format：显式要 b64_json 时不动 b64 项
// （客户端可能无法访问外网 URL，换掉 b64 会直接破坏其解析），仅归档语义放弃。
//
// 改写走 map[string]json.RawMessage 外科手术式替换，只动 data[i].url / data[i].b64_json
// 两个字段——顶层 usage、逐项 revised_prompt 等未建模字段原样保留，不因重编码丢失。
// 返回改写后的响应体；若总开关关闭 / 无可搬项 / 解析失败，原样返回入参。
func RewriteImageResponseToOBS(ctx context.Context, userID int, modelName, responseFormat string, body []byte) []byte {
	if !mediastore.Enabled() || len(body) == 0 {
		return body
	}
	wantB64 := strings.EqualFold(responseFormat, "b64_json")

	var envelope map[string]json.RawMessage
	if err := common.Unmarshal(body, &envelope); err != nil || len(envelope["data"]) == 0 {
		return body
	}
	var items []map[string]json.RawMessage
	if err := common.Unmarshal(envelope["data"], &items); err != nil || len(items) == 0 {
		return body
	}

	changed := false
	for _, item := range items {
		urlStr := jsonRawString(item["url"])
		b64Str := jsonRawString(item["b64_json"])
		switch {
		case urlStr != "":
			if mediastore.IsOwnOBSURL(urlStr) {
				continue // 已是我方 OBS，跳过
			}
			signed, err := persistThirdPartyImage(ctx, userID, modelName, mediastore.PersistSource{UpstreamURL: urlStr}, extFromURL(urlStr))
			if err != nil {
				common.SysError("mediastore: rewrite image url failed, keep upstream url: " + err.Error())
				continue // OBS 不可用 → 降级保留上游 url
			}
			setJSONRawString(item, "url", signed)
			delete(item, "b64_json")
			changed = true
		case b64Str != "":
			if wantB64 {
				continue // 客户端点名要 b64_json，保留原样
			}
			raw, decErr := base64.StdEncoding.DecodeString(b64Str)
			if decErr != nil {
				continue
			}
			signed, err := persistThirdPartyImage(ctx, userID, modelName, mediastore.PersistSource{Data: raw}, "png")
			if err != nil {
				common.SysError("mediastore: rewrite image b64 failed, keep b64: " + err.Error())
				continue
			}
			setJSONRawString(item, "url", signed)
			delete(item, "b64_json")
			changed = true
		}
	}
	if !changed {
		return body
	}
	newData, err := common.Marshal(items)
	if err != nil {
		return body
	}
	envelope["data"] = newData
	out, err := common.Marshal(envelope)
	if err != nil {
		return body
	}
	return out
}

// jsonRawString 从 RawMessage 中取 JSON 字符串值；非字符串/缺失返回空。
func jsonRawString(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var s string
	if err := common.Unmarshal(raw, &s); err != nil {
		return ""
	}
	return s
}

// setJSONRawString 把字符串值编码回 map 字段。
func setJSONRawString(m map[string]json.RawMessage, key, val string) {
	if enc, err := common.Marshal(val); err == nil {
		m[key] = enc
	}
}

// persistThirdPartyImage 为第三方图片构造 Key 并落盘，返回签名 URL。
func persistThirdPartyImage(ctx context.Context, userID int, modelName string, src mediastore.PersistSource, ext string) (string, error) {
	s := system_setting.GetMediaStorageSettings()
	if src.UpstreamURL != "" && !s.IngestUpstreamURL {
		return "", fmt.Errorf("上游 URL 落盘已关闭")
	}
	if ext == "" {
		ext = "png"
	}
	taskID := "img_" + common.GetRandomString(16)
	key := mediastore.BuildKey("t2i", modelName, userID, taskID, ext, time.Now())
	meta := map[string]string{"user-id": strconv.Itoa(userID)}
	if err := mediastore.Persist(ctx, key, src, meta); err != nil {
		return "", err
	}
	return mediastore.Sign(ctx, key)
}

func extFromURL(rawURL string) string {
	ext := strings.TrimPrefix(path.Ext(pathOnly(rawURL)), ".")
	if ext == "" {
		return "png"
	}
	return strings.ToLower(ext)
}

// buildTaskObjectKey 为无 nfs_path 的第三方任务构造 OBS Key（§4.2）。
// feature 取自 task.Action，model 取自 OriginModelName，ext 由 URL 路径推断。
func buildTaskObjectKey(task *model.Task, rawURL string) string {
	feature := task.Action
	if feature == "" {
		feature = "task"
	}
	ext := strings.TrimPrefix(path.Ext(pathOnly(rawURL)), ".")
	return mediastore.BuildKey(feature, task.Properties.OriginModelName,
		task.UserId, task.TaskID, ext, time.Now())
}

// pathOnly 去掉 URL 的 query，便于取扩展名。
func pathOnly(rawURL string) string {
	if i := strings.IndexAny(rawURL, "?#"); i >= 0 {
		return rawURL[:i]
	}
	return rawURL
}
