package model

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
	_ "time/tzdata"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/schema"
)

const (
	SystemTaskTypeIQTest = "group_iq_test"
	IQMaxPairs           = 100
	IQMaxPromptBytes     = 64 << 10
	IQMaxResponseBytes   = 2 << 20
	IQMaxArtifactBytes   = 1 << 20
	IQOutputTokens       = 16384
	IQDefaultPrompt      = "画一个鹈鹕骑单车的HTML，我要的是最高水准的完成品，不要草稿，黄昏氛围，角色有表情和配饰，场景有远近层次，动作自然，带一个小彩蛋，你先想好整体的设计再动手，不用测试，直接发我文件"
)

var ErrIQConflict = errors.New("IQ configuration changed; reload and try again")

// IQText keeps >64 KiB payloads portable (MySQL TEXT is too small).
type IQText string

func (IQText) GormDataType() string { return "string" }
func (IQText) GormDBDataType(db *gorm.DB, _ *schema.Field) string {
	if db.Dialector.Name() == "mysql" {
		return "mediumtext"
	}
	return "text"
}

type IQTarget struct {
	Group  string   `json:"group"`
	Models []string `json:"models"`
}
type IQConfig struct {
	ID            int        `json:"-" gorm:"primaryKey;autoIncrement:false"`
	Version       int64      `json:"version"`
	Prompt        IQText     `json:"prompt"`
	Targets       []IQTarget `json:"targets" gorm:"serializer:json;size:16777215"`
	Enabled       bool       `json:"enabled"`
	ScheduleMode  string     `json:"schedule_mode"`
	IntervalHours int        `json:"interval_hours"`
	DailyTime     string     `json:"daily_time"`
	Timezone      string     `json:"timezone"`
	NextRunAt     int64      `json:"next_run_at"`
	UpdatedAt     int64      `json:"updated_at"`
	UpdatedBy     int        `json:"updated_by"`
	DispatchSeq   int64      `json:"-"`
}

// No artwork or prompt snapshot belongs in SystemTask's publicly listed bodies.
type IQBatch struct {
	TaskID   string `gorm:"type:varchar(64);primaryKey"`
	Snapshot IQText
}
type IQAttempt struct {
	TaskID      string `json:"-" gorm:"type:varchar(64);primaryKey"`
	PairID      string `json:"id" gorm:"type:varchar(64);primaryKey"`
	Group       string `json:"group" gorm:"column:group_name;type:varchar(64)"`
	Model       string `json:"model" gorm:"type:varchar(255)"`
	Status      string `json:"status" gorm:"type:varchar(32)"`
	StartedAt   int64  `json:"started_at"`
	CompletedAt int64  `json:"completed_at"`
}
type IQResult struct {
	ID            string `json:"id" gorm:"type:varchar(64);primaryKey"`
	Group         string `json:"group" gorm:"column:group_name;type:varchar(64)"`
	Model         string `json:"model" gorm:"type:varchar(255)"`
	TaskID        string `json:"task_id" gorm:"type:varchar(64)"`
	RunSeq        int64  `json:"-"`
	ConfigVersion int64  `json:"config_version"`
	Status        string `json:"status" gorm:"type:varchar(32)"`
	StartedAt     int64  `json:"started_at"`
	CompletedAt   int64  `json:"completed_at"`
	DurationMS    int64  `json:"duration_ms"`
	ArtifactKind  string `json:"artifact_kind"`
	Artifact      IQText `json:"-"`
	ErrorCode     string `json:"error_code"`
	ErrorMessage  string `json:"error_message"`
}

func IQPairID(group, name string) string {
	sum := sha256.Sum256([]byte(group + "\x00" + name))
	return hex.EncodeToString(sum[:])
}
func defaultIQConfig() IQConfig {
	return IQConfig{ID: 1, Version: 1, Prompt: IQDefaultPrompt, Targets: []IQTarget{}, ScheduleMode: "interval", IntervalHours: 24, DailyTime: "09:00", Timezone: "Asia/Shanghai"}
}
func GetIQConfig() (*IQConfig, error) {
	initial := defaultIQConfig()
	if err := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&initial).Error; err != nil {
		return nil, err
	}
	var cfg IQConfig
	err := DB.First(&cfg, 1).Error
	return &cfg, err
}

