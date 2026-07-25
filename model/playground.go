package model

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// PlaygroundAsset stores user-owned media for the playground workbench.
type PlaygroundAsset struct {
	Id         int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId     int    `json:"user_id" gorm:"not null;index"`
	Kind       string `json:"kind" gorm:"type:varchar(20);not null;index"` // image | video | audio
	Name       string `json:"name" gorm:"type:varchar(255)"`
	StorageKey string `json:"storage_key" gorm:"type:varchar(512);not null"`
	Backend    string `json:"backend" gorm:"type:varchar(16)"`    // local | r2 (empty = local, legacy)
	Visibility string `json:"visibility" gorm:"type:varchar(16)"` // private (default) | public
	PublicKey  string `json:"public_key" gorm:"type:varchar(512)"`
	PublicURL  string `json:"public_url" gorm:"type:varchar(1024)"`
	URL        string `json:"url" gorm:"type:varchar(1024)"` // public or app-relative URL
	Mime       string `json:"mime" gorm:"type:varchar(128)"`
	Size       int64  `json:"size"`
	CreatedAt  int64  `json:"created_at" gorm:"bigint;index"`
}

func (PlaygroundAsset) TableName() string { return "playground_assets" }

// PlaygroundConversation is a cloud-synced chat or duo session.
// Kind: "chat" (default) | "duo". Empty kind is treated as chat for legacy rows.
type PlaygroundConversation struct {
	Id     int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId int    `json:"user_id" gorm:"not null;index"`
	Title  string `json:"title" gorm:"type:varchar(255)"`
	// Engine selected for the *next* turn (not per-turn history).
	Model string `json:"model" gorm:"type:varchar(191)"`
	Group string `json:"group" gorm:"type:varchar(50)"`
	// Kind distinguishes plain chat threads from multi-model (duo) sessions.
	Kind string `json:"kind" gorm:"type:varchar(20);index"` // chat | duo
	// MetaJson stores kind-specific config (e.g. duo answer/summary models).
	MetaJson  string `json:"meta_json" gorm:"type:text"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt int64  `json:"updated_at" gorm:"bigint;index"`
}

func (PlaygroundConversation) TableName() string { return "playground_conversations" }

// PlaygroundMessage is a single turn in a conversation (normalized).
type PlaygroundMessage struct {
	Id             int    `json:"id" gorm:"primaryKey;autoIncrement"`
	ConversationId int    `json:"conversation_id" gorm:"not null;index"`
	UserId         int    `json:"user_id" gorm:"not null;index"`
	Role           string `json:"role" gorm:"type:varchar(32);not null"` // user | assistant | system
	// type:text is portable across SQLite / MySQL / PostgreSQL.
	// (MySQL TEXT is 64KB; large messages are also capped in the API layer.)
	// Do NOT use longtext — PostgreSQL rejects it (SQLSTATE 42704).
	Content string `json:"content" gorm:"type:text"`
	// ContentJson holds structured multimodal parts (OpenAI-style content array,
	// e.g. text + image_url) when a message carries more than plain text. Empty
	// for legacy/plain-text messages, in which case Content is authoritative.
	ContentJson string `json:"content_json" gorm:"type:text"`
	// Model is the engine that produced this turn (assistant) or the active
	// engine at send time (user). Empty on legacy rows.
	Model string `json:"model" gorm:"type:varchar(191)"`
	// ToolJson stores managed-tool card / source metadata for the turn.
	ToolJson string `json:"tool_json" gorm:"type:text"`
	// ClientKey is the frontend message key used for idempotent merge.
	ClientKey string `json:"client_key" gorm:"type:varchar(64)"`
	Seq       int    `json:"seq" gorm:"not null;index"`
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
}

func (PlaygroundMessage) TableName() string { return "playground_messages" }

// PlaygroundProject is a cloud-synced Studio work item (image/video/audio).
// Runs are immutable children linked via ProjectId on PlaygroundRun.
type PlaygroundProject struct {
	Id       int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId   int    `json:"user_id" gorm:"not null;index"`
	Modality string `json:"modality" gorm:"type:varchar(20);not null;index"` // image | video | audio
	Title    string `json:"title" gorm:"type:varchar(255)"`
	Model    string `json:"model" gorm:"type:varchar(191)"`
	Group    string `json:"group" gorm:"type:varchar(50)"`
	// ClientKey is the local session id used for idempotent create/merge.
	ClientKey   string `json:"client_key" gorm:"type:varchar(64);index"`
	LastPrompt  string `json:"last_prompt" gorm:"type:text"`
	PreviewURLs string `json:"preview_urls" gorm:"type:text"` // JSON string array
	CreatedAt   int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt   int64  `json:"updated_at" gorm:"bigint;index"`
}

func (PlaygroundProject) TableName() string { return "playground_projects" }

// PlaygroundPersona is a reusable system prompt / role.
type PlaygroundPersona struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId       int    `json:"user_id" gorm:"not null;index"`
	Name         string `json:"name" gorm:"type:varchar(128);not null"`
	SystemPrompt string `json:"system_prompt" gorm:"type:text"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt    int64  `json:"updated_at" gorm:"bigint"`
}

