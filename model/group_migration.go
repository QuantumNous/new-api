package model

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// The singleton control row serializes reference writers with migration commits.
// Owner is a process generation, never an expiring heartbeat lease.
type GroupMigrationControl struct {
	ID          int `gorm:"primaryKey;autoIncrement:false"`
	Fence       int64
	OperationID string `gorm:"type:varchar(64)"`
	Owner       string `gorm:"type:varchar(64)"`
}

type GroupMigrationOperation struct {
	ID        string `json:"id" gorm:"type:varchar(64);primaryKey"`
	Source    string `json:"source" gorm:"type:varchar(50)"`
	Target    string `json:"target" gorm:"type:varchar(50)"`
	Version   string `json:"version" gorm:"type:varchar(64)"`
	ActorID   int    `json:"actor_id"`
	State     string `json:"state" gorm:"type:varchar(32)"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
	Reason    string `json:"reason" gorm:"type:text"`
	Counts    string `json:"counts" gorm:"type:text"`
	Values    string `json:"-" gorm:"type:text"`
}

type GroupMigrationSubmission struct {
	OperationID  string `json:"operation_id"`
	Source       string `json:"source"`
	Target       string `json:"target"`
	Version      string `json:"version"`
	Confirmation string `json:"confirmation"`
}

var groupMigrationExecutor sync.Mutex
var groupMigrationTraffic = struct {
	sync.Mutex
	owner, recoveryOwner, operation, source, target string
	inflight                                        map[string]int
}{inflight: map[string]int{}}

type groupMigrationPausedError struct{ *common.Message }

func (err *groupMigrationPausedError) HTTPStatus() int { return http.StatusServiceUnavailable }
func (err *groupMigrationPausedError) Unwrap() error   { return err.Message }

var ErrGroupMigrationPaused = &groupMigrationPausedError{common.NewMessage("Group migration is in progress. Please retry later.")}

func groupMigrationQualification(db *gorm.DB) error {
	if os.Getenv("GROUP_MIGRATION_SINGLE_NODE") != "true" {
		return common.NewMessage("Set GROUP_MIGRATION_SINGLE_NODE=true only after guaranteeing a single serving instance and stopping other business writers.")
	}
	var conflicts int64
	if err := db.Model(&SystemInstance{}).Where("node_name <> ? AND last_seen_at >= ?", common.NodeName, time.Now().Unix()-SystemInstanceStaleAfterSeconds).Count(&conflicts).Error; err != nil {
		return common.NewMessage("Unable to verify known deployment conflicts.")
	}
	if conflicts != 0 {
		return common.NewMessage("Other known serving instances conflict with the single-node declaration.")
	}
	return nil
}

func groupMigrationConfirmation(p *GroupMigrationPreview) string {
	expiry := strconv.FormatInt(p.ExpiresAt, 10)
	mac := hmac.New(sha256.New, []byte(common.SessionSecret))
	fmt.Fprintf(mac, "group-migration\x00%s\x00%s\x00%s\x00%s", p.Source, p.Target, p.Version, expiry)
	return fmt.Sprintf("%s.%x", expiry, mac.Sum(nil))
}

func (control *GroupMigrationControl) lock(tx *gorm.DB) error {
	// A real UPDATE also acquires SQLite's writer lock. Row locks alone would
	// leave a read/check/write race on that dialect. Explicit caller transactions
	// retain this lock until their final commit, including background writers.
	if err := tx.Model(&GroupMigrationControl{}).Where("id = ?", 1).Update("fence", gorm.Expr("fence + 1")).Error; err != nil {
		return err
	}
	return lockForUpdate(tx).First(control, 1).Error
}

func GetGroupMigration(ctx context.Context, id string) (*GroupMigrationOperation, error) {
	var op GroupMigrationOperation
	err := DB.WithContext(ctx).First(&op, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &op, nil
}

func ListGroupMigrations(ctx context.Context) ([]GroupMigrationOperation, error) {
	operations := []GroupMigrationOperation{}
	err := DB.WithContext(ctx).Order("created_at DESC").Order("id DESC").Limit(20).Find(&operations).Error
	return operations, err
}

// InitGroupMigrations runs before traffic and background business writers. A
// missing deployment declaration preserves outstanding barriers for inspection.
func InitGroupMigrations(ctx context.Context) error {
	groupMigrationExecutor.Lock()
	defer groupMigrationExecutor.Unlock()
	if err := DB.AutoMigrate(&GroupMigrationControl{}, &GroupMigrationOperation{}); err != nil {
		return err
	}
	if err := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&GroupMigrationControl{ID: 1}).Error; err != nil {
		return err
	}
	owner := common.GetRandomString(32)
	var control GroupMigrationControl
	if err := DB.First(&control, 1).Error; err != nil {
		return err
	}
	groupMigrationTraffic.Lock()
	groupMigrationTraffic.owner = owner
	groupMigrationTraffic.recoveryOwner = control.Owner
	groupMigrationTraffic.operation, groupMigrationTraffic.source, groupMigrationTraffic.target = "", "", ""
	groupMigrationTraffic.Unlock()
	if err := installGroupMigrationWriteBarrier(DB); err != nil {
		return err
	}
	if control.OperationID == "" {
		return nil
	}
	op, err := GetGroupMigration(ctx, control.OperationID)
	if err != nil {
		return err
	}
	setGroupMigrationPause(op)
	if err := groupMigrationQualification(DB); err != nil {
		return nil
	}
	result := DB.Model(&GroupMigrationControl{}).Where("id = ? AND owner = ? AND operation_id = ?", 1, control.Owner, op.ID).Update("owner", owner)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return errors.New("group migration recovery ownership changed")
	}
	groupOptionMutex.Lock()
	defer groupOptionMutex.Unlock()
	if op.State == "committed" {
		return finishGroupMigration(ctx, op, owner)
	}
	return releaseGroupMigration(ctx, op, owner, "aborted", "Migration stopped before commit; preview and confirm again.")
}

func setGroupMigrationPause(op *GroupMigrationOperation) {
	groupMigrationTraffic.Lock()
	defer groupMigrationTraffic.Unlock()
	groupMigrationTraffic.operation, groupMigrationTraffic.source, groupMigrationTraffic.target = op.ID, op.Source, op.Target
}

// AdmitGroupRequest covers the whole response lifetime, including streams. It
// never cancels accepted requests; migration waits for their release instead.
func AdmitGroupRequest(groups ...string) (func(), error) {
	groupMigrationTraffic.Lock()
	defer groupMigrationTraffic.Unlock()
	for _, group := range groups {
		if groupMigrationTraffic.operation != "" && (group == groupMigrationTraffic.source || group == groupMigrationTraffic.target) {
			return nil, ErrGroupMigrationPaused
		}
	}
	for _, group := range groups {
		groupMigrationTraffic.inflight[group]++
	}
	return sync.OnceFunc(func() {
		groupMigrationTraffic.Lock()
		defer groupMigrationTraffic.Unlock()
		for _, group := range groups {
			groupMigrationTraffic.inflight[group]--
		}
	}), nil
}

func SubmitGroupMigration(ctx context.Context, submission GroupMigrationSubmission, actor int) (*GroupMigrationOperation, error) {
	if !groupMigrationExecutor.TryLock() {
		return nil, ErrGroupMigrationPaused
	}
	defer groupMigrationExecutor.Unlock()
	groupOptionMutex.Lock()
	defer groupOptionMutex.Unlock()
	if len(submission.OperationID) < 8 || len(submission.OperationID) > 64 || strings.ContainsFunc(submission.OperationID, func(r rune) bool {
		return r != '-' && r != '_' && (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') && (r < '0' || r > '9')
	}) {
		return nil, common.NewMessage("A valid migration operation ID is required.")
	}
	if existing, err := GetGroupMigration(ctx, submission.OperationID); err == nil {
		if existing.Source != submission.Source || existing.Target != submission.Target || existing.Version != submission.Version {
			return nil, common.NewMessage("This operation ID belongs to a different migration.")
		}
		return existing, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if err := groupMigrationQualification(DB); err != nil {
		return nil, err
	}
	expiry, _, _ := strings.Cut(submission.Confirmation, ".")
	expires, err := strconv.ParseInt(expiry, 10, 64)
	p := &GroupMigrationPreview{Source: submission.Source, Target: submission.Target, Version: submission.Version, ExpiresAt: expires}
	if err != nil || expires <= time.Now().Unix() || expires > time.Now().Add(5*time.Minute).Unix() || !hmac.Equal([]byte(submission.Confirmation), []byte(groupMigrationConfirmation(p))) {
		return nil, common.NewMessage("The preview expired or changed. Preview and confirm again.")
	}
	groupMigrationTraffic.Lock()
	owner := groupMigrationTraffic.owner
	groupMigrationTraffic.Unlock()
	if owner == "" {
		return nil, common.NewMessage("Group migration coordination is unavailable.")
	}
	op := &GroupMigrationOperation{ID: submission.OperationID, Source: submission.Source, Target: submission.Target, Version: submission.Version, ActorID: actor, State: "paused", CreatedAt: time.Now().Unix(), UpdatedAt: time.Now().Unix()}
	err = DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var control GroupMigrationControl
		if err := control.lock(tx); err != nil {
			return err
		}
		if control.OperationID != "" {
			return ErrGroupMigrationPaused
		}
		preview, err := previewGroupMigration(tx, op.Source, op.Target)
		if err != nil {
			return err
		}
		if preview.Version != op.Version || len(preview.Blockers)+len(preview.ExecutionBlockers) != 0 {
			return common.NewMessage("The preview expired or changed. Preview and confirm again.")
		}
		counts, err := common.Marshal(preview.Counts)
		if err != nil {
			return err
		}
		op.Counts = string(counts)
		if err := tx.Create(op).Error; err != nil {
			return err
		}
		return tx.Model(&control).Updates(map[string]any{"operation_id": op.ID, "owner": owner}).Error
	})
	if err != nil {
		// Commit acknowledgement can be lost after the barrier was persisted.
		// Read its durable identity before allowing local traffic to continue.
		var control GroupMigrationControl
		if readErr := DB.First(&control, 1).Error; readErr != nil {
			setGroupMigrationPause(op)
			return op, readErr
		}
		if control.OperationID != "" {
			active, readErr := GetGroupMigration(context.Background(), control.OperationID)
			if readErr != nil {
				setGroupMigrationPause(op)
				return op, readErr
			}
			setGroupMigrationPause(active)
			if active.ID == op.ID {
				return active, err
			}
		}
		return nil, err
	}
	setGroupMigrationPause(op)
	drain, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	ticker := time.NewTicker(25 * time.Millisecond)
	defer ticker.Stop()
	for {
		groupMigrationTraffic.Lock()
		active := groupMigrationTraffic.inflight[op.Source] + groupMigrationTraffic.inflight[op.Target]
		groupMigrationTraffic.Unlock()
		if active == 0 {
			break
		}
		select {
		case <-drain.Done():
			return op, releaseGroupMigration(context.Background(), op, owner, "aborted", "Accepted requests did not drain; preview and confirm again.")
		case <-ticker.C:
		}
	}
	err = DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var control GroupMigrationControl
		if err := control.lock(tx); err != nil {
			return err
		}
		if control.Owner != owner || control.OperationID != op.ID {
			return ErrGroupMigrationPaused
		}
		preview, err := previewGroupMigration(tx, op.Source, op.Target)
		if err != nil {
			return err
		}
		if preview.Version != op.Version || len(preview.Blockers)+len(preview.ExecutionBlockers) != 0 {
			return common.NewMessage("The preview expired or changed. Preview and confirm again.")
		}
		values := map[string]string{"GroupRatio": ratio_setting.GroupRatio2JSONString(), "UserUsableGroups": setting.UserUsableGroups2JSONString(), "TopupGroupRatio": common.TopupGroupRatio2JSONString()}
		for key, value := range values {
			var object map[string]any
			if err := common.UnmarshalJsonStr(value, &object); err != nil {
				return err
			}
			if original, exists := object[op.Source]; exists {
				object[op.Target] = original
				delete(object, op.Source)
			}
			encoded, err := common.Marshal(object)
			if err != nil {
				return err
			}
			values[key] = string(encoded)
		}
		values["group_ratio_setting.group_ratio"] = values["GroupRatio"]
		for key, value := range values {
			if err := tx.Clauses(clause.OnConflict{UpdateAll: true}).Create(&Option{Key: key, Value: value}).Error; err != nil {
				return err
			}
		}
		encoded, err := common.Marshal(values)
		if err != nil {
			return err
		}
		op.Values, op.State, op.UpdatedAt = string(encoded), "committed", time.Now().Unix()
		return tx.Save(op).Error
	})
	if err != nil {
		// A commit error can be ambiguous. Only the durable state decides whether
		// rollback is safe; failed reads retain the barrier for recovery.
		op, readErr := GetGroupMigration(context.Background(), op.ID)
		if readErr != nil {
			return nil, readErr
		}
		if op.State == "committed" {
			return op, err
		}
		if releaseErr := releaseGroupMigration(context.Background(), op, owner, "aborted", "Migration stopped before commit; preview and confirm again."); releaseErr != nil {
			return op, releaseErr
		}
		return op, err
	}
	err = finishGroupMigration(context.Background(), op, owner)
	return op, err
}

func finishGroupMigration(ctx context.Context, op *GroupMigrationOperation, owner string) error {
	return releaseGroupMigration(ctx, op, owner, "completed", "")
}

func releaseGroupMigration(ctx context.Context, op *GroupMigrationOperation, owner, state, reason string) error {
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var control GroupMigrationControl
		if err := control.lock(tx); err != nil {
			return err
		}
		if control.Owner != owner || control.OperationID != op.ID {
			return ErrGroupMigrationPaused
		}
		if err := groupMigrationQualification(tx); err != nil {
			return err
		}
		if state == "completed" {
			var committed GroupMigrationOperation
			if err := tx.First(&committed, "id = ?", op.ID).Error; err != nil {
				return err
			}
			if committed.State != "committed" {
				return ErrGroupMigrationPaused
			}
			var values map[string]string
			if err := common.UnmarshalJsonStr(committed.Values, &values); err != nil {
				return err
			}
			// Publication is fenced by the same lock as ownership and release.
			// Unused groups have no user/token/channel cache entries to refresh.
			for key, value := range values {
				if err := updateOptionMap(key, value); err != nil {
					return err
				}
			}
		}
		if err := tx.Model(op).Updates(map[string]any{"state": state, "reason": reason, "updated_at": time.Now().Unix()}).Error; err != nil {
			return err
		}
		return tx.Model(&control).Updates(map[string]any{"operation_id": "", "owner": ""}).Error
	})
	if err == nil {
		groupMigrationTraffic.Lock()
		if groupMigrationTraffic.owner == owner && groupMigrationTraffic.operation == op.ID {
			groupMigrationTraffic.operation, groupMigrationTraffic.source, groupMigrationTraffic.target = "", "", ""
		}
		groupMigrationTraffic.Unlock()
	}
	return err
}

func ResumeGroupMigration(ctx context.Context, id string) (*GroupMigrationOperation, error) {
	if !groupMigrationExecutor.TryLock() {
		return nil, ErrGroupMigrationPaused
	}
	defer groupMigrationExecutor.Unlock()
	groupOptionMutex.Lock()
	defer groupOptionMutex.Unlock()
	op, err := GetGroupMigration(ctx, id)
	if err != nil || op.State == "completed" || op.State == "aborted" {
		return op, err
	}
	groupMigrationTraffic.Lock()
	owner := groupMigrationTraffic.owner
	recoveryOwner, operation := groupMigrationTraffic.recoveryOwner, groupMigrationTraffic.operation
	groupMigrationTraffic.Unlock()
	// A restart without the declaration retains the old owner. Only the owner
	// observed at startup may be reclaimed; a later replacement stays fenced.
	err = DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var control GroupMigrationControl
		if err := control.lock(tx); err != nil {
			return err
		}
		if err := groupMigrationQualification(tx); err != nil {
			return err
		}
		if control.OperationID != id || operation != id || owner == "" || control.Owner != owner && control.Owner != recoveryOwner {
			return ErrGroupMigrationPaused
		}
		return tx.Model(&control).Update("owner", owner).Error
	})
	if err != nil {
		return op, err
	}
	if op.State == "committed" {
		err = finishGroupMigration(ctx, op, owner)
	} else {
		err = releaseGroupMigration(ctx, op, owner, "aborted", "Migration stopped before commit; preview and confirm again.")
	}
	return op, err
}
