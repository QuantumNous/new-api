package common

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

// BodyFileThreshold is the byte size above which body content is stored to disk
// instead of inline in the consume log's Other JSON. 4KB is a practical cutoff:
// most small JSON responses fit inline, while large ones (conversations, tool
// calls, base64 images) go to disk to avoid bloating the logs table.
const BodyFileThreshold = 4096

// BodyStoragePath is the filesystem directory where large body files are stored.
// Defaults to "data/bodies/" relative to the working directory.
var BodyStoragePath = "data/bodies/"

// BodyFileRetentionDays is the number of days to keep body files before
// automatic cleanup. Directories older than this are deleted. Set to 0
// to disable cleanup (files are kept indefinitely). Default is 7 days.
var BodyFileRetentionDays = 7

var bodyFileMu sync.Mutex

// StoreBodyFile writes body bytes to a date-sharded file under BodyStoragePath
// and returns the relative file path. Empty or nil body returns "".
// The filename is {requestId}_{type}.json.
func StoreBodyFile(requestId string, bodyType string, body []byte) (string, error) {
	if len(body) == 0 || requestId == "" || bodyType == "" {
		return "", nil
	}
	if len(body) <= BodyFileThreshold {
		return "", nil
	}

	bodyFileMu.Lock()
	defer bodyFileMu.Unlock()

	dateDir := time.Now().Format("20060102")
	dir := filepath.Join(BodyStoragePath, dateDir)
	if err := os.MkdirAll(dir, 0750); err != nil {
		return "", fmt.Errorf("body file mkdir: %w", err)
	}

	filename := fmt.Sprintf("%s_%s.json", requestId, bodyType)
	path := filepath.Join(dir, filename)
	if err := os.WriteFile(path, body, 0640); err != nil {
		return "", fmt.Errorf("body file write: %w", err)
	}

	// Return path relative to BodyStoragePath for portability
	relPath := filepath.Join(dateDir, filename)
	return relPath, nil
}

// ReadBodyFile reads a body file stored under BodyStoragePath and returns its
// contents. Returns nil, nil if the file does not exist.
func ReadBodyFile(relPath string) ([]byte, error) {
	if relPath == "" {
		return nil, nil
	}
	fullPath := filepath.Join(BodyStoragePath, relPath)
	data, err := os.ReadFile(fullPath)
	if os.IsNotExist(err) {
		return nil, nil
	}
	return data, err
}

// StoreBodyOrInline writes body bytes to disk if they exceed BodyFileThreshold,
// otherwise returns the body as a string for inline storage. The caller should
// store the returned value (either a file path or raw string) under the
// appropriate Other key.
func StoreBodyOrInline(requestId string, bodyType string, body string) string {
	if body == "" {
		return ""
	}
	if len(body) <= BodyFileThreshold {
		return body
	}
	path, err := StoreBodyFile(requestId, bodyType, []byte(body))
	if err != nil {
		SysError(fmt.Sprintf("failed to store body file %s/%s: %v", requestId, bodyType, err))
		return body // fallback: store inline even if large
	}
	return "file:" + path
}

// CleanupOldBodyFiles removes body file directories older than
// BodyFileRetentionDays. If retention is 0, cleanup is skipped (keep forever).
// The date-sharded structure (data/bodies/YYYYMMDD/) makes this O(directories)
// rather than O(files).
func CleanupOldBodyFiles() {
	if BodyFileRetentionDays <= 0 {
		return
	}

	entries, err := os.ReadDir(BodyStoragePath)
	if err != nil {
		if !os.IsNotExist(err) {
			SysError(fmt.Sprintf("body file cleanup: read dir %s: %v", BodyStoragePath, err))
		}
		return
	}

	cutoff := time.Now().AddDate(0, 0, -BodyFileRetentionDays).Format("20060102")

	// Sort entries so we process oldest first (for logging).
	var dirs []string
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		// Only process directories that match our date format (8 digits).
		if len(e.Name()) == 8 && isAllDigits(e.Name()) {
			dirs = append(dirs, e.Name())
		}
	}
	sort.Strings(dirs)

	var removed int
	for _, dirName := range dirs {
		if dirName >= cutoff {
			// Since dirs are sorted, all remaining are >= cutoff — stop.
			break
		}
		dirPath := filepath.Join(BodyStoragePath, dirName)
		if err := os.RemoveAll(dirPath); err != nil {
			SysError(fmt.Sprintf("body file cleanup: remove %s: %v", dirPath, err))
			continue
		}
		removed++
	}

	if removed > 0 {
		SysLog(fmt.Sprintf("body file cleanup: removed %d directories older than %s", removed, cutoff))
	}
}

func isAllDigits(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// StartBodyFileCleanup launches a background goroutine that periodically
// cleans up old body files. The interval is 1 hour. Call once on startup.
func StartBodyFileCleanup() {
	go func() {
		for {
			time.Sleep(1 * time.Hour)
			CleanupOldBodyFiles()
		}
	}()
}
