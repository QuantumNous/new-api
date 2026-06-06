package conversationarchive

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/QuantumNous/new-api/logger"
	"gorm.io/gorm"
)

const (
	jobTableName      = "conversation_archive_jobs"
	jobStatusPending  = "pending"
	jobStatusRunning  = "processing"
	jobStatusFailed   = "failed"
	spoolFileTemplate = "archive-*.raw"
)

type SpoolFile struct {
	Path string
	Size int64
}

type RawRecord struct {
	Kind               ArchiveKind
	SessionID          string
	RequestID          string
	RequestTime        time.Time
	ResponseTime       time.Time
	RequestHeadersFile SpoolFile
	RequestBodyFile    SpoolFile
	ResponseBodyFile   SpoolFile
}

type archiveJob struct {
	ID                 uint64     `gorm:"primaryKey;autoIncrement;index:idx_conversation_archive_jobs_status_id,priority:2"`
	ArchiveKind        string     `gorm:"type:text;not null"`
	TableName          string     `gorm:"column:table_name;type:text;not null;index:idx_conversation_archive_jobs_table_status,priority:1"`
	SessionID          string     `gorm:"type:text;not null"`
	RequestID          string     `gorm:"type:text;not null;default:''"`
	RequestTime        time.Time  `gorm:"not null"`
	ResponseTime       time.Time  `gorm:"not null"`
	RequestHeadersPath string     `gorm:"type:text;not null"`
	RequestBodyPath    string     `gorm:"type:text;not null"`
	ResponseBodyPath   string     `gorm:"type:text;not null"`
	Status             string     `gorm:"type:text;not null;index:idx_conversation_archive_jobs_status_id,priority:1;index:idx_conversation_archive_jobs_table_status,priority:2"`
	Attempts           int        `gorm:"not null;default:0"`
	Error              string     `gorm:"column:error;type:text;not null;default:''"`
	LockedAt           *time.Time `gorm:"index:idx_conversation_archive_jobs_locked_at"`
	CreatedAt          time.Time  `gorm:"not null"`
	UpdatedAt          time.Time  `gorm:"not null"`
}

type SpoolResponseRecorder struct {
	file   *os.File
	path   string
	size   int64
	svc    *service
	err    error
	closed bool
}

func NewSpoolResponseRecorder() (*SpoolResponseRecorder, error) {
	currentMu.RLock()
	svc := current
	currentMu.RUnlock()
	if svc == nil {
		return nil, fmt.Errorf("会话归档未启用")
	}
	file, path, err := svc.createSpoolFile()
	if err != nil {
		return nil, err
	}
	return &SpoolResponseRecorder{file: file, path: path, svc: svc}, nil
}

func WriteSpoolBytes(data []byte) (SpoolFile, error) {
	return WriteSpoolReader(bytes.NewReader(data))
}

func WriteSpoolReader(reader io.Reader) (SpoolFile, error) {
	currentMu.RLock()
	svc := current
	currentMu.RUnlock()
	if svc == nil {
		return SpoolFile{}, fmt.Errorf("会话归档未启用")
	}
	return svc.writeSpoolReader(reader)
}

func EnqueueRaw(record RawRecord) {
	currentMu.RLock()
	svc := current
	currentMu.RUnlock()
	if svc == nil {
		cleanupRawRecordFiles(record)
		return
	}
	if record.SessionID == "" {
		record.SessionID = "unknown"
	}
	if err := svc.enqueueRaw(record); err != nil {
		cleanupRawRecordFiles(record)
		logger.LogWarn(context.Background(), fmt.Sprintf("会话归档异步任务入队失败: %v", err))
	}
}

func CleanupSpoolFiles(files ...SpoolFile) {
	currentMu.RLock()
	svc := current
	currentMu.RUnlock()
	if svc == nil {
		for _, file := range files {
			if file.Path != "" {
				_ = os.Remove(file.Path)
			}
		}
		return
	}
	for _, file := range files {
		svc.cleanupSpoolPath(file.Path)
	}
}

func (r *SpoolResponseRecorder) Write(data []byte) {
	if r == nil || r.closed || len(data) == 0 {
		return
	}
	if r.err != nil {
		return
	}
	n, err := r.file.Write(data)
	r.size += int64(n)
	if err != nil {
		r.err = err
		logger.LogWarn(context.Background(), fmt.Sprintf("会话归档响应写入 spool 失败: %v", err))
	}
}

func (r *SpoolResponseRecorder) Close() (SpoolFile, error) {
	if r == nil {
		return SpoolFile{}, nil
	}
	if !r.closed {
		r.closed = true
		if err := r.file.Close(); err != nil {
			_ = os.Remove(r.path)
			return SpoolFile{}, err
		}
		if r.err != nil {
			_ = os.Remove(r.path)
			return SpoolFile{}, r.err
		}
		if !r.svc.tryAddSpoolBytes(r.size) {
			_ = os.Remove(r.path)
			return SpoolFile{}, fmt.Errorf("会话归档 spool 字节上限已满")
		}
	}
	return SpoolFile{Path: r.path, Size: r.size}, nil
}