// NormalizeIQConfig preserves the exact administrator prompt, including whitespace.
func NormalizeIQConfig(c *IQConfig) error {
	if !utf8.ValidString(string(c.Prompt)) || strings.TrimSpace(string(c.Prompt)) == "" || len(c.Prompt) > IQMaxPromptBytes {
		return errors.New("prompt must contain 1–65536 UTF-8 bytes")
	}
	if c.Timezone != "Asia/Shanghai" {
		return errors.New("timezone must be Asia/Shanghai")
	}
	switch c.ScheduleMode {
	case "interval":
		if c.IntervalHours < 1 || c.IntervalHours > 8760 {
			return errors.New("interval_hours must be 1–8760")
		}
	case "daily":
		if _, err := time.Parse("15:04", c.DailyTime); err != nil || len(c.DailyTime) != 5 {
			return errors.New("daily_time must be HH:mm")
		}
	default:
		return errors.New("schedule_mode must be interval or daily")
	}
	groups := map[string]map[string]bool{}
	for _, target := range c.Targets {
		group := strings.TrimSpace(target.Group)
		if group == "" || group == "auto" || len(group) > 64 || strings.ContainsRune(group, 0) {
			return errors.New("invalid concrete group")
		}
		if groups[group] == nil {
			groups[group] = map[string]bool{}
		}
		for _, name := range target.Models {
			name = strings.TrimSpace(name)
			if name == "" || len(name) > 255 || strings.ContainsRune(name, 0) {
				return errors.New("invalid model")
			}
			groups[group][name] = true
		}
	}
	c.Targets = []IQTarget{}
	count := 0
	for group, names := range groups {
		models := []string{}
		for name := range names {
			models = append(models, name)
		}
		sort.Strings(models)
		if len(models) > 0 {
			c.Targets = append(c.Targets, IQTarget{group, models})
			count += len(models)
		}
	}
	sort.Slice(c.Targets, func(i, j int) bool { return c.Targets[i].Group < c.Targets[j].Group })
	if count > IQMaxPairs {
		return fmt.Errorf("at most %d pairs are allowed", IQMaxPairs)
	}
	if c.Enabled && count == 0 {
		return errors.New("enabled schedule requires targets")
	}
	return nil
}

// NextIQRun is strictly future. Missed slots are skipped, never replayed.
func NextIQRun(c IQConfig, now time.Time, anchor int64) int64 {
	if !c.Enabled {
		return 0
	}
	if c.ScheduleMode == "interval" {
		step := int64(c.IntervalHours) * 3600
		if step <= 0 {
			return 0
		}
		if anchor > 0 {
			if anchor > now.Unix() {
				return anchor
			}
			return anchor + ((now.Unix()-anchor)/step+1)*step
		}
		return now.Unix() + step
	}
	zone, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return 0
	}
	parts := strings.Split(c.DailyTime, ":")
	if len(parts) != 2 {
		return 0
	}
	h, e1 := strconv.Atoi(parts[0])
	m, e2 := strconv.Atoi(parts[1])
	if e1 != nil || e2 != nil || h < 0 || h > 23 || m < 0 || m > 59 {
		return 0
	}
	local := now.In(zone)
	next := time.Date(local.Year(), local.Month(), local.Day(), h, m, 0, 0, zone)
	if !next.After(now) {
		next = next.AddDate(0, 0, 1)
	}
	return next.Unix()
}
func SaveIQConfig(c IQConfig, userID int, now time.Time) (*IQConfig, error) {
	if err := NormalizeIQConfig(&c); err != nil {
		return nil, err
	}
	c.ID = 1
	c.UpdatedAt = now.Unix()
	c.UpdatedBy = userID
	c.NextRunAt = NextIQRun(c, now, 0)
	err := DB.Transaction(func(tx *gorm.DB) error {
		targets, _ := json.Marshal(c.Targets)
		res := tx.Model(&IQConfig{}).Where("id = 1 AND version = ?", c.Version).Updates(map[string]any{"version": c.Version + 1, "prompt": c.Prompt, "targets": string(targets), "enabled": c.Enabled, "schedule_mode": c.ScheduleMode, "interval_hours": c.IntervalHours, "daily_time": c.DailyTime, "timezone": c.Timezone, "next_run_at": c.NextRunAt, "updated_at": c.UpdatedAt, "updated_by": userID})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected != 1 {
			return ErrIQConflict
		}
		ids := iqTargetIDs(c)
		q := tx.Model(&IQResult{})
		if len(ids) > 0 {
			q = q.Where("id NOT IN ?", ids)
		} else {
			q = q.Where("1 = 1")
		}
		return q.Delete(&IQResult{}).Error
	})
	c.Version++
	return &c, err
}
func iqTargetIDs(c IQConfig) []string {
	ids := []string{}
	for _, t := range c.Targets {
		for _, n := range t.Models {
			ids = append(ids, IQPairID(t.Group, n))
		}
	}
	return ids
}
func iqHasTarget(c IQConfig, id string) bool {
	for _, v := range iqTargetIDs(c) {
		if v == id {
			return true
		}
	}
	return false
}