func (PlaygroundPersona) TableName() string { return "playground_personas" }

// PlaygroundRun records a lightweight generation for "My works".
// When ProjectId is set, the run belongs to a Studio project timeline.
type PlaygroundRun struct {
	Id        int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId    int    `json:"user_id" gorm:"not null;index"`
	ProjectId int    `json:"project_id" gorm:"index"`                         // 0 = unscoped / legacy "My works"
	Modality  string `json:"modality" gorm:"type:varchar(20);not null;index"` // image | video | audio | chat
	Model     string `json:"model" gorm:"type:varchar(191)"`
	Prompt    string `json:"prompt" gorm:"type:text"`
	ResultURL string `json:"result_url" gorm:"type:varchar(1024)"`
	AssetId   int    `json:"asset_id" gorm:"index"` // persisted output asset, when stored
	Quota     int    `json:"quota"`
	TaskId    string `json:"task_id" gorm:"type:varchar(191);index"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index"`
}

// PlaygroundChatToolRun is the durable, owner-scoped orchestration record for
// chat-triggered platform tools. Tool execution itself remains in the existing
// relay endpoints so media is billed exactly once.
type PlaygroundChatToolRun struct {
	Id              int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId          int    `json:"-" gorm:"not null;uniqueIndex:idx_pg_tool_owner_request"`
	ClientRequestId string `json:"client_request_id" gorm:"type:varchar(191);not null;uniqueIndex:idx_pg_tool_owner_request"`
	Action          string `json:"action" gorm:"type:varchar(32);not null;index"`
	Status          string `json:"status" gorm:"type:varchar(32);not null;index"`
	ChatModel       string `json:"chat_model" gorm:"type:varchar(191)"`
	UsingGroup      string `json:"group" gorm:"type:varchar(50)"`
	Prompt          string `json:"prompt" gorm:"type:text"`
	ToolModel       string `json:"tool_model" gorm:"type:varchar(191)"`
	ArgumentsJson   string `json:"-" gorm:"type:text"`
	SourcesJson     string `json:"-" gorm:"type:text"`
	ExecutionToken  string `json:"-" gorm:"type:varchar(64);uniqueIndex"`
	TaskId          string `json:"task_id,omitempty" gorm:"type:varchar(191);index"`
	ResultJson      string `json:"-" gorm:"type:text"`
	ErrorMessage    string `json:"error,omitempty" gorm:"type:text"`
	CreatedAt       int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt       int64  `json:"updated_at" gorm:"bigint"`
}

func (PlaygroundChatToolRun) TableName() string { return "playground_chat_tool_runs" }

