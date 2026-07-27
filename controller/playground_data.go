package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ---------- Assets ----------

// normalizePlaygroundAssetSource keeps the source filter on the known values;
// anything else is treated as unset so callers cannot inject arbitrary filters.
func normalizePlaygroundAssetSource(raw string) string {
	switch strings.TrimSpace(raw) {
	case model.PlaygroundAssetSourceLibrary:
		return model.PlaygroundAssetSourceLibrary
	case model.PlaygroundAssetSourceAttachment:
		return model.PlaygroundAssetSourceAttachment
	default:
		return ""
	}
}

func UploadPlaygroundAsset(c *gin.Context) {
	userId := c.GetInt("id")
	file, err := c.FormFile("file")
	if err != nil {
		common.ApiErrorMsg(c, "file is required")
		return
	}
	// declared MIME is only a hint — SavePlaygroundAssetFile sniffs content
	declared := file.Header.Get("Content-Type")
	if declared == "" {
		declared = "application/octet-stream"
	}
	// optional kind filter: reject after sniff if kind mismatches (no MIME coercion)
	wantKind := strings.TrimSpace(c.PostForm("kind"))
	source := normalizePlaygroundAssetSource(c.PostForm("source"))
	if source == "" {
		source = model.PlaygroundAssetSourceLibrary
	}

	// pre-check size against largest cap; precise cap applied after kind sniff
	if file.Size > service.PlaygroundAssetMaxVideoBytes {
		common.ApiErrorMsg(c, fmt.Sprintf("file exceeds size limit (%d bytes)", service.PlaygroundAssetMaxVideoBytes))
		return
	}
	src, err := file.Open()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	defer src.Close()

	storageKey, backend, mimeType, kind, err := service.SavePlaygroundAssetFile(userId, file.Filename, declared, src, file.Size)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if wantKind != "" && wantKind != kind {
		service.DeletePlaygroundAssetFile(backend, storageKey)
		common.ApiErrorMsg(c, "file kind does not match requested kind")
		return
	}
	asset := &model.PlaygroundAsset{
		UserId:     userId,
		Kind:       kind,
		Source:     source,
		Name:       filepath.Base(file.Filename),
		StorageKey: storageKey,
		Backend:    backend,
		Mime:       mimeType,
		Size:       file.Size,
	}
	if err := model.CreatePlaygroundAsset(asset); err != nil {
		service.DeletePlaygroundAssetFile(backend, storageKey)
		common.ApiError(c, err)
		return
	}
	asset.URL = playgroundAssetContentURL(asset.Id)
	_ = model.DB.Model(asset).Update("url", asset.URL).Error
	common.ApiSuccess(c, model.PublicPlaygroundAssetDTO(asset))
}

