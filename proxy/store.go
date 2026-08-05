package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"gorm.io/gorm"
)

const (
	flushRetryAttempts = 3
	spoolFileSuffix    = ".jsonl"
	spoolClaimSuffix   = ".replaying"
)

// Store persists audit records without ever blocking the relay path: callers
// enqueue into a bounded channel, a single worker batches the inserts, and any
// batch that cannot reach the database is spooled to disk and replayed later.
type Store struct {
	db  *gorm.DB
	cfg StoreConfig

	records chan *PromptAuditLog
	done    chan struct{}
	wg      sync.WaitGroup

	dropped atomic.Int64
	spooled atomic.Int64
	written atomic.Int64

	spoolMu sync.Mutex
}

func NewStore(db *gorm.DB, cfg StoreConfig) (*Store, error) {
	if err := os.MkdirAll(cfg.SpoolDir, 0o750); err != nil {
		return nil, fmt.Errorf("create spool dir %s: %w", cfg.SpoolDir, err)
	}
	return &Store{
		db:      db,
		cfg:     cfg,
		records: make(chan *PromptAuditLog, cfg.BufferSize),
		done:    make(chan struct{}),
	}, nil
}

func (s *Store) Start() {
	s.wg.Add(2)
	go s.worker()
	go s.replayLoop()
}

// Enqueue hands a record to the writer. It never blocks: when the buffer is
// saturated the record is counted as dropped and reported, because stalling a
// relay request to wait on auditing is never the right trade.
func (s *Store) Enqueue(record *PromptAuditLog) bool {
	select {
	case s.records <- record:
		return true
	default:
		if dropped := s.dropped.Add(1); dropped%100 == 1 {
			log.Printf("proxy: audit buffer saturated, %d record(s) dropped so far", dropped)
		}
		return false
	}
}

// HasCapacity reports whether the buffer can currently accept a record. It is
// used by compliance mode (fail_open: false) to reject a request up front rather
// than forward traffic it could not audit.
func (s *Store) HasCapacity() bool {
	return len(s.records) < cap(s.records)
}

func (s *Store) Close() {
	close(s.done)
	s.wg.Wait()
}

func (s *Store) Stats() map[string]int64 {
	return map[string]int64{
		"queued":  int64(len(s.records)),
		"written": s.written.Load(),
		"spooled": s.spooled.Load(),
		"dropped": s.dropped.Load(),
	}
}

func (s *Store) worker() {
	defer s.wg.Done()

	ticker := time.NewTicker(time.Duration(s.cfg.FlushIntervalMs) * time.Millisecond)
	defer ticker.Stop()

	batch := make([]*PromptAuditLog, 0, s.cfg.BatchSize)
	for {
		select {
		case record := <-s.records:
			batch = append(batch, record)
			if len(batch) >= s.cfg.BatchSize {
				s.flush(batch)
				batch = batch[:0]
			}
		case <-ticker.C:
			if len(batch) > 0 {
				s.flush(batch)
				batch = batch[:0]
			}
		case <-s.done:
		drain:
			for {
				select {
				case record := <-s.records:
					batch = append(batch, record)
					if len(batch) >= s.cfg.BatchSize {
						s.flush(batch)
						batch = batch[:0]
					}
				default:
					break drain
				}
			}
			if len(batch) > 0 {
				s.flush(batch)
			}
			return
		}
	}
}

