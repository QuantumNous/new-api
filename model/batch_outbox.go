package model

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// BatchQuotaJournal records the batch ids whose deltas are already committed to
// the database.
//
// Batch quota updates only move balance in the database once, so replaying a
// staged batch after a crash must not charge a user twice. The marker row is
// written inside the same transaction as the balance updates: either the whole
// batch (deltas plus marker) commits, or none of it does. Recovery uses the
// marker to decide whether an uncommitted write-ahead record still needs to be
// applied.
type BatchQuotaJournal struct {
	BatchId   string `json:"batch_id" gorm:"primaryKey;size:64"`
	AppliedAt int64  `json:"applied_at" gorm:"index"`
}

func (BatchQuotaJournal) TableName() string {
	return "batch_quota_journal"
}

// errBatchAlreadyApplied is not a failure: another attempt (or a replay of the
// same write-ahead record) already committed this batch.
var errBatchAlreadyApplied = errors.New("batch quota deltas already applied")

const (
	batchOutboxRecordBegin  = "begin"
	batchOutboxRecordEntry  = "entry"
	batchOutboxRecordCommit = "commit"

	batchOutboxFilePrefix = "batch-outbox-"
	batchOutboxFileSuffix = ".wal"

	// batchQuotaJournalRetentionDays bounds how long applied batch ids are kept.
	// It must comfortably exceed the longest outage in which a node can come
	// back with an unflushed write-ahead log.
	batchQuotaJournalRetentionDays = 7
)

// batchOutboxRecord is one line of the append-only quota write-ahead log.
type batchOutboxRecord struct {
	Kind  string `json:"kind"`
	Batch string `json:"batch"`
	Type  int    `json:"type,omitempty"`
	Id    int    `json:"id,omitempty"`
	Value int    `json:"value,omitempty"`
}

// batchOutbox is the process-local, fsynced staging area for batch quota deltas.
// A batch is staged here before any balance is touched in the database, so a
// crash between two flush intervals replays the deltas instead of losing them.
type batchOutbox struct {
	mu      sync.Mutex
	path    string
	pending map[string]struct{}
}

// batchOutboxBatch is one staged batch reconstructed from the write-ahead log.
type batchOutboxBatch struct {
	id     string
	stores []map[int]int
}

// batchOutboxFile holds the uncommitted batches of one write-ahead log file.
type batchOutboxFile struct {
	path    string
	batches []*batchOutboxBatch
}

var (
	batchOutboxLock     sync.Mutex
	batchOutboxInstance *batchOutbox
	batchOutboxInitErr  error
	batchOutboxReady    bool
)

// batchOutboxDir returns the directory holding the quota write-ahead logs. It
// must survive process restarts (and ideally live on the same volume as the
// database), so it defaults to the application log directory.
func batchOutboxDir() string {
	if dir := strings.TrimSpace(os.Getenv("BATCH_UPDATE_OUTBOX_DIR")); dir != "" {
		return dir
	}
	if common.LogDir != nil && strings.TrimSpace(*common.LogDir) != "" {
		return *common.LogDir
	}
	return "logs"
}

func batchOutboxFileName() string {
	host := "node"
	if name, err := os.Hostname(); err == nil && strings.TrimSpace(name) != "" {
		host = name
	}
	var safe strings.Builder
	for _, r := range host {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '-', r == '_':
			safe.WriteRune(r)
		}
	}
	if safe.Len() == 0 {
		safe.WriteString("node")
	}
	return fmt.Sprintf("%s%s-%d%s", batchOutboxFilePrefix, safe.String(), os.Getpid(), batchOutboxFileSuffix)
}

func openBatchOutbox(dir string) (*batchOutbox, error) {
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, err
	}
	return &batchOutbox{
		path:    filepath.Join(dir, batchOutboxFileName()),
		pending: make(map[string]struct{}),
	}, nil
}

// getBatchOutbox returns the process write-ahead log, opening it on first use.
func getBatchOutbox() (*batchOutbox, error) {
	batchOutboxLock.Lock()
	defer batchOutboxLock.Unlock()
	if batchOutboxReady {
		return batchOutboxInstance, batchOutboxInitErr
	}
	batchOutboxReady = true
	batchOutboxInstance, batchOutboxInitErr = openBatchOutbox(batchOutboxDir())
	if batchOutboxInitErr != nil {
		common.SysError(common.LogText("failed to open the batch quota outbox in %s: %s", batchOutboxDir(), batchOutboxInitErr.Error()))
	}
	return batchOutboxInstance, batchOutboxInitErr
}

// resetBatchOutbox drops the cached handle so the next use opens the directory
// named by BATCH_UPDATE_OUTBOX_DIR. Tests use it to keep state per test.
func resetBatchOutbox() {
	batchOutboxLock.Lock()
	defer batchOutboxLock.Unlock()
	batchOutboxInstance = nil
	batchOutboxInitErr = nil
	batchOutboxReady = false
}