func ImportPlaygroundAsset(c *gin.Context) {
	userId := c.GetInt("id")
	var body struct {
		SourceURL string `json:"source_url"`
		Kind      string `json:"kind"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiError(c, err)
		return
	}
	body.Kind = strings.TrimSpace(body.Kind)
	if body.Kind != "image" && body.Kind != "video" && body.Kind != "audio" {
		common.ApiErrorMsg(c, "invalid asset kind")
		return
	}
	body.SourceURL = strings.TrimSpace(body.SourceURL)
	parsedSource, err := url.Parse(body.SourceURL)
	if err != nil || len(body.SourceURL) > 8192 || parsedSource.Host == "" ||
		(parsedSource.Scheme != "http" && parsedSource.Scheme != "https") {
		common.ApiErrorMsg(c, "invalid source URL")
		return
	}
	asset, err := service.PersistPlaygroundOutput(c.Request.Context(), userId, body.Kind, body.SourceURL)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if asset == nil {
		common.ApiErrorMsg(c, "source URL is not persistable")
		return
	}
	asset.URL = playgroundAssetContentURL(asset.Id)
	if err := model.DB.Model(asset).Update("url", asset.URL).Error; err != nil {
		service.DeletePlaygroundAssetFile(asset.Backend, asset.StorageKey)
		_ = model.DeletePlaygroundAsset(asset.Id, userId)
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, model.PublicPlaygroundAssetDTO(asset))
}

func ListPlaygroundAssets(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	kind := strings.TrimSpace(c.Query("kind"))
	source := normalizePlaygroundAssetSource(c.Query("source"))
	items, total, err := model.ListPlaygroundAssets(userId, kind, source, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	out := make([]map[string]any, 0, len(items))
	for i := range items {
		if items[i].URL == "" {
			items[i].URL = playgroundAssetContentURL(items[i].Id)
		}
		out = append(out, model.PublicPlaygroundAssetDTO(&items[i]))
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(out)
	common.ApiSuccess(c, pageInfo)
}

func DeletePlaygroundAsset(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	asset, err := model.GetPlaygroundAsset(id, userId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "asset not found")
			return
		}
		common.ApiError(c, err)
		return
	}
	if err := model.DeletePlaygroundAsset(id, userId); err != nil {
		common.ApiError(c, err)
		return
	}
	service.DeletePlaygroundAssetFile(asset.Backend, asset.StorageKey)
	service.UnpublishPlaygroundAssetObject(c.Request.Context(), asset.Backend, asset.PublicKey)
	common.ApiSuccess(c, nil)
}

// PublishPlaygroundAsset copies an asset to the public CDN prefix and marks it
// public, returning the updated asset.
func PublishPlaygroundAsset(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	asset, err := model.GetPlaygroundAsset(id, userId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "asset not found")
			return
		}
		common.ApiError(c, err)
		return
	}
	publicKey, publicURL, err := service.PublishPlaygroundAssetObject(c.Request.Context(), userId, asset.Backend, asset.StorageKey, asset.Mime, asset.Size)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SetPlaygroundAssetVisibility(id, userId, "public", publicKey, publicURL); err != nil {
		service.UnpublishPlaygroundAssetObject(c.Request.Context(), asset.Backend, publicKey)
		common.ApiError(c, err)
		return
	}
	asset.Visibility = "public"
	asset.PublicKey = publicKey
	asset.PublicURL = publicURL
	common.ApiSuccess(c, model.PublicPlaygroundAssetDTO(asset))
}

// UnpublishPlaygroundAsset removes the public copy and marks the asset private.
func UnpublishPlaygroundAsset(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	asset, err := model.GetPlaygroundAsset(id, userId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "asset not found")
			return
		}
		common.ApiError(c, err)
		return
	}
	service.UnpublishPlaygroundAssetObject(c.Request.Context(), asset.Backend, asset.PublicKey)
	if err := model.SetPlaygroundAssetVisibility(id, userId, "private", "", ""); err != nil {
		common.ApiError(c, err)
		return
	}
	asset.Visibility = "private"
	asset.PublicKey = ""
	asset.PublicURL = ""
	common.ApiSuccess(c, model.PublicPlaygroundAssetDTO(asset))
}

// BackfillPlaygroundAssetsToR2 migrates local-backend assets to R2 (admin only).
// Query params: limit (0 = all), dry_run (true reports candidates only).
func BackfillPlaygroundAssetsToR2(c *gin.Context) {
	limit := 0
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	dryRun := c.Query("dry_run") == "true" || c.Query("dry_run") == "1"
	result, err := service.BackfillPlaygroundAssetsToR2(c.Request.Context(), limit, dryRun)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

func GetPlaygroundAssetContent(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.Status(http.StatusBadRequest)
		return
	}
	asset, err := model.GetPlaygroundAsset(id, userId)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	// Always stream same-origin (no R2 presign 302). Private objects stay
	// behind user auth; browser fetch/download never crosses origins.
	forceDownload := c.Query("download") == "1"
	body, err := service.OpenPlaygroundAssetContentDirect(c.Request.Context(), asset.Backend, asset.StorageKey)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	defer body.Close()
	if asset.Mime != "" {
		c.Header("Content-Type", asset.Mime)
	}
	c.Header("X-Content-Type-Options", "nosniff")
	// Allow credentialed same-origin clients; harmless if unused.
	if origin := c.GetHeader("Origin"); origin != "" && isPlaygroundAllowedOrigin(origin) {
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Vary", "Origin")
		c.Header("Access-Control-Expose-Headers", "Content-Type, Content-Length, Content-Disposition")
	}
	// Documents are only ever fetched as bytes, never previewed in a frame, so
	// they never render inline on our own origin.
	if forceDownload || asset.Kind == "document" {
		name := asset.Name
		if name == "" {
			name = "download"
		}
		c.Header("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": filepath.Base(name)}))
		if forceDownload {
			c.Header("Cache-Control", "private, no-store")
		} else {
			c.Header("Cache-Control", "private, max-age=3600")
		}
	} else {
		c.Header("Cache-Control", "private, max-age=3600")
	}
	c.Status(http.StatusOK)
	if _, err := io.Copy(c.Writer, body); err != nil {
		common.SysError("stream playground asset: " + err.Error())
	}
}

// isPlaygroundAllowedOrigin gates CORS reflections for playground media.
// Same-site app origins only — never reflect arbitrary Origin headers.
func isPlaygroundAllowedOrigin(origin string) bool {
	switch strings.ToLower(strings.TrimSpace(origin)) {
	case "https://you-box.com", "https://www.you-box.com":
		return true
	default:
		// Local / orb dev hosts (http loopback only).
		if strings.HasPrefix(origin, "http://127.0.0.1:") ||
			strings.HasPrefix(origin, "http://localhost:") {
			return true
		}
		return false
	}
}

func playgroundAssetContentURL(id int) string {
	if id <= 0 {
		return ""
	}
	return fmt.Sprintf("/api/playground/assets/%d/content", id)
}

// ---------- Upload session (QR-friendly) ----------

func CreatePlaygroundUploadSession(c *gin.Context) {
	userId := c.GetInt("id")
	kind := strings.TrimSpace(c.PostForm("kind"))
	if kind == "" {
		var body struct {
			Kind string `json:"kind"`
		}
		_ = c.ShouldBindJSON(&body)
		kind = body.Kind
	}
	token := strings.ReplaceAll(uuid.New().String(), "-", "")
	s := &model.PlaygroundUploadSession{
		UserId:    userId,
		Token:     token,
		Kind:      kind,
		ExpiresAt: time.Now().Add(15 * time.Minute).Unix(),
	}
	if err := model.CreatePlaygroundUploadSession(s); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"token":      s.Token,
		"expires_at": s.ExpiresAt,
		"upload_url": "/api/playground/upload-sessions/" + s.Token + "/file",
	})
}

func GetPlaygroundUploadSession(c *gin.Context) {
	userId := c.GetInt("id")
	token := c.Param("token")
	s, err := model.GetPlaygroundUploadSessionByToken(token)
	if err != nil {
		common.ApiErrorMsg(c, "session not found")
		return
	}
	// Owner-only status poll (phone uses unauthenticated POST /file with token)
	if s.UserId != userId {
		common.ApiErrorMsg(c, "session not found")
		return
	}
	if s.ExpiresAt < time.Now().Unix() && s.AssetId == 0 {
		common.ApiErrorMsg(c, "session expired")
		return
	}
	var assetDTO map[string]any
	if s.AssetId > 0 {
		asset, _ := model.GetPlaygroundAssetById(s.AssetId)
		if asset != nil {
			if asset.URL == "" {
				asset.URL = playgroundAssetContentURL(asset.Id)
			}
			// only return asset to the owning user (already checked)
			if asset.UserId == userId {
				assetDTO = model.PublicPlaygroundAssetDTO(asset)
			}
		}
	}
	common.ApiSuccess(c, gin.H{
		"token":      s.Token,
		"expires_at": s.ExpiresAt,
		"asset_id":   s.AssetId,
		"asset":      assetDTO,
	})
}

func UploadPlaygroundUploadSessionFile(c *gin.Context) {
	token := c.Param("token")
	s, err := model.GetPlaygroundUploadSessionByToken(token)
	if err != nil {
		common.ApiErrorMsg(c, "session not found")
		return
	}
	if s.AssetId != 0 {
		common.ApiErrorMsg(c, "session already used")
		return
	}
	if s.ExpiresAt < time.Now().Unix() {
		common.ApiErrorMsg(c, "session expired")
		return
	}
	file, err := c.FormFile("file")
	if err != nil {
		common.ApiErrorMsg(c, "file is required")
		return
	}
	declared := file.Header.Get("Content-Type")
	if declared == "" {
		declared = "application/octet-stream"
	}
	if file.Size > service.PlaygroundAssetMaxVideoBytes {
		common.ApiErrorMsg(c, fmt.Sprintf("file exceeds size limit (%d bytes)", service.PlaygroundAssetMaxVideoBytes))
		return
	}
	src, err := file.Open()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	defer src.Close()
	storageKey, backend, mimeType, kind, err := service.SavePlaygroundAssetFile(s.UserId, file.Filename, declared, src, file.Size)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if s.Kind != "" && s.Kind != kind {
		service.DeletePlaygroundAssetFile(backend, storageKey)
		common.ApiErrorMsg(c, "file kind does not match session")
		return
	}
	asset := &model.PlaygroundAsset{
		UserId:     s.UserId,
		Kind:       kind,
		Name:       filepath.Base(file.Filename),
		StorageKey: storageKey,
		Backend:    backend,
		Mime:       mimeType,
		Size:       file.Size,
	}
	if err := model.CreatePlaygroundAsset(asset); err != nil {
		service.DeletePlaygroundAssetFile(backend, storageKey)
		common.ApiError(c, err)
		return
	}
	asset.URL = playgroundAssetContentURL(asset.Id)
	_ = model.DB.Model(asset).Update("url", asset.URL).Error
	ok, err := model.CompletePlaygroundUploadSession(s.Id, asset.Id)
	if err != nil {
		// asset already created; still report success-ish but log
		common.SysError("complete upload session: " + err.Error())
	}
	if !ok {
		// race: another upload completed first — leave orphan is bad; delete our asset
		_ = model.DeletePlaygroundAsset(asset.Id, s.UserId)
		service.DeletePlaygroundAssetFile(backend, storageKey)
		common.ApiErrorMsg(c, "session already used")
		return
	}
	common.ApiSuccess(c, model.PublicPlaygroundAssetDTO(asset))
}

// ---------- Estimate ----------

func PlaygroundEstimate(c *gin.Context) {
	var req service.PlaygroundEstimateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	result := service.EstimatePlaygroundCost(req)
	common.ApiSuccess(c, result)
}

// ---------- Conversations ----------

func ListPlaygroundConversations(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.ListPlaygroundConversations(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func CreatePlaygroundConversation(c *gin.Context) {
	userId := c.GetInt("id")
	var body struct {
		Title    string          `json:"title"`
		Model    string          `json:"model"`
		Group    string          `json:"group"`
		Kind     string          `json:"kind"`
		MetaJson json.RawMessage `json:"meta_json"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiError(c, err)
		return
	}
	title := strings.TrimSpace(body.Title)
	if title == "" {
		title = "New chat"
	}
	title = truncateRunes(title, 200)
	kind := strings.TrimSpace(body.Kind)
	if kind == "" {
		kind = "chat"
	}
	if kind != "chat" && kind != "duo" {
		common.ApiErrorMsg(c, "invalid kind")
		return
	}
	metaJson := ""
	if len(body.MetaJson) > 0 && string(body.MetaJson) != "null" {
		if len(body.MetaJson) > 20_000 {
			common.ApiErrorMsg(c, "meta_json too large")
			return
		}
		var probe any
		if err := common.Unmarshal(body.MetaJson, &probe); err != nil {
			common.ApiErrorMsg(c, "invalid meta_json")
			return
		}
		metaJson = string(body.MetaJson)
	}
	conv := &model.PlaygroundConversation{
		UserId:   userId,
		Title:    title,
		Model:    body.Model,
		Group:    body.Group,
		Kind:     kind,
		MetaJson: metaJson,
	}
	if err := model.CreatePlaygroundConversation(conv); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, conv)
}