func CreatePlaygroundChatToolRun(run *PlaygroundChatToolRun) error {
	now := time.Now().Unix()
	run.CreatedAt = now
	run.UpdatedAt = now
	return DB.Create(run).Error
}
func GetPlaygroundChatToolRun(id, userId int) (*PlaygroundChatToolRun, error) {
	var r PlaygroundChatToolRun
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(&r).Error
	return &r, err
}
func GetPlaygroundChatToolRunByRequest(userId int, requestId string) (*PlaygroundChatToolRun, error) {
	var r PlaygroundChatToolRun
	err := DB.Where("user_id = ? AND client_request_id = ?", userId, requestId).First(&r).Error
	return &r, err
}
func UpdatePlaygroundChatToolRunCAS(id, userId int, from string, updates map[string]any) error {
	updates["updated_at"] = time.Now().Unix()
	res := DB.Model(&PlaygroundChatToolRun{}).Where("id = ? AND user_id = ? AND status = ?", id, userId, from).Updates(updates)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (PlaygroundRun) TableName() string { return "playground_runs" }

// PlaygroundVoice stores a voice-clone reference (provider wiring optional).
type PlaygroundVoice struct {
	Id              int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId          int    `json:"user_id" gorm:"not null;index"`
	Name            string `json:"name" gorm:"type:varchar(128);not null"`
	AssetId         int    `json:"asset_id"`
	ProviderVoiceId string `json:"provider_voice_id" gorm:"type:varchar(191)"`
	Status          string `json:"status" gorm:"type:varchar(40)"` // pending_provider | ready | failed
	CreatedAt       int64  `json:"created_at" gorm:"bigint;index"`
}

func (PlaygroundVoice) TableName() string { return "playground_voices" }

// InspirationCategory groups inspiration templates.
type InspirationCategory struct {
	Id          int    `json:"id" gorm:"primaryKey;autoIncrement"`
	Slug        string `json:"slug" gorm:"type:varchar(64);uniqueIndex;not null"`
	Name        string `json:"name" gorm:"type:varchar(128);not null"`
	Description string `json:"description" gorm:"type:text"`
	Status      string `json:"status" gorm:"type:varchar(16);index"`
	SortOrder   int    `json:"sort_order"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint"`
}

func (InspirationCategory) TableName() string { return "inspiration_categories" }

// InspirationTemplate is a prompt template for the inspiration square.
type InspirationTemplate struct {
	Id                 int     `json:"id" gorm:"primaryKey;autoIncrement"`
	CategoryId         int     `json:"category_id" gorm:"index"`
	Slug               string  `json:"slug" gorm:"type:varchar(64);uniqueIndex;not null"`
	Title              string  `json:"title" gorm:"type:varchar(255);not null"`
	Prompt             string  `json:"prompt" gorm:"type:text;not null"`
	Modality           string  `json:"modality" gorm:"type:varchar(20);not null;index"` // image | video | chat | audio
	CoverURL           string  `json:"cover_url" gorm:"type:varchar(1024)"`
	UseCount           int     `json:"use_count"`
	SortOrder          int     `json:"sort_order"`
	CreatedAt          int64   `json:"created_at" gorm:"bigint"`
	Description        string  `json:"description" gorm:"type:text"`
	Status             string  `json:"status" gorm:"type:varchar(16);index"`
	Source             string  `json:"source" gorm:"type:varchar(16);index"`
	Featured           bool    `json:"featured"`
	PublishedVersionId *int    `json:"published_version_id" gorm:"index"`
	DraftVersionId     *int    `json:"draft_version_id" gorm:"index"`
	TagsJSON           *string `json:"-" gorm:"type:text"`
	UpdatedAt          *int64  `json:"updated_at" gorm:"bigint;autoUpdateTime:false"`
}

func (InspirationTemplate) TableName() string { return "inspiration_templates" }

// PlaygroundAgent is a launcher card shown in the playground agents panel.
type PlaygroundAgent struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	Slug         string `json:"slug" gorm:"type:varchar(64);uniqueIndex;not null"`
	Title        string `json:"title" gorm:"type:varchar(255);not null"`
	Description  string `json:"description" gorm:"type:text"`
	Category     string `json:"category" gorm:"type:varchar(64)"`
	Icon         string `json:"icon" gorm:"type:varchar(64)"`          // lucide icon key
	ActionType   string `json:"action_type" gorm:"type:varchar(20)"`   // route | external | modality | dialog
	ActionValue  string `json:"action_value" gorm:"type:varchar(255)"` // route path | href | modality | dialog name
	ActionPrompt string `json:"action_prompt" gorm:"type:text"`        // prefill prompt for modality actions
	Accent       string `json:"accent" gorm:"type:varchar(128)"`
	SortOrder    int    `json:"sort_order"`
	Enabled      bool   `json:"enabled"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint"`
}

func (PlaygroundAgent) TableName() string { return "playground_agents" }

// PlaygroundUploadSession is a short-lived token for QR / cross-device upload.
type PlaygroundUploadSession struct {
	Id        int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId    int    `json:"user_id" gorm:"not null;index"`
	Token     string `json:"token" gorm:"type:varchar(64);uniqueIndex;not null"`
	Kind      string `json:"kind" gorm:"type:varchar(20)"` // preferred kind filter
	ExpiresAt int64  `json:"expires_at" gorm:"bigint;index"`
	AssetId   int    `json:"asset_id"` // filled when upload completes
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
}