// EnqueueIQBatch atomically advances a due slot and snapshots the configuration.
// Updating DispatchSeq serializes manual/scheduled enqueue with config edits.
func EnqueueIQBatch(scheduled bool, now time.Time) (*SystemTask, bool, error) {
	if _, err := GetIQConfig(); err != nil {
		return nil, false, err
	}
	var task *SystemTask
	created := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		var c IQConfig
		if err := tx.First(&c, 1).Error; err != nil {
			return err
		}
		if err := NormalizeIQConfig(&c); err != nil {
			return err
		}
		if scheduled && (!c.Enabled || c.NextRunAt == 0 || c.NextRunAt > now.Unix()) {
			return nil
		}
		q := tx.Model(&IQConfig{}).Where("id = 1 AND version = ?", c.Version)
		if scheduled {
			q = q.Where("enabled = ? AND next_run_at = ?", true, c.NextRunAt)
		}
		updates := map[string]any{"dispatch_seq": gorm.Expr("dispatch_seq + 1")}
		if scheduled {
			updates["next_run_at"] = NextIQRun(c, now, c.NextRunAt)
		}
		res := q.Updates(updates)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected != 1 {
			return ErrIQConflict
		}
		var active SystemTask
		err := tx.Where("active_key = ?", SystemTaskTypeIQTest).First(&active).Error
		if err == nil {
			task = &active
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if len(iqTargetIDs(c)) == 0 {
			return errors.New("select at least one target")
		}
		id, err := GenerateSystemTaskID()
		if err != nil {
			return err
		}
		kind := SystemTaskTypeIQTest
		task = &SystemTask{TaskID: id, Type: kind, Status: SystemTaskStatusPending, ActiveKey: &kind, Payload: fmt.Sprintf(`{"config_version":%d}`, c.Version)}
		if err := tx.Create(task).Error; err != nil {
			return err
		}
		snapshot, err := json.Marshal(c)
		if err != nil {
			return err
		}
		if err := tx.Create(&IQBatch{TaskID: id, Snapshot: IQText(snapshot)}).Error; err != nil {
			return err
		}
		attempts := []IQAttempt{}
		for _, t := range c.Targets {
			for _, name := range t.Models {
				attempts = append(attempts, IQAttempt{TaskID: id, PairID: IQPairID(t.Group, name), Group: t.Group, Model: name, Status: "pending"})
			}
		}
		if err := tx.Create(&attempts).Error; err != nil {
			return err
		}
		created = true
		return nil
	})
	if err != nil {
		if active, e := GetActiveSystemTask(SystemTaskTypeIQTest); e == nil && active != nil {
			return active, false, nil
		}
	}
	return task, created, err
}
func GetIQBatch(taskID string) (*IQConfig, error) {
	var b IQBatch
	if err := DB.First(&b, "task_id = ?", taskID).Error; err != nil {
		return nil, err
	}
	var c IQConfig
	err := json.Unmarshal([]byte(b.Snapshot), &c)
	return &c, err
}
func GetIQAttempts(taskID string) ([]IQAttempt, error) {
	a := []IQAttempt{}
	err := DB.Where("task_id = ?", taskID).Order("group_name, model").Find(&a).Error
	return a, err
}
func iqLease(tx *gorm.DB, taskID, runner string) error {
	var n int64
	err := tx.Model(&SystemTask{}).Where("task_id = ? AND status = ? AND locked_by = ?", taskID, SystemTaskStatusRunning, runner).Where("EXISTS (SELECT 1 FROM system_task_locks WHERE system_task_locks.task_id = system_tasks.task_id AND system_task_locks.locked_by = ? AND locked_until >= ?)", runner, common.GetTimestamp()).Count(&n).Error
	if err != nil {
		return err
	}
	if n != 1 {
		return ErrSystemTaskLockLost
	}
	return nil
}
func StartIQAttempt(taskID, pairID, runner string, now int64) (bool, error) {
	started := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := iqLease(tx, taskID, runner); err != nil {
			return err
		}
		res := tx.Model(&IQAttempt{}).Where("task_id = ? AND pair_id = ? AND status = ?", taskID, pairID, "pending").Updates(map[string]any{"status": "running", "started_at": now})
		started = res.RowsAffected == 1
		return res.Error
	})
	return started, err
}
func CompleteIQAttempt(r IQResult, runner string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := iqLease(tx, r.TaskID, runner); err != nil {
			return err
		}
		// Lock the config row against edits/pruning until the latest replacement commits.
		if err := tx.Model(&IQConfig{}).Where("id = 1").UpdateColumn("dispatch_seq", gorm.Expr("dispatch_seq + 1")).Error; err != nil {
			return err
		}
		res := tx.Model(&IQAttempt{}).Where("task_id = ? AND pair_id = ? AND status = ?", r.TaskID, r.ID, "running").Updates(map[string]any{"status": r.Status, "completed_at": r.CompletedAt})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected != 1 {
			return errors.New("IQ attempt is already terminal")
		}
		var cfg IQConfig
		if err := tx.First(&cfg, 1).Error; err != nil {
			return err
		}
		if !iqHasTarget(cfg, r.ID) {
			return nil
		}
		var task SystemTask
		if err := tx.Select("id").Where("task_id = ?", r.TaskID).First(&task).Error; err != nil {
			return err
		}
		r.RunSeq = task.ID
		return storeIQLatest(tx, r)
	})
}