func GetPlaygroundConversation(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	conv, err := model.GetPlaygroundConversation(id, userId)
	if err != nil {
		common.ApiErrorMsg(c, "conversation not found")
		return
	}
	messages, err := model.ListPlaygroundMessages(id, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"conversation": conv,
		"messages":     messages,
	})
}

func UpdatePlaygroundConversation(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	conv, err := model.GetPlaygroundConversation(id, userId)
	if err != nil {
		common.ApiErrorMsg(c, "conversation not found")
		return
	}
	var body struct {
		Title    *string         `json:"title"`
		Model    *string         `json:"model"`
		Group    *string         `json:"group"`
		Kind     *string         `json:"kind"`
		MetaJson json.RawMessage `json:"meta_json"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiError(c, err)
		return
	}
	if body.Title != nil {
		conv.Title = truncateRunes(strings.TrimSpace(*body.Title), 200)
	}
	if body.Model != nil {
		conv.Model = *body.Model
	}
	if body.Group != nil {
		conv.Group = *body.Group
	}
	if body.Kind != nil {
		kind := strings.TrimSpace(*body.Kind)
		if kind != "" && kind != "chat" && kind != "duo" {
			common.ApiErrorMsg(c, "invalid kind")
			return
		}
		if kind == "" {
			kind = "chat"
		}
		conv.Kind = kind
	}
	if len(body.MetaJson) > 0 && string(body.MetaJson) != "null" {
		if len(body.MetaJson) > 20_000 {
			common.ApiErrorMsg(c, "meta_json too large")
			return
		}
		var probe any
		if err := common.Unmarshal(body.MetaJson, &probe); err != nil {
			common.ApiErrorMsg(c, "invalid meta_json")
			return
		}
		conv.MetaJson = string(body.MetaJson)
	}
	if err := model.UpdatePlaygroundConversation(conv); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, conv)
}

func DeletePlaygroundConversation(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	if err := model.DeletePlaygroundConversation(id, userId); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "conversation not found")
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func PutPlaygroundConversationMessages(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	var body struct {
		Messages []struct {
			Role        string          `json:"role"`
			Content     string          `json:"content"`
			ContentJson json.RawMessage `json:"content_json"`
			Model       string          `json:"model"`
			ToolJson    json.RawMessage `json:"tool_json"`
			ClientKey   string          `json:"client_key"`
			CreatedAt   int64           `json:"created_at"`
		} `json:"messages"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiError(c, err)
		return
	}
	if len(body.Messages) > 500 {
		common.ApiErrorMsg(c, "too many messages (max 500)")
		return
	}
	msgs := make([]model.PlaygroundMessage, 0, len(body.Messages))
	for _, m := range body.Messages {
		role := strings.TrimSpace(m.Role)
		if role != "user" && role != "assistant" && role != "system" {
			continue
		}
		// longtext column: cap at 200k runes (not MySQL 64KB TEXT)
		content := truncateRunes(m.Content, 200_000)
		contentJson := ""
		if len(m.ContentJson) > 0 && string(m.ContentJson) != "null" {
			raw := string(m.ContentJson)
			if len(raw) > 400_000 {
				common.ApiErrorMsg(c, "content_json too large")
				return
			}
			var parts []map[string]any
			if err := common.Unmarshal(m.ContentJson, &parts); err != nil {
				common.ApiErrorMsg(c, "invalid content_json")
				return
			}
			contentJson = raw
		}
		toolJson := ""
		if len(m.ToolJson) > 0 && string(m.ToolJson) != "null" {
			raw := string(m.ToolJson)
			if len(raw) > 100_000 {
				common.ApiErrorMsg(c, "tool_json too large")
				return
			}
			var probe any
			if err := common.Unmarshal(m.ToolJson, &probe); err != nil {
				common.ApiErrorMsg(c, "invalid tool_json")
				return
			}
			toolJson = raw
		}
		clientKey := strings.TrimSpace(m.ClientKey)
		if len(clientKey) > 64 {
			clientKey = clientKey[:64]
		}
		modelName := truncateRunes(strings.TrimSpace(m.Model), 191)
		msg := model.PlaygroundMessage{
			Role:        role,
			Content:     content,
			ContentJson: contentJson,
			Model:       modelName,
			ToolJson:    toolJson,
			ClientKey:   clientKey,
		}
		if m.CreatedAt > 0 {
			msg.CreatedAt = m.CreatedAt
		}
		msgs = append(msgs, msg)
	}
	if err := model.ReplacePlaygroundMessages(id, userId, msgs); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "conversation not found")
			return
		}
		common.ApiError(c, err)
		return
	}
	// auto-title from first user message when still default
	if conv, err := model.GetPlaygroundConversation(id, userId); err == nil && (conv.Title == "" || conv.Title == "New chat") {
		for _, m := range msgs {
			if m.Role == "user" && strings.TrimSpace(m.Content) != "" {
				conv.Title = truncateRunes(strings.TrimSpace(m.Content), 48)
				_ = model.UpdatePlaygroundConversation(conv)
				break
			}
		}
	}
	common.ApiSuccess(c, gin.H{"count": len(msgs)})
}