func (s *service) createSpoolFile() (*os.File, string, error) {
	if err := os.MkdirAll(s.cfg.SpoolDir, 0755); err != nil {
		return nil, "", err
	}
	file, err := os.CreateTemp(s.cfg.SpoolDir, spoolFileTemplate)
	if err != nil {
		return nil, "", err
	}
	return file, file.Name(), nil
}

func (s *service) writeSpoolReader(reader io.Reader) (SpoolFile, error) {
	file, path, err := s.createSpoolFile()
	if err != nil {
		return SpoolFile{}, err
	}
	size, copyErr := io.Copy(file, reader)
	closeErr := file.Close()
	if copyErr != nil {
		_ = os.Remove(path)
		return SpoolFile{}, copyErr
	}
	if closeErr != nil {
		_ = os.Remove(path)
		return SpoolFile{}, closeErr
	}
	if !s.tryAddSpoolBytes(size) {
		_ = os.Remove(path)
		return SpoolFile{}, fmt.Errorf("会话归档 spool 字节上限已满")
	}
	return SpoolFile{Path: path, Size: size}, nil
}

func (s *service) tryAddSpoolBytes(size int64) bool {
	if size <= 0 {
		return true
	}
	if s.spoolMaxBytes <= 0 {
		s.spoolBytes.Add(size)
		return true
	}
	for {
		current := s.spoolBytes.Load()
		if current+size > s.spoolMaxBytes {
			return false
		}
		if s.spoolBytes.CompareAndSwap(current, current+size) {
			return true
		}
	}
}

func (s *service) releaseSpoolBytes(size int64) {
	if size > 0 {
		s.spoolBytes.Add(-size)
	}
}

func (s *service) scanSpoolBytes() int64 {
	var total int64
	_ = filepath.WalkDir(s.cfg.SpoolDir, func(_ string, d os.DirEntry, err error) error {
		if err != nil || d == nil || d.IsDir() {
			return nil
		}
		info, statErr := d.Info()
		if statErr == nil {
			total += info.Size()
		}
		return nil
	})
	return total
}

func (s *service) ensureJobTable() error {
	s.jobTableOnce.Do(func() {
		s.jobTableErr = s.db.Table(jobTableName).AutoMigrate(&archiveJob{})
	})
	return s.jobTableErr
}

func (s *service) resetProcessingJobs() error {
	if err := s.ensureJobTable(); err != nil {
		return err
	}
	return s.db.Table(jobTableName).
		Where("status = ?", jobStatusRunning).
		Updates(map[string]interface{}{
			"status":     jobStatusPending,
			"locked_at":  nil,
			"updated_at": time.Now(),
		}).Error
}