func (PlaygroundUploadSession) TableName() string { return "playground_upload_sessions" }

// --- Asset helpers ---

func CreatePlaygroundAsset(a *PlaygroundAsset) error {
	if a.CreatedAt == 0 {
		a.CreatedAt = time.Now().Unix()
	}
	return DB.Create(a).Error
}

func GetPlaygroundAsset(id int, userId int) (*PlaygroundAsset, error) {
	var a PlaygroundAsset
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(&a).Error
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func GetPlaygroundAssetById(id int) (*PlaygroundAsset, error) {
	var a PlaygroundAsset
	err := DB.Where("id = ?", id).First(&a).Error
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func ListPlaygroundAssets(userId int, kind string, offset, limit int) ([]PlaygroundAsset, int64, error) {
	q := DB.Model(&PlaygroundAsset{}).Where("user_id = ?", userId)
	if kind != "" {
		q = q.Where("kind = ?", kind)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []PlaygroundAsset
	err := q.Order("id DESC").Offset(offset).Limit(limit).Find(&items).Error
	return items, total, err
}

func DeletePlaygroundAsset(id int, userId int) error {
	res := DB.Where("id = ? AND user_id = ?", id, userId).Delete(&PlaygroundAsset{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// ListPlaygroundAssetsForBackfill returns assets still stored on the local
// backend (legacy empty backend or explicit "local"), ordered by id, for
// migration to R2. limit <= 0 returns all matching assets.
func ListPlaygroundAssetsForBackfill(limit int) ([]PlaygroundAsset, error) {
	var items []PlaygroundAsset
	q := DB.Where("backend = ? OR backend = ?", "local", "").
		Where("storage_key <> ?", "").
		Order("id ASC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	if err := q.Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

// SetPlaygroundAssetBackend updates the storage backend marker for an asset,
// optionally refreshing the public URL when the object was republished.
func SetPlaygroundAssetBackend(id int, backend, publicURL string) error {
	updates := map[string]any{"backend": backend}
	if publicURL != "" {
		updates["public_url"] = publicURL
	}
	res := DB.Model(&PlaygroundAsset{}).Where("id = ?", id).Updates(updates)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// SetPlaygroundAssetVisibility updates publish state. Empty publicKey/publicURL
// clear the public copy metadata (unpublish).
func SetPlaygroundAssetVisibility(id, userId int, visibility, publicKey, publicURL string) error {
	res := DB.Model(&PlaygroundAsset{}).
		Where("id = ? AND user_id = ?", id, userId).
		Updates(map[string]any{
			"visibility": visibility,
			"public_key": publicKey,
			"public_url": publicURL,
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// --- Conversation helpers ---

func CreatePlaygroundConversation(c *PlaygroundConversation) error {
	now := time.Now().Unix()
	if c.CreatedAt == 0 {
		c.CreatedAt = now
	}
	c.UpdatedAt = now
	return DB.Create(c).Error
}

func GetPlaygroundConversation(id int, userId int) (*PlaygroundConversation, error) {
	var c PlaygroundConversation
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(&c).Error
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func ListPlaygroundConversations(userId int, offset, limit int) ([]PlaygroundConversation, int64, error) {
	q := DB.Model(&PlaygroundConversation{}).Where("user_id = ?", userId)
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []PlaygroundConversation
	err := q.Order("updated_at DESC").Offset(offset).Limit(limit).Find(&items).Error
	return items, total, err
}

func UpdatePlaygroundConversation(c *PlaygroundConversation) error {
	c.UpdatedAt = time.Now().Unix()
	return DB.Model(c).Where("id = ? AND user_id = ?", c.Id, c.UserId).Updates(map[string]any{
		"title":      c.Title,
		"model":      c.Model,
		"group":      c.Group,
		"kind":       c.Kind,
		"meta_json":  c.MetaJson,
		"updated_at": c.UpdatedAt,
	}).Error
}

func DeletePlaygroundConversation(id int, userId int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("conversation_id = ? AND user_id = ?", id, userId).Delete(&PlaygroundMessage{}).Error; err != nil {
			return err
		}
		res := tx.Where("id = ? AND user_id = ?", id, userId).Delete(&PlaygroundConversation{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
}

// --- Project helpers ---

func CreatePlaygroundProject(p *PlaygroundProject) error {
	now := time.Now().Unix()
	if p.CreatedAt == 0 {
		p.CreatedAt = now
	}
	p.UpdatedAt = now
	return DB.Create(p).Error
}

func GetPlaygroundProject(id, userId int) (*PlaygroundProject, error) {
	var p PlaygroundProject
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(&p).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func GetPlaygroundProjectByClientKey(userId int, clientKey string) (*PlaygroundProject, error) {
	if clientKey == "" {
		return nil, gorm.ErrRecordNotFound
	}
	var p PlaygroundProject
	err := DB.Where("user_id = ? AND client_key = ?", userId, clientKey).First(&p).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func ListPlaygroundProjects(userId int, modality string, offset, limit int) ([]PlaygroundProject, int64, error) {
	q := DB.Model(&PlaygroundProject{}).Where("user_id = ?", userId)
	if modality != "" {
		q = q.Where("modality = ?", modality)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []PlaygroundProject
	err := q.Order("updated_at DESC").Offset(offset).Limit(limit).Find(&items).Error
	return items, total, err
}

func UpdatePlaygroundProject(p *PlaygroundProject) error {
	p.UpdatedAt = time.Now().Unix()
	return DB.Model(p).Where("id = ? AND user_id = ?", p.Id, p.UserId).Updates(map[string]any{
		"title":        p.Title,
		"model":        p.Model,
		"group":        p.Group,
		"last_prompt":  p.LastPrompt,
		"preview_urls": p.PreviewURLs,
		"updated_at":   p.UpdatedAt,
	}).Error
}

func DeletePlaygroundProject(id, userId int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		// Unlink runs (keep immutable run history under "My works").
		if err := tx.Model(&PlaygroundRun{}).
			Where("project_id = ? AND user_id = ?", id, userId).
			Update("project_id", 0).Error; err != nil {
			return err
		}
		res := tx.Where("id = ? AND user_id = ?", id, userId).Delete(&PlaygroundProject{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
}

func ListPlaygroundRunsByProject(userId, projectId int) ([]PlaygroundRun, error) {
	var items []PlaygroundRun
	err := DB.Where("user_id = ? AND project_id = ?", userId, projectId).
		Order("id ASC").Find(&items).Error
	return items, err
}

func ReplacePlaygroundMessages(conversationId, userId int, messages []PlaygroundMessage) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var conv PlaygroundConversation
		if err := tx.Where("id = ? AND user_id = ?", conversationId, userId).First(&conv).Error; err != nil {
			return err
		}
		if err := tx.Where("conversation_id = ? AND user_id = ?", conversationId, userId).Delete(&PlaygroundMessage{}).Error; err != nil {
			return err
		}
		now := time.Now().Unix()
		for i := range messages {
			messages[i].Id = 0
			messages[i].ConversationId = conversationId
			messages[i].UserId = userId
			messages[i].Seq = i
			if messages[i].CreatedAt == 0 {
				messages[i].CreatedAt = now
			}
			if err := tx.Create(&messages[i]).Error; err != nil {
				return err
			}
		}
		return tx.Model(&PlaygroundConversation{}).Where("id = ?", conversationId).Update("updated_at", now).Error
	})
}

func ListPlaygroundMessages(conversationId, userId int) ([]PlaygroundMessage, error) {
	var items []PlaygroundMessage
	err := DB.Where("conversation_id = ? AND user_id = ?", conversationId, userId).
		Order("seq ASC, id ASC").Find(&items).Error
	return items, err
}

// --- Persona helpers ---

func CreatePlaygroundPersona(p *PlaygroundPersona) error {
	now := time.Now().Unix()
	if p.CreatedAt == 0 {
		p.CreatedAt = now
	}
	p.UpdatedAt = now
	return DB.Create(p).Error
}

func ListPlaygroundPersonas(userId int) ([]PlaygroundPersona, error) {
	var items []PlaygroundPersona
	err := DB.Where("user_id = ?", userId).Order("id DESC").Find(&items).Error
	return items, err
}

func GetPlaygroundPersona(id, userId int) (*PlaygroundPersona, error) {
	var p PlaygroundPersona
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(&p).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func UpdatePlaygroundPersona(p *PlaygroundPersona) error {
	p.UpdatedAt = time.Now().Unix()
	res := DB.Model(p).Where("id = ? AND user_id = ?", p.Id, p.UserId).Updates(map[string]any{
		"name":          p.Name,
		"system_prompt": p.SystemPrompt,
		"updated_at":    p.UpdatedAt,
	})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func DeletePlaygroundPersona(id, userId int) error {
	res := DB.Where("id = ? AND user_id = ?", id, userId).Delete(&PlaygroundPersona{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// --- Run helpers ---

func CreatePlaygroundRun(r *PlaygroundRun) error {
	if r.CreatedAt == 0 {
		r.CreatedAt = time.Now().Unix()
	}
	return DB.Create(r).Error
}

// GetPlaygroundRunByTaskId returns the most recent run linked to an async task,
// or gorm.ErrRecordNotFound when the task did not originate from the playground.
func GetPlaygroundRunByTaskId(taskId string, userId int) (*PlaygroundRun, error) {
	if taskId == "" || userId <= 0 {
		return nil, gorm.ErrRecordNotFound
	}
	var r PlaygroundRun
	err := DB.Where("task_id = ? AND user_id = ? AND modality = ?", taskId, userId, "video").Order("id DESC").First(&r).Error
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// UpdatePlaygroundRunResult points a run at a persisted output asset.
func UpdatePlaygroundRunResult(id, userId, assetId int, resultURL string) error {
	result := DB.Model(&PlaygroundRun{}).
		Where("id = ? AND user_id = ? AND asset_id = ?", id, userId, 0).
		Updates(map[string]any{
			"asset_id":   assetId,
			"result_url": resultURL,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// ListUnpersistedSuccessfulVideoRuns returns durable video-output work. The
// join excludes pending, failed, missing, and cross-user task references.
func ListUnpersistedSuccessfulVideoRuns(afterID, limit int) ([]PlaygroundRun, error) {
	if limit <= 0 {
		return nil, nil
	}
	var runs []PlaygroundRun
	err := DB.Table("playground_runs").
		Select("playground_runs.*").
		Joins("JOIN tasks ON tasks.task_id = playground_runs.task_id AND tasks.user_id = playground_runs.user_id").
		Where("playground_runs.modality = ? AND playground_runs.asset_id = ? AND playground_runs.id > ?", "video", 0, afterID).
		Where("tasks.status = ?", TaskStatusSuccess).
		Order("playground_runs.id").Limit(limit).Scan(&runs).Error
	return runs, err
}

func HasUnpersistedSuccessfulVideoRuns() bool {
	var count int64
	err := DB.Table("playground_runs").
		Joins("JOIN tasks ON tasks.task_id = playground_runs.task_id AND tasks.user_id = playground_runs.user_id").
		Where("playground_runs.modality = ? AND playground_runs.asset_id = ?", "video", 0).
		Where("tasks.status = ?", TaskStatusSuccess).
		Limit(1).Count(&count).Error
	return err == nil && count > 0
}

func ListPlaygroundRuns(userId int, modality string, offset, limit int) ([]PlaygroundRun, int64, error) {
	q := DB.Model(&PlaygroundRun{}).Where("user_id = ?", userId)
	if modality != "" {
		q = q.Where("modality = ?", modality)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []PlaygroundRun
	err := q.Order("id DESC").Offset(offset).Limit(limit).Find(&items).Error
	return items, total, err
}

// --- Voice helpers ---

func CreatePlaygroundVoice(v *PlaygroundVoice) error {
	if v.CreatedAt == 0 {
		v.CreatedAt = time.Now().Unix()
	}
	if v.Status == "" {
		v.Status = "pending_provider"
	}
	return DB.Create(v).Error
}

func ListPlaygroundVoices(userId int) ([]PlaygroundVoice, error) {
	var items []PlaygroundVoice
	err := DB.Where("user_id = ?", userId).Order("id DESC").Find(&items).Error
	return items, err
}

func DeletePlaygroundVoice(id, userId int) error {
	res := DB.Where("id = ? AND user_id = ?", id, userId).Delete(&PlaygroundVoice{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func ListPlaygroundAgents() ([]PlaygroundAgent, error) {
	var items []PlaygroundAgent
	err := DB.Where("enabled = ?", true).Order("sort_order ASC, id ASC").Find(&items).Error
	return items, err
}

// SeedPlaygroundAgentsIfEmpty inserts the default agent launcher cards when the
// table is empty.
func SeedPlaygroundAgentsIfEmpty() error {
	var count int64
	if err := DB.Model(&PlaygroundAgent{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	now := time.Now().Unix()
	agents := []PlaygroundAgent{
		{Slug: "api-docs", Title: "Open API docs", Description: "Browse integration guides and endpoint references for Box AI.", Category: "API", Icon: "book-open", ActionType: "route", ActionValue: "/docs", Accent: "bg-primary/15 text-primary", SortOrder: 1, Enabled: true, CreatedAt: now},
		{Slug: "skill-download", Title: "Skill kit", Description: "Download starter skills and client snippets for quick integration.", Category: "API", Icon: "file-down", ActionType: "dialog", ActionValue: "skill", Accent: "bg-info/15 text-info", SortOrder: 2, Enabled: true, CreatedAt: now},
		{Slug: "pricing", Title: "Model pricing", Description: "Compare model rates and groups before you run a workload.", Category: "API", Icon: "sparkles", ActionType: "route", ActionValue: "/pricing", Accent: "bg-accent text-accent-foreground", SortOrder: 3, Enabled: true, CreatedAt: now},
		{Slug: "image-batch", Title: "Product image batch", Description: "Generate product shots with a shared prompt and count settings.", Category: "Create", Icon: "image", ActionType: "modality", ActionValue: "image", ActionPrompt: "Studio product photo on a clean background, soft lighting, high detail", Accent: "bg-accent text-accent-foreground", SortOrder: 4, Enabled: true, CreatedAt: now},
		{Slug: "video-product", Title: "Product video", Description: "Turn a product description into a short promotional clip.", Category: "Create", Icon: "clapperboard", ActionType: "modality", ActionValue: "video", ActionPrompt: "Cinematic 5s product showcase, slow orbit camera, premium lighting", Accent: "bg-warning/15 text-warning", SortOrder: 5, Enabled: true, CreatedAt: now},
		{Slug: "ppt-outline", Title: "PPT outline", Description: "Draft a presentation structure with titles and talking points.", Category: "Create", Icon: "presentation", ActionType: "modality", ActionValue: "chat", ActionPrompt: "Create a 10-slide presentation outline with titles, bullet points, and speaker notes for: ", Accent: "bg-success/15 text-success", SortOrder: 6, Enabled: true, CreatedAt: now},
		{Slug: "generic-image", Title: "One-click image", Description: "Jump into image generation with a ready creative brief.", Category: "Create", Icon: "wand", ActionType: "modality", ActionValue: "image", ActionPrompt: "Ultra detailed concept art, dramatic lighting, 4k", Accent: "bg-primary/10 text-primary", SortOrder: 7, Enabled: true, CreatedAt: now},
		{Slug: "infinite-canvas", Title: "Infinite canvas", Description: "Open a freeform board for multi-step visual workflows.", Category: "Tools", Icon: "layout-template", ActionType: "dialog", ActionValue: "canvas", Accent: "bg-warning/15 text-warning", SortOrder: 8, Enabled: true, CreatedAt: now},
	}
	for i := range agents {
		if err := DB.Create(&agents[i]).Error; err != nil {
			return err
		}
	}
	common.SysLog(fmt.Sprintf("seeded %d playground agents", len(agents)))
	return nil
}

// --- Upload session helpers ---

func CreatePlaygroundUploadSession(s *PlaygroundUploadSession) error {
	if s.CreatedAt == 0 {
		s.CreatedAt = time.Now().Unix()
	}
	return DB.Create(s).Error
}

func GetPlaygroundUploadSessionByToken(token string) (*PlaygroundUploadSession, error) {
	var s PlaygroundUploadSession
	err := DB.Where("token = ?", token).First(&s).Error
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// CompletePlaygroundUploadSession sets asset_id once and expires the session (one-shot).
// Returns false if the session was already completed or not found.
func CompletePlaygroundUploadSession(id, assetId int) (bool, error) {
	now := time.Now().Unix()
	res := DB.Model(&PlaygroundUploadSession{}).
		Where("id = ? AND asset_id = 0", id).
		Updates(map[string]any{
			"asset_id":   assetId,
			"expires_at": now, // invalidate immediately after first successful upload
		})
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected > 0, nil
}

// PublicPlaygroundAssetDTO strips internal storage_key from API responses.
func PublicPlaygroundAssetDTO(a *PlaygroundAsset) map[string]any {
	if a == nil {
		return nil
	}
	return map[string]any{
		"id":         a.Id,
		"user_id":    a.UserId,
		"kind":       a.Kind,
		"name":       a.Name,
		"url":        a.URL,
		"visibility": a.Visibility,
		"public_url": a.PublicURL,
		"mime":       a.Mime,
		"size":       a.Size,
		"created_at": a.CreatedAt,
	}
}