func (o *batchOutbox) appendRecords(records []batchOutboxRecord) error {
	var buffer strings.Builder
	for _, record := range records {
		line, err := common.Marshal(record)
		if err != nil {
			return err
		}
		buffer.Write(line)
		buffer.WriteByte('\n')
	}
	file, err := os.OpenFile(o.path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return err
	}
	if _, err := file.WriteString(buffer.String()); err != nil {
		file.Close()
		return err
	}
	if err := file.Sync(); err != nil {
		file.Close()
		return err
	}
	return file.Close()
}

// stage durably records a batch before it is applied. The caller still owns the
// in-memory deltas and keeps them until this returns nil.
func (o *batchOutbox) stage(batchID string, stores []map[int]int) error {
	records := make([]batchOutboxRecord, 0, 1+len(stores))
	records = append(records, batchOutboxRecord{Kind: batchOutboxRecordBegin, Batch: batchID})
	for type_ := range stores {
		for id, value := range stores[type_] {
			if value == 0 {
				continue
			}
			records = append(records, batchOutboxRecord{
				Kind:  batchOutboxRecordEntry,
				Batch: batchID,
				Type:  type_,
				Id:    id,
				Value: value,
			})
		}
	}
	if err := o.appendRecords(records); err != nil {
		return err
	}
	o.mu.Lock()
	o.pending[batchID] = struct{}{}
	o.mu.Unlock()
	return nil
}

// commit marks a staged batch as applied and compacts the log once nothing is
// left to replay. A commit that cannot be written is harmless: the journal
// marker already proves the batch was applied, so a later replay is skipped.
func (o *batchOutbox) commit(batchID string) error {
	err := o.appendRecords([]batchOutboxRecord{{Kind: batchOutboxRecordCommit, Batch: batchID}})
	o.mu.Lock()
	delete(o.pending, batchID)
	empty := len(o.pending) == 0
	o.mu.Unlock()
	if !empty {
		return err
	}
	if truncateErr := o.truncate(); truncateErr != nil {
		return errors.Join(err, truncateErr)
	}
	return err
}

func (o *batchOutbox) truncate() error {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.pending = make(map[string]struct{})
	if err := os.Truncate(o.path, 0); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// scan reads every write-ahead log in the outbox directory and returns the
// batches that were staged but never committed.
func (o *batchOutbox) scan() ([]batchOutboxFile, error) {
	paths, err := filepath.Glob(filepath.Join(filepath.Dir(o.path), batchOutboxFilePrefix+"*"+batchOutboxFileSuffix))
	if err != nil {
		return nil, err
	}
	files := make([]batchOutboxFile, 0, len(paths))
	for _, path := range paths {
		file, readErr := readBatchOutboxFile(path)
		if readErr != nil {
			common.SysError(common.LogText("failed to read the batch quota outbox %s: %s", path, readErr.Error()))
			continue
		}
		if len(file.batches) > 0 {
			files = append(files, file)
		}
	}
	return files, nil
}

func readBatchOutboxFile(path string) (batchOutboxFile, error) {
	file := batchOutboxFile{path: path}
	handle, err := os.Open(path)
	if err != nil {
		return file, err
	}
	defer handle.Close()

	pending := make(map[string]*batchOutboxBatch)
	committed := make(map[string]struct{})
	order := make([]string, 0)
	scanner := bufio.NewScanner(handle)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var record batchOutboxRecord
		if err := common.Unmarshal([]byte(line), &record); err != nil {
			// A torn trailing line is the normal shape of a crash mid-write.
			// Stop instead of replaying a partial record.
			break
		}
		switch record.Kind {
		case batchOutboxRecordBegin:
			if _, ok := pending[record.Batch]; ok {
				continue
			}
			pending[record.Batch] = &batchOutboxBatch{
				id:     record.Batch,
				stores: make([]map[int]int, BatchUpdateTypeCount),
			}
			order = append(order, record.Batch)
		case batchOutboxRecordEntry:
			batch, ok := pending[record.Batch]
			if !ok || record.Type < 0 || record.Type >= BatchUpdateTypeCount {
				continue
			}
			if batch.stores[record.Type] == nil {
				batch.stores[record.Type] = make(map[int]int)
			}
			batch.stores[record.Type][record.Id] += record.Value
		case batchOutboxRecordCommit:
			delete(pending, record.Batch)
			committed[record.Batch] = struct{}{}
		}
	}
	if err := scanner.Err(); err != nil {
		return file, err
	}
	for _, id := range order {
		if _, done := committed[id]; done {
			continue
		}
		if batch, ok := pending[id]; ok {
			file.batches = append(file.batches, batch)
		}
	}
	return file, nil
}