// ---------- Personas ----------

func ListPlaygroundPersonas(c *gin.Context) {
	userId := c.GetInt("id")
	items, err := model.ListPlaygroundPersonas(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}

func CreatePlaygroundPersona(c *gin.Context) {
	userId := c.GetInt("id")
	var body struct {
		Name         string `json:"name"`
		SystemPrompt string `json:"system_prompt"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiError(c, err)
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		common.ApiErrorMsg(c, "name is required")
		return
	}
	name = truncateRunes(name, 128)
	prompt := truncateRunes(body.SystemPrompt, 8000)
	p := &model.PlaygroundPersona{
		UserId:       userId,
		Name:         name,
		SystemPrompt: prompt,
	}
	if err := model.CreatePlaygroundPersona(p); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, p)
}

func UpdatePlaygroundPersona(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	p, err := model.GetPlaygroundPersona(id, userId)
	if err != nil {
		common.ApiErrorMsg(c, "persona not found")
		return
	}
	var body struct {
		Name         *string `json:"name"`
		SystemPrompt *string `json:"system_prompt"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiError(c, err)
		return
	}
	if body.Name != nil {
		name := strings.TrimSpace(*body.Name)
		if name == "" {
			common.ApiErrorMsg(c, "name is required")
			return
		}
		p.Name = truncateRunes(name, 128)
	}
	if body.SystemPrompt != nil {
		p.SystemPrompt = truncateRunes(*body.SystemPrompt, 8000)
	}
	if err := model.UpdatePlaygroundPersona(p); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, p)
}