// Expired work is terminal, including unsent pending pairs. Never replay a batch.
func InterruptIQBatch(taskID string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&IQConfig{}).Where("id = 1").UpdateColumn("dispatch_seq", gorm.Expr("dispatch_seq + 1")).Error; err != nil {
			return err
		}
		var c IQConfig
		if err := tx.First(&c, 1).Error; err != nil {
			return err
		}
		var b IQBatch
		if err := tx.First(&b, "task_id = ?", taskID).Error; err != nil {
			return err
		}
		var snapshot IQConfig
		if err := json.Unmarshal([]byte(b.Snapshot), &snapshot); err != nil {
			return err
		}
		var attempts []IQAttempt
		if err := tx.Where("task_id = ? AND status IN ?", taskID, []string{"pending", "running"}).Find(&attempts).Error; err != nil {
			return err
		}
		for _, a := range attempts {
			var task SystemTask
			if err := tx.Select("id").Where("task_id = ?", taskID).First(&task).Error; err != nil {
				return err
			}
			now := common.GetTimestamp()
			res := tx.Model(&IQAttempt{}).Where("task_id = ? AND pair_id = ? AND status IN ?", taskID, a.PairID, []string{"pending", "running"}).Updates(map[string]any{"status": "interrupted", "completed_at": now})
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected > 0 && iqHasTarget(c, a.PairID) {
				r := IQResult{ID: a.PairID, Group: a.Group, Model: a.Model, TaskID: taskID, RunSeq: task.ID, ConfigVersion: snapshot.Version, Status: "interrupted", StartedAt: a.StartedAt, CompletedAt: now, ErrorCode: "interrupted", ErrorMessage: "Execution interrupted; not retried"}
				if err := storeIQLatest(tx, r); err != nil {
					return err
				}
			}
		}
		return nil
	})
}
func ListIQLatest() ([]IQResult, error) {
	rows := []IQResult{}
	err := DB.Omit("artifact").Find(&rows).Error
	return rows, err
}
func GetIQResult(id string) (*IQResult, error) {
	var r IQResult
	err := DB.First(&r, "id = ?", id).Error
	return &r, err
}

// Callers hold the config-row write lock; an old lease-expiry cleanup must not
// replace a newer batch's already-completed artwork.
func storeIQLatest(tx *gorm.DB, r IQResult) error {
	var previous IQResult
	err := tx.Select("id", "run_seq").First(&previous, "id = ?", r.ID).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	if err == nil && previous.RunSeq > r.RunSeq {
		return nil
	}
	return tx.Clauses(clause.OnConflict{UpdateAll: true}).Create(&r).Error
}