// flush writes a batch, retrying transient database failures before falling back
// to the on-disk spool. Retries reset the primary keys so GORM treats every
// attempt as a fresh insert; a batch that was partially committed before failing
// can therefore produce duplicates. That is the deliberate trade — for an audit
// trail, a duplicate row is recoverable and a missing row is not.
//
// A nil db means the process started in spool-only mode, so the batch goes
// straight to disk.
func (s *Store) flush(batch []*PromptAuditLog) {
	if len(batch) == 0 {
		return
	}

	lastErr := errors.New("no audit database connection")
	for attempt := 1; s.db != nil && attempt <= flushRetryAttempts; attempt++ {
		for _, record := range batch {
			record.Id = 0
		}
		lastErr = s.db.CreateInBatches(batch, len(batch)).Error
		if lastErr == nil {
			s.written.Add(int64(len(batch)))
			return
		}
		time.Sleep(time.Duration(attempt) * 200 * time.Millisecond)
	}

	// The batch failed as a unit, but usually only one record is at fault (an
	// oversized prompt, say). Retry row by row so a single bad record cannot cost
	// every other record that happened to share its batch.
	failed := make([]*PromptAuditLog, 0, len(batch))
	for _, record := range batch {
		if s.db == nil {
			failed = append(failed, record)
			continue
		}
		record.Id = 0
		if err := s.db.Create(record).Error; err != nil {
			log.Printf("proxy: record rejected (path=%s status=%d prompt=%dB raw=%dB): %v",
				record.Path, record.StatusCode, len(record.PromptText), len(record.RawBody), err)
			failed = append(failed, record)
			continue
		}
		s.written.Add(1)
	}
	if len(failed) == 0 {
		log.Printf("proxy: batch insert failed (%v) but all %d record(s) succeeded individually",
			lastErr, len(batch))
		return
	}

	log.Printf("proxy: cannot write %d of %d record(s) to the database (%v); spooling",
		len(failed), len(batch), lastErr)
	if err := s.spool(failed); err != nil {
		log.Printf("proxy: spool failed, %d record(s) lost: %v", len(failed), err)
		s.dropped.Add(int64(len(failed)))
		return
	}
	s.spooled.Add(int64(len(failed)))
}

func (s *Store) spool(batch []*PromptAuditLog) error {
	s.spoolMu.Lock()
	defer s.spoolMu.Unlock()

	path := filepath.Join(s.cfg.SpoolDir, fmt.Sprintf("%d%s", time.Now().UnixNano(), spoolFileSuffix))
	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := bufio.NewWriter(file)
	for _, record := range batch {
		record.Id = 0
		line, err := json.Marshal(record)
		if err != nil {
			return err
		}
		if _, err := writer.Write(line); err != nil {
			return err
		}
		if err := writer.WriteByte('\n'); err != nil {
			return err
		}
	}
	if err := writer.Flush(); err != nil {
		return err
	}
	return file.Sync()
}

func (s *Store) replayLoop() {
	defer s.wg.Done()

	ticker := time.NewTicker(time.Duration(s.cfg.SpoolReplaySecond) * time.Second)
	defer ticker.Stop()

	s.replayOnce()
	for {
		select {
		case <-ticker.C:
			s.replayOnce()
		case <-s.done:
			return
		}
	}
}

func (s *Store) replayOnce() {
	if s.db == nil {
		return
	}
	entries, err := os.ReadDir(s.cfg.SpoolDir)
	if err != nil {
		log.Printf("proxy: cannot read spool dir %s: %v", s.cfg.SpoolDir, err)
		return
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), spoolFileSuffix) {
			continue
		}
		path := filepath.Join(s.cfg.SpoolDir, entry.Name())
		// Claim the file by renaming it so a later pass cannot pick it up while
		// this one is still replaying.
		claimed := path + spoolClaimSuffix
		if err := os.Rename(path, claimed); err != nil {
			continue
		}
		count, err := s.replayFile(claimed)
		if err != nil {
			log.Printf("proxy: replay of %s failed, will retry: %v", entry.Name(), err)
			if renameErr := os.Rename(claimed, path); renameErr != nil {
				log.Printf("proxy: cannot restore spool file %s: %v", claimed, renameErr)
			}
			continue
		}
		if err := os.Remove(claimed); err != nil {
			log.Printf("proxy: cannot remove replayed spool file %s: %v", claimed, err)
		}
		log.Printf("proxy: replayed %d spooled record(s) from %s", count, entry.Name())
	}
}

func (s *Store) replayFile(path string) (int, error) {
	file, err := os.Open(path)
	if err != nil {
		return 0, err
	}
	defer file.Close()

	records := make([]*PromptAuditLog, 0, s.cfg.BatchSize)
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 0, 64*1024), 16*1024*1024)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		record := &PromptAuditLog{}
		if err := json.Unmarshal(line, record); err != nil {
			log.Printf("proxy: skipping corrupt spool line in %s: %v", path, err)
			continue
		}
		record.Id = 0
		records = append(records, record)
	}
	if err := scanner.Err(); err != nil {
		return 0, err
	}
	if len(records) == 0 {
		return 0, nil
	}
	if err := s.db.CreateInBatches(records, s.cfg.BatchSize).Error; err != nil {
		return 0, err
	}
	s.written.Add(int64(len(records)))
	return len(records), nil
}