func DeletePlaygroundPersona(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	if err := model.DeletePlaygroundPersona(id, userId); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "persona not found")
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// ---------- Studio projects ----------

func ListPlaygroundProjects(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	modality := strings.TrimSpace(c.Query("modality"))
	if modality != "" && modality != "image" && modality != "video" && modality != "audio" {
		common.ApiErrorMsg(c, "invalid modality")
		return
	}
	items, total, err := model.ListPlaygroundProjects(userId, modality, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func CreatePlaygroundProject(c *gin.Context) {
	userId := c.GetInt("id")
	var body struct {
		Modality    string   `json:"modality"`
		Title       string   `json:"title"`
		Model       string   `json:"model"`
		Group       string   `json:"group"`
		ClientKey   string   `json:"client_key"`
		LastPrompt  string   `json:"last_prompt"`
		PreviewURLs []string `json:"preview_urls"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiError(c, err)
		return
	}
	mod := strings.TrimSpace(body.Modality)
	if mod != "image" && mod != "video" && mod != "audio" {
		common.ApiErrorMsg(c, "invalid modality")
		return
	}
	clientKey := strings.TrimSpace(body.ClientKey)
	if len(clientKey) > 64 {
		clientKey = clientKey[:64]
	}
	// Idempotent create by client_key when provided.
	if clientKey != "" {
		if existing, err := model.GetPlaygroundProjectByClientKey(userId, clientKey); err == nil {
			common.ApiSuccess(c, existing)
			return
		}
	}
	title := strings.TrimSpace(body.Title)
	if title == "" {
		title = "Untitled project"
	}
	title = truncateRunes(title, 200)
	previewJSON := ""
	if len(body.PreviewURLs) > 0 {
		urls := make([]string, 0, len(body.PreviewURLs))
		for _, u := range body.PreviewURLs {
			safe := allowlistedResultURL(strings.TrimSpace(u))
			if safe == "" {
				continue
			}
			urls = append(urls, safe)
			if len(urls) >= 12 {
				break
			}
		}
		if len(urls) > 0 {
			if raw, err := common.Marshal(urls); err == nil {
				previewJSON = string(raw)
			}
		}
	}
	p := &model.PlaygroundProject{
		UserId:      userId,
		Modality:    mod,
		Title:       title,
		Model:       truncateRunes(strings.TrimSpace(body.Model), 191),
		Group:       truncateRunes(strings.TrimSpace(body.Group), 50),
		ClientKey:   clientKey,
		LastPrompt:  truncateRunes(body.LastPrompt, 4000),
		PreviewURLs: previewJSON,
	}
	if err := model.CreatePlaygroundProject(p); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, p)
}

func GetPlaygroundProject(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	p, err := model.GetPlaygroundProject(id, userId)
	if err != nil {
		common.ApiErrorMsg(c, "project not found")
		return
	}
	runs, err := model.ListPlaygroundRunsByProject(userId, id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"project": p,
		"runs":    runs,
	})
}

func UpdatePlaygroundProject(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	p, err := model.GetPlaygroundProject(id, userId)
	if err != nil {
		common.ApiErrorMsg(c, "project not found")
		return
	}
	var body struct {
		Title       *string  `json:"title"`
		Model       *string  `json:"model"`
		Group       *string  `json:"group"`
		LastPrompt  *string  `json:"last_prompt"`
		PreviewURLs []string `json:"preview_urls"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiError(c, err)
		return
	}
	if body.Title != nil {
		p.Title = truncateRunes(strings.TrimSpace(*body.Title), 200)
	}
	if body.Model != nil {
		p.Model = truncateRunes(strings.TrimSpace(*body.Model), 191)
	}
	if body.Group != nil {
		p.Group = truncateRunes(strings.TrimSpace(*body.Group), 50)
	}
	if body.LastPrompt != nil {
		p.LastPrompt = truncateRunes(*body.LastPrompt, 4000)
	}
	if body.PreviewURLs != nil {
		urls := make([]string, 0, len(body.PreviewURLs))
		for _, u := range body.PreviewURLs {
			safe := allowlistedResultURL(strings.TrimSpace(u))
			if safe == "" {
				continue
			}
			urls = append(urls, safe)
			if len(urls) >= 12 {
				break
			}
		}
		if len(urls) == 0 {
			p.PreviewURLs = ""
		} else if raw, err := common.Marshal(urls); err == nil {
			p.PreviewURLs = string(raw)
		}
	}
	if err := model.UpdatePlaygroundProject(p); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, p)
}

func DeletePlaygroundProject(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	if err := model.DeletePlaygroundProject(id, userId); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "project not found")
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// ---------- Tasks / works timeline ----------

func ListPlaygroundTasks(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	queryParams := model.SyncTaskQueryParams{}
	tasks := model.TaskGetAllUserTask(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), queryParams)
	taskTotal := model.TaskCountAllUserTask(userId, queryParams)
	taskDtos := tasksToDto(tasks, false)

	modality := strings.TrimSpace(c.Query("modality"))
	runs, runTotal, _ := model.ListPlaygroundRuns(userId, modality, pageInfo.GetStartIdx(), pageInfo.GetPageSize())

	common.ApiSuccess(c, gin.H{
		"tasks":      taskDtos,
		"runs":       runs,
		"task_total": taskTotal,
		"run_total":  runTotal,
		// Prefer task_total/run_total; total kept as task_total for older clients.
		"total": taskTotal,
	})
}