func (s *service) enqueueRaw(record RawRecord) error {
	if err := s.ensureJobTable(); err != nil {
		return err
	}
	now := time.Now()
	job := archiveJob{
		ArchiveKind:        string(record.Kind.normalized()),
		TableName:          tableNameForRecord(Record{Kind: record.Kind, RequestTime: record.RequestTime, ResponseTime: record.ResponseTime}),
		SessionID:          record.SessionID,
		RequestID:          record.RequestID,
		RequestTime:        record.RequestTime,
		ResponseTime:       record.ResponseTime,
		RequestHeadersPath: record.RequestHeadersFile.Path,
		RequestBodyPath:    record.RequestBodyFile.Path,
		ResponseBodyPath:   record.ResponseBodyFile.Path,
		Status:             jobStatusPending,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
	return s.db.Table(jobTableName).Create(&job).Error
}

func (s *service) compressWorker() {
	poll := time.Duration(s.cfg.JobPollMs) * time.Millisecond
	for {
		currentMu.RLock()
		active := current == s
		currentMu.RUnlock()
		if !active {
			return
		}
		job, ok, err := s.claimJob()
		if err != nil {
			logger.LogWarn(context.Background(), fmt.Sprintf("会话归档领取异步任务失败: %v", err))
			time.Sleep(poll)
			continue
		}
		if !ok {
			time.Sleep(poll)
			continue
		}
		if err := s.processJob(job); err != nil {
			logger.LogWarn(context.Background(), fmt.Sprintf("会话归档异步任务处理失败: %v", err))
			if markErr := s.markJobFailed(job, err); markErr != nil {
				logger.LogWarn(context.Background(), fmt.Sprintf("会话归档异步任务失败状态更新失败: %v", markErr))
			}
		}
	}
}

func (s *service) claimJob() (archiveJob, bool, error) {
	if err := s.ensureJobTable(); err != nil {
		return archiveJob{}, false, err
	}
	for i := 0; i < 3; i++ {
		var job archiveJob
		result := s.db.Table(jobTableName).
			Where("status = ?", jobStatusPending).
			Order("id ASC").
			Limit(1).
			Find(&job)
		if result.Error != nil {
			return archiveJob{}, false, result.Error
		}
		if result.RowsAffected == 0 || job.ID == 0 {
			return archiveJob{}, false, nil
		}
		now := time.Now()
		updates := map[string]interface{}{
			"status":     jobStatusRunning,
			"attempts":   gorm.Expr("attempts + 1"),
			"locked_at":  now,
			"updated_at": now,
		}
		claim := s.db.Table(jobTableName).
			Where("id = ? AND status = ?", job.ID, jobStatusPending).
			Updates(updates)
		if claim.Error != nil {
			return archiveJob{}, false, claim.Error
		}
		if claim.RowsAffected == 0 {
			continue
		}
		if err := s.db.Table(jobTableName).Where("id = ?", job.ID).First(&job).Error; err != nil {
			return archiveJob{}, false, err
		}
		return job, true, nil
	}
	return archiveJob{}, false, nil
}

func (s *service) processJob(job archiveJob) error {
	requestHeadersGzip, err := compressSpoolPath(job.RequestHeadersPath)
	if err != nil {
		return err
	}
	requestBodyGzip, err := compressSpoolPath(job.RequestBodyPath)
	if err != nil {
		return err
	}
	responseBodyGzip, err := compressSpoolPath(job.ResponseBodyPath)
	if err != nil {
		return err
	}
	record := Record{
		Kind:               ArchiveKind(job.ArchiveKind).normalized(),
		SessionID:          job.SessionID,
		RequestID:          job.RequestID,
		RequestTime:        job.RequestTime,
		ResponseTime:       job.ResponseTime,
		RequestHeadersGzip: requestHeadersGzip,
		RequestBodyGzip:    requestBodyGzip,
		ResponseBodyGzip:   responseBodyGzip,
	}
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.insertBatchWithDB(tx, []Record{record}); err != nil {
			return err
		}
		if err := tx.Table(jobTableName).Where("id = ?", job.ID).Delete(&archiveJob{}).Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}
	s.cleanupJobFiles(job)
	s.writtenCount.Add(1)
	return nil
}

func compressSpoolPath(path string) ([]byte, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	return CompressReader(file)
}

func (s *service) markJobFailed(job archiveJob, err error) error {
	status := jobStatusPending
	if job.Attempts >= s.cfg.JobMaxAttempts {
		status = jobStatusFailed
		s.cleanupJobFiles(job)
	}
	return s.db.Table(jobTableName).Where("id = ?", job.ID).Updates(map[string]interface{}{
		"status":     status,
		"error":      err.Error(),
		"locked_at":  nil,
		"updated_at": time.Now(),
	}).Error
}

func (s *service) cleanupJobFiles(job archiveJob) {
	for _, path := range []string{job.RequestHeadersPath, job.RequestBodyPath, job.ResponseBodyPath} {
		s.cleanupSpoolPath(path)
	}
}

func cleanupRawRecordFiles(record RawRecord) {
	currentMu.RLock()
	svc := current
	currentMu.RUnlock()
	if svc == nil {
		for _, file := range []SpoolFile{record.RequestHeadersFile, record.RequestBodyFile, record.ResponseBodyFile} {
			if file.Path != "" {
				_ = os.Remove(file.Path)
			}
		}
		return
	}
	for _, file := range []SpoolFile{record.RequestHeadersFile, record.RequestBodyFile, record.ResponseBodyFile} {
		svc.cleanupSpoolPath(file.Path)
	}
}

func (s *service) cleanupSpoolPath(path string) {
	if path == "" {
		return
	}
	var size int64
	if info, err := os.Stat(path); err == nil {
		size = info.Size()
	}
	if err := os.Remove(path); err == nil {
		s.releaseSpoolBytes(size)
	}
}

func (s *service) waitPendingJobsDrained(tableName string) error {
	if !s.cfg.AsyncCompression {
		return nil
	}
	if err := s.ensureJobTable(); err != nil {
		return err
	}
	timeout := time.Duration(s.cfg.DumpDrainSeconds) * time.Second
	deadline := time.Now().Add(timeout)
	for {
		count, err := s.pendingJobCount(tableName)
		if err != nil {
			return err
		}
		if count == 0 {
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("归档表 %s 仍有 %d 条异步归档任务未处理", tableName, count)
		}
		time.Sleep(time.Second)
	}
}

func (s *service) pendingJobCount(tableName string) (int64, error) {
	var count int64
	err := s.db.Table(jobTableName).
		Where("table_name = ? AND status IN ?", tableName, []string{jobStatusPending, jobStatusRunning}).
		Count(&count).Error
	return count, err
}
