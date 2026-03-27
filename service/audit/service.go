package audit

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

type AuditRecord struct {
	RequestID   string                 `json:"request_id"`
	Timestamp   time.Time              `json:"timestamp"`
	TokenKey    string                 `json:"token_key"`
	TokenID     int                    `json:"token_id"`
	UserID      int                    `json:"user_id"`
	UserEmail   string                 `json:"user_email"`
	Model       string                 `json:"model"`
	RelayMode   int                    `json:"relay_mode"`
	RelayFormat string                 `json:"relay_format"`
	RequestBody json.RawMessage        `json:"request_body"`
	Files       []AuditFile            `json:"files,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

type AuditFile struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	Size        int64  `json:"size"`
	Base64Data  string `json:"base64_data,omitempty"`
}

type AuditStorage interface {
	Save(record *AuditRecord) error
	Close() error
}

var (
	auditLogger *AuditLogger
	once        sync.Once
)

type AuditLogger struct {
	storage AuditStorage
	enabled bool
	mu      sync.RWMutex
}

func GetAuditLogger() *AuditLogger {
	once.Do(func() {
		auditLogger = &AuditLogger{
			enabled: operation_setting.IsAuditEnabled(),
		}
		auditLogger.initStorage()
	})
	return auditLogger
}

func (al *AuditLogger) initStorage() {
	al.mu.Lock()
	defer al.mu.Unlock()

	setting := operation_setting.GetAuditSetting()
	switch setting.Mode {
	case operation_setting.AuditModeLocal:
		al.storage = NewLocalStorage()
	case operation_setting.AuditModeRemote:
		al.storage = NewRemoteStorage(setting.RemoteEndpoint, setting.RemoteApiKey, setting.RemoteTimeout)
	default:
		al.storage = nil
	}
}

func (al *AuditLogger) Reload() {
	al.mu.Lock()
	al.enabled = operation_setting.IsAuditEnabled()
	al.mu.Unlock()
	al.initStorage()
}

func (al *AuditLogger) IsEnabled() bool {
	al.mu.RLock()
	defer al.mu.RUnlock()
	return al.enabled && al.storage != nil
}

func (al *AuditLogger) Log(record *AuditRecord) {
	if !al.IsEnabled() {
		return
	}

	go func() {
		defer func() {
			if r := recover(); r != nil {
				common.SysError(fmt.Sprintf("audit log panic: %v", r))
			}
		}()

		al.mu.RLock()
		storage := al.storage
		al.mu.RUnlock()

		if storage != nil {
			if err := storage.Save(record); err != nil {
				common.SysError(fmt.Sprintf("audit log save failed: %v", err))
			}
		}
	}()
}

func (al *AuditLogger) Close() error {
	al.mu.RLock()
	defer al.mu.RUnlock()
	if al.storage != nil {
		return al.storage.Close()
	}
	return nil
}

type LocalStorage struct {
	basePath string
	mu       sync.Mutex
}

func NewLocalStorage() *LocalStorage {
	basePath := filepath.Join("logs", "audit")
	if err := os.MkdirAll(basePath, 0755); err != nil {
		common.SysError(fmt.Sprintf("failed to create audit log directory: %v", err))
	}
	return &LocalStorage{basePath: basePath}
}

func (ls *LocalStorage) Save(record *AuditRecord) error {
	if record == nil {
		return nil
	}

	ls.mu.Lock()
	defer ls.mu.Unlock()

	tokenDir := filepath.Join(ls.basePath, maskTokenKey(record.TokenKey))
	if err := os.MkdirAll(tokenDir, 0755); err != nil {
		return fmt.Errorf("failed to create token directory: %w", err)
	}

	dateFilename := record.Timestamp.Format("2006-01-02") + ".jsonl"
	filePath := filepath.Join(tokenDir, dateFilename)

	data, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("failed to marshal audit record: %w", err)
	}

	f, err := os.OpenFile(filePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("failed to open audit log file: %w", err)
	}
	defer f.Close()

	if _, err := f.Write(append(data, '\n')); err != nil {
		return fmt.Errorf("failed to write audit log: %w", err)
	}

	if len(record.Files) > 0 {
		filesDir := filepath.Join(tokenDir, "files", record.Timestamp.Format("2006-01-02"), record.RequestID)
		if err := os.MkdirAll(filesDir, 0755); err != nil {
			common.SysError(fmt.Sprintf("failed to create files directory: %v", err))
		} else {
			for i, file := range record.Files {
				if file.Base64Data != "" {
					filename := fmt.Sprintf("%d_%s", i, file.Filename)
					filePath := filepath.Join(filesDir, filename)
					decoded, err := decodeBase64(file.Base64Data)
					if err != nil {
						common.SysError(fmt.Sprintf("failed to decode file %s: %v", file.Filename, err))
						continue
					}
					if err := os.WriteFile(filePath, decoded, 0644); err != nil {
						common.SysError(fmt.Sprintf("failed to write file %s: %v", file.Filename, err))
					}
				}
			}
		}
	}

	return nil
}

func (ls *LocalStorage) Close() error {
	return nil
}

func maskTokenKey(key string) string {
	if len(key) <= 8 {
		return "****"
	}
	return key[:4] + "****" + key[len(key)-4:]
}

func decodeBase64(data string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(data)
}

func encodeBase64(data []byte) string {
	return base64.StdEncoding.EncodeToString(data)
}

type RemoteStorage struct {
	endpoint string
	apiKey   string
	timeout  time.Duration
	client   *http.Client
}

func NewRemoteStorage(endpoint, apiKey string, timeoutSeconds int) *RemoteStorage {
	if timeoutSeconds <= 0 {
		timeoutSeconds = 30
	}
	return &RemoteStorage{
		endpoint: strings.TrimSuffix(endpoint, "/"),
		apiKey:   apiKey,
		timeout:  time.Duration(timeoutSeconds) * time.Second,
		client: &http.Client{
			Timeout: time.Duration(timeoutSeconds) * time.Second,
		},
	}
}

func (rs *RemoteStorage) Save(record *AuditRecord) error {
	if record == nil {
		return nil
	}

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	jsonData, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("failed to marshal record: %w", err)
	}

	if err := writer.WriteField("record", string(jsonData)); err != nil {
		return fmt.Errorf("failed to write record field: %w", err)
	}

	for i, file := range record.Files {
		if file.Base64Data == "" {
			continue
		}
		decoded, err := decodeBase64(file.Base64Data)
		if err != nil {
			continue
		}

		part, err := writer.CreateFormFile(fmt.Sprintf("file_%d", i), file.Filename)
		if err != nil {
			continue
		}
		part.Write(decoded)
	}

	if err := writer.Close(); err != nil {
		return fmt.Errorf("failed to close multipart writer: %w", err)
	}

	req, err := http.NewRequest("POST", rs.endpoint+"/api/audit/log", &buf)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())
	if rs.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+rs.apiKey)
	}

	resp, err := rs.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("remote audit service returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

func (rs *RemoteStorage) Close() error {
	return nil
}

func ExtractFilesFromRequest(c interface{}, body []byte) []AuditFile {
	files := make([]AuditFile, 0)

	if ginCtx, ok := c.(*http.Request); ok {
		if ginCtx.MultipartForm != nil {
			for fieldName, fileHeaders := range ginCtx.MultipartForm.File {
				for _, fh := range fileHeaders {
					file, err := fh.Open()
					if err != nil {
						continue
					}
					data, err := io.ReadAll(file)
					file.Close()
					if err != nil {
						continue
					}

					setting := operation_setting.GetAuditSetting()
					if int64(len(data)) > setting.MaxFileSize {
						continue
					}

					files = append(files, AuditFile{
						Filename:    fh.Filename,
						ContentType: fh.Header.Get("Content-Type"),
						Size:        int64(len(data)),
						Base64Data:  encodeBase64(data),
					})
				}
				_ = fieldName
			}
		}
	}

	return files
}

func CleanupOldAuditLogs() {
	setting := operation_setting.GetAuditSetting()
	if setting.RetentionDays <= 0 {
		return
	}

	cutoff := time.Now().AddDate(0, 0, -setting.RetentionDays)
	auditDir := filepath.Join("logs", "audit")

	entries, err := os.ReadDir(auditDir)
	if err != nil {
		return
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		tokenDir := filepath.Join(auditDir, entry.Name())
		dateEntries, err := os.ReadDir(tokenDir)
		if err != nil {
			continue
		}

		for _, dateEntry := range dateEntries {
			if dateEntry.IsDir() {
				continue
			}

			if strings.HasSuffix(dateEntry.Name(), ".jsonl") {
				dateStr := strings.TrimSuffix(dateEntry.Name(), ".jsonl")
				fileTime, err := time.Parse("2006-01-02", dateStr)
				if err != nil {
					continue
				}

				if fileTime.Before(cutoff) {
					filePath := filepath.Join(tokenDir, dateEntry.Name())
					if err := os.Remove(filePath); err != nil {
						common.SysError(fmt.Sprintf("failed to remove old audit log %s: %v", filePath, err))
					}
				}
			}
		}
	}
}