func CreatePlaygroundRun(c *gin.Context) {
	userId := c.GetInt("id")
	var body struct {
		Modality  string `json:"modality"`
		Model     string `json:"model"`
		Prompt    string `json:"prompt"`
		ResultURL string `json:"result_url"`
		AssetId   int    `json:"asset_id"`
		ProjectId int    `json:"project_id"`
		// Quota from client is ignored — runs are not a billing ledger
		Quota  int    `json:"quota"`
		TaskId string `json:"task_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiError(c, err)
		return
	}
	mod := strings.TrimSpace(body.Modality)
	switch mod {
	case "image", "video", "audio", "chat":
	default:
		common.ApiErrorMsg(c, "invalid modality")
		return
	}
	prompt := truncateRunes(body.Prompt, 4000)
	resultURL := allowlistedResultURL(body.ResultURL)
	assetId := body.AssetId
	if assetId < 0 {
		common.ApiErrorMsg(c, "invalid asset id")
		return
	}
	projectId := body.ProjectId
	if projectId < 0 {
		common.ApiErrorMsg(c, "invalid project id")
		return
	}
	if projectId > 0 {
		p, err := model.GetPlaygroundProject(projectId, userId)
		if err != nil {
			common.ApiErrorMsg(c, "project not found")
			return
		}
		if mod != "chat" && p.Modality != mod {
			common.ApiErrorMsg(c, "project modality does not match run")
			return
		}
	}
	taskId := strings.TrimSpace(body.TaskId)
	if len(taskId) > 191 {
		taskId = taskId[:191]
	}
	completedVideoURL := ""
	switch mod {
	case "image", "audio":
		if assetId == 0 || taskId != "" {
			common.ApiErrorMsg(c, "exactly one matching asset is required for media run")
			return
		}
		asset, err := model.GetPlaygroundAsset(assetId, userId)
		if err != nil {
			common.ApiErrorMsg(c, "asset not found")
			return
		}
		if asset.Kind != mod {
			common.ApiErrorMsg(c, "asset kind does not match run modality")
			return
		}
		resultURL = playgroundAssetContentURL(asset.Id)
	case "video":
		if assetId != 0 || taskId == "" {
			common.ApiErrorMsg(c, "exactly one video task is required for video run")
			return
		}
		task, exists, err := model.GetByTaskId(userId, taskId)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if !exists {
			common.ApiErrorMsg(c, "task not found")
			return
		}
		if task.Platform == "" || task.Platform == constant.TaskPlatformSuno || task.Platform == constant.TaskPlatformMidjourney {
			common.ApiErrorMsg(c, "task is not a video task")
			return
		}
		if task.Status == model.TaskStatusSuccess {
			completedVideoURL = task.GetResultURL()
		}
		resultURL = ""
	case "chat":
		if assetId != 0 || taskId != "" {
			common.ApiErrorMsg(c, "chat run cannot reference media")
			return
		}
	}
	if len(resultURL) > 1000 {
		resultURL = resultURL[:1000]
	}
	run := &model.PlaygroundRun{
		UserId:    userId,
		ProjectId: projectId,
		Modality:  mod,
		AssetId:   assetId,
		Model:     body.Model,
		Prompt:    prompt,
		ResultURL: resultURL,
		Quota:     0, // never trust client-supplied quota
		TaskId:    taskId,
	}
	if err := model.CreatePlaygroundRun(run); err != nil {
		common.ApiError(c, err)
		return
	}
	// Touch parent project so history sorts by latest activity.
	if projectId > 0 {
		if p, err := model.GetPlaygroundProject(projectId, userId); err == nil {
			if prompt != "" {
				p.LastPrompt = prompt
			}
			if body.Model != "" {
				p.Model = body.Model
			}
			if resultURL != "" {
				var urls []string
				if p.PreviewURLs != "" {
					_ = common.UnmarshalJsonStr(p.PreviewURLs, &urls)
				}
				urls = append(urls, resultURL)
				if len(urls) > 12 {
					urls = urls[len(urls)-12:]
				}
				if raw, err := common.Marshal(urls); err == nil {
					p.PreviewURLs = string(raw)
				}
			}
			_ = model.UpdatePlaygroundProject(p)
		}
	}
	if completedVideoURL != "" {
		service.QueuePlaygroundVideoOutputReconciliation(taskId, userId, completedVideoURL)
	}
	common.ApiSuccess(c, run)
}

func ListPlaygroundAgents(c *gin.Context) {
	items, err := model.ListPlaygroundAgents()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}

// ---------- Voices ----------

func ListPlaygroundVoices(c *gin.Context) {
	userId := c.GetInt("id")
	items, err := model.ListPlaygroundVoices(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}

func CreatePlaygroundVoice(c *gin.Context) {
	userId := c.GetInt("id")
	name := strings.TrimSpace(c.PostForm("name"))
	if name == "" {
		name = "Voice"
	}
	name = truncateRunes(name, 128)
	file, err := c.FormFile("file")
	if err != nil {
		common.ApiErrorMsg(c, "reference audio file is required")
		return
	}
	if file.Size > service.PlaygroundAssetMaxAudioBytes {
		common.ApiErrorMsg(c, "audio exceeds size limit")
		return
	}
	declared := file.Header.Get("Content-Type")
	if declared == "" {
		declared = "application/octet-stream"
	}
	src, err := file.Open()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	defer src.Close()
	storageKey, backend, mimeType, kind, err := service.SavePlaygroundAssetFile(userId, file.Filename, declared, src, file.Size)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if kind != "audio" {
		service.DeletePlaygroundAssetFile(backend, storageKey)
		common.ApiErrorMsg(c, "audio file required")
		return
	}
	asset := &model.PlaygroundAsset{
		UserId:     userId,
		Kind:       "audio",
		Name:       filepath.Base(file.Filename),
		StorageKey: storageKey,
		Backend:    backend,
		Mime:       mimeType,
		Size:       file.Size,
	}
	if err := model.CreatePlaygroundAsset(asset); err != nil {
		service.DeletePlaygroundAssetFile(backend, storageKey)
		common.ApiError(c, err)
		return
	}
	asset.URL = playgroundAssetContentURL(asset.Id)
	_ = model.DB.Model(asset).Update("url", asset.URL).Error

	voice := &model.PlaygroundVoice{
		UserId:  userId,
		Name:    name,
		AssetId: asset.Id,
		Status:  "pending_provider",
	}
	if err := model.CreatePlaygroundVoice(voice); err != nil {
		_ = model.DeletePlaygroundAsset(asset.Id, userId)
		service.DeletePlaygroundAssetFile(backend, storageKey)
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"voice":  voice,
		"asset":  model.PublicPlaygroundAssetDTO(asset),
		"status": voice.Status,
		"note":   "Upstream voice-clone provider is not configured; voice stored as pending_provider. See docs/playground-p1-p3.md",
	})
}

func DeletePlaygroundVoice(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	if err := model.DeletePlaygroundVoice(id, userId); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "voice not found")
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// ---------- Skill kit ----------

func GetPlaygroundSkill(c *gin.Context) {
	base := strings.TrimRight(common.GetEnvOrDefaultString("SERVER_ADDRESS", ""), "/")
	if base == "" {
		// best-effort from request
		scheme := "https"
		if c.Request.TLS == nil {
			scheme = "http"
		}
		// honor reverse-proxy headers lightly
		if proto := c.GetHeader("X-Forwarded-Proto"); proto != "" {
			scheme = proto
		}
		host := c.Request.Host
		if host != "" {
			base = scheme + "://" + host
		} else {
			base = "https://your-box.example"
		}
	}
	md := fmt.Sprintf(`# Box AI Playground Skill Kit

Base URL: %s

## Auth
- Session cookie (web playground), or
- API key: Authorization: Bearer sk-...

## Endpoints

### Chat
POST %s/v1/chat/completions
POST %s/pg/chat/completions  (session auth)

### Images
POST %s/v1/images/generations
POST %s/pg/images/generations
POST %s/pg/images/edits

### Video
POST %s/pg/video/generations
Body may include first_frame, last_frame, input_reference, images[]

### Audio
POST %s/pg/audio/speech

### Playground data
GET/POST %s/api/playground/assets
POST %s/api/playground/estimate
GET/POST %s/api/playground/conversations
GET/POST %s/api/playground/personas
GET %s/api/playground/inspiration/templates
GET %s/api/playground/skill

Configure models/channels in the admin console. See docs/playground-p1-p3.md.
`, base, base, base, base, base, base, base, base, base, base, base, base, base, base)

	format := c.Query("format")
	if format == "json" {
		common.ApiSuccess(c, gin.H{"markdown": md, "base_url": base})
		return
	}
	c.Header("Content-Type", "text/markdown; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=\"SKILL.md\"")
	c.String(http.StatusOK, md)
}