// RecoverBatchOutbox replays quota deltas that a previous process staged but did
// not confirm. It must run after the database is initialized and before new
// relay traffic is served.
func RecoverBatchOutbox() {
	outbox, err := getBatchOutbox()
	if err != nil || outbox == nil {
		return
	}
	files, err := outbox.scan()
	if err != nil {
		common.SysError(common.LogText("failed to scan the batch quota outbox: %s", err.Error()))
		return
	}
	for _, file := range files {
		unreplayed := 0
		for _, batch := range file.batches {
			applyErr := applyBatchQuotaDeltas(batch.id, batch.stores)
			if applyErr != nil && !errors.Is(applyErr, errBatchAlreadyApplied) {
				common.SysError(common.LogText("failed to replay the batch quota outbox %s: %s", batch.id, applyErr.Error()))
				enqueueBatchUpdateRetry(outbox, batch)
				unreplayed++
			}
		}
		if unreplayed > 0 {
			// The log keeps the records so the next attempt stays durable.
			continue
		}
		if file.path == outbox.path {
			if truncateErr := outbox.truncate(); truncateErr != nil {
				common.SysError(common.LogText("failed to compact the batch quota outbox %s: %s", file.path, truncateErr.Error()))
			}
			continue
		}
		if removeErr := os.Remove(file.path); removeErr != nil && !os.IsNotExist(removeErr) {
			common.SysError(common.LogText("failed to remove the replayed batch quota outbox %s: %s", file.path, removeErr.Error()))
		}
	}
	pruneBatchQuotaJournal()
}

// applyBatchQuotaDeltas commits one batch atomically: every delta and the
// journal marker are written in a single transaction, so a batch is applied
// exactly once even when it is replayed after a crash.
func applyBatchQuotaDeltas(batchID string, stores []map[int]int) error {
	err := DB.Transaction(func(tx *gorm.DB) error {
		var applied int64
		if err := tx.Model(&BatchQuotaJournal{}).Where("batch_id = ?", batchID).Count(&applied).Error; err != nil {
			return err
		}
		if applied > 0 {
			return errBatchAlreadyApplied
		}
		for id, delta := range stores[BatchUpdateTypeTokenQuota] {
			if delta == 0 {
				continue
			}
			if err := applyTokenQuotaDelta(tx, id, delta); err != nil {
				return err
			}
		}
		for id, delta := range stores[BatchUpdateTypeChannelUsedQuota] {
			if delta == 0 {
				continue
			}
			if err := applyChannelUsedQuotaDelta(tx, id, delta); err != nil {
				return err
			}
		}
		userIDs := make(map[int]struct{}, len(stores[BatchUpdateTypeUserQuota])+len(stores[BatchUpdateTypeUsedQuota]))
		for id := range stores[BatchUpdateTypeUserQuota] {
			userIDs[id] = struct{}{}
		}
		for id := range stores[BatchUpdateTypeUsedQuota] {
			userIDs[id] = struct{}{}
		}
		for id := range stores[BatchUpdateTypeRequestCount] {
			userIDs[id] = struct{}{}
		}
		for id := range userIDs {
			if err := updateUserQuotaUsedQuotaAndRequestCount(tx, id,
				stores[BatchUpdateTypeUserQuota][id],
				stores[BatchUpdateTypeUsedQuota][id],
				stores[BatchUpdateTypeRequestCount][id],
			); err != nil {
				return err
			}
		}
		return tx.Create(&BatchQuotaJournal{BatchId: batchID, AppliedAt: common.GetTimestamp()}).Error
	})
	if err == nil {
		return nil
	}
	// A concurrent replay of the same write-ahead record may have won the race
	// and committed first; that is a success, not a duplicate debit.
	var applied int64
	if countErr := DB.Model(&BatchQuotaJournal{}).Where("batch_id = ?", batchID).Count(&applied).Error; countErr == nil && applied > 0 {
		return errBatchAlreadyApplied
	}
	return err
}

func applyTokenQuotaDelta(tx *gorm.DB, id int, delta int) error {
	return tx.Model(&Token{}).Where("id = ?", id).Updates(map[string]any{
		"remain_quota":  gorm.Expr("remain_quota + ?", delta),
		"used_quota":    gorm.Expr("used_quota - ?", delta),
		"accessed_time": common.GetTimestamp(),
	}).Error
}

func applyChannelUsedQuotaDelta(tx *gorm.DB, id int, delta int) error {
	return tx.Model(&Channel{}).Where("id = ?", id).
		Update("used_quota", gorm.Expr("used_quota + ?", delta)).Error
}

func pruneBatchQuotaJournal() {
	cutoff := common.GetTimestamp() - int64(batchQuotaJournalRetentionDays)*24*60*60
	if err := DB.Where("applied_at < ?", cutoff).Delete(&BatchQuotaJournal{}).Error; err != nil {
		common.SysError(common.LogText("failed to prune the batch quota journal: %s", err.Error()))
	}
}

// newBatchID returns an identifier that is unique across nodes and restarts.
func newBatchID() string {
	return fmt.Sprintf("%d-%s", time.Now().UnixNano(), common.GetRandomString(12))
}
