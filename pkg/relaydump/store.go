package relaydump

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

const (
	fileSuffix     = ".json"
	writeQueueSize = 256
)

var entryIDPattern = regexp.MustCompile(`^[0-9A-Za-z_-]+$`)

// Entry is the list-view projection of one dump file.
type Entry struct {
	ID          string `json:"id"`
	RequestID   string `json:"request_id"`
	CreatedAt   int64  `json:"created_at"`
	DurationMS  int64  `json:"duration_ms"`
	ChannelID   int    `json:"channel_id"`
	ChannelName string `json:"channel_name"`
	Model       string `json:"model"`
	IsStream    bool   `json:"is_stream"`
	StatusCode  int    `json:"status_code"`
	Error       string `json:"error,omitempty"`
	Size        int64  `json:"size"`
}

var (
	writeQueue   = make(chan *DumpFile, writeQueueSize)
	writeStarted sync.Once
	droppedCount atomic.Int64
)

// enqueueWrite hands the finished capture to the background writer so relay
// goroutines never block on disk.
func enqueueWrite(dump *DumpFile) {
	writeStarted.Do(func() {
		go func() {
			for item := range writeQueue {
				writeDumpFile(item)
			}
		}()
	})
	select {
	case writeQueue <- dump:
	default:
		if n := droppedCount.Add(1); n == 1 || n%100 == 0 {
			common.SysLog(common.LogText("relay dump write queue is full, dropped %d captures total", n))
		}
	}
}

func writeDumpFile(dump *DumpFile) {
	setting := operation_setting.GetRelayDumpSetting()
	if setting == nil {
		return
	}
	dir := setting.ResolvedDirectory()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		common.SysError(common.LogText("relay dump: create directory %s failed: %s", dir, err.Error()))
		return
	}
	data, err := common.Marshal(dump)
	if err != nil {
		common.SysError(common.LogText("relay dump: marshal capture failed: %s", err.Error()))
		return
	}
	id := EntryIDFromMeta(dump.Meta)
	path := filepath.Join(dir, id+fileSuffix)
	// 0600: captures may contain user conversation content.
	if err := os.WriteFile(path, data, 0o600); err != nil {
		common.SysError(common.LogText("relay dump: write %s failed: %s", path, err.Error()))
		return
	}
	enforceRetention(dir, setting.MaxFiles)
}

// enforceRetention deletes the oldest captures beyond the configured limit.
func enforceRetention(dir string, maxFiles int) {
	if maxFiles < 1 {
		return
	}
	names, err := listEntryNames(dir)
	if err != nil {
		return
	}
	if len(names) <= maxFiles {
		return
	}
	for _, name := range names[:len(names)-maxFiles] {
		_ = os.Remove(filepath.Join(dir, name))
	}
}

// listEntryNames returns dump entry file names sorted oldest-first.
func listEntryNames(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), fileSuffix) {
			continue
		}
		if !entryIDPattern.MatchString(strings.TrimSuffix(entry.Name(), fileSuffix)) {
			continue
		}
		names = append(names, entry.Name())
	}
	sort.Strings(names)
	return names, nil
}

// EntryIDFromMeta builds the stable file id for one capture.
func EntryIDFromMeta(meta Meta) string {
	return fmt.Sprintf("%d-%s", meta.CreatedAt, meta.RequestID)
}

// List returns the newest captures, ordered newest-first.
func List(offset int, limit int) ([]Entry, int, error) {
	dir := resolvedDir()
	names, err := listEntryNames(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []Entry{}, 0, nil
		}
		return nil, 0, err
	}
	total := len(names)
	// names are oldest-first; walk backwards for newest-first paging.
	end := total - offset
	if end < 0 {
		return []Entry{}, total, nil
	}
	start := end - limit
	if start < 0 {
		start = 0
	}
	entries := make([]Entry, 0, end-start)
	for i := end - 1; i >= start; i-- {
		entry, ok := readEntry(dir, names[i])
		if !ok {
			continue
		}
		entries = append(entries, entry)
	}
	return entries, total, nil
}

func readEntry(dir string, name string) (Entry, bool) {
	path := filepath.Join(dir, name)
	info, err := os.Stat(path)
	if err != nil {
		return Entry{}, false
	}
	dump, err := Read(entryIDFromFileName(name))
	if err != nil {
		return Entry{}, false
	}
	entry := Entry{
		ID:          entryIDFromFileName(name),
		RequestID:   dump.RequestID,
		CreatedAt:   dump.CreatedAt,
		DurationMS:  dump.DurationMS,
		ChannelID:   dump.ChannelID,
		ChannelName: dump.ChannelName,
		Model:       dump.Model,
		IsStream:    dump.IsStream,
		Error:       dump.Error,
		Size:        info.Size(),
	}
	if dump.Response != nil {
		entry.StatusCode = dump.Response.StatusCode
	}
	return entry, true
}

// Read returns the full dump document for one capture id.
func Read(id string) (*DumpFile, error) {
	if !entryIDPattern.MatchString(id) {
		return nil, fmt.Errorf("invalid relay dump id")
	}
	path := filepath.Join(resolvedDir(), id+fileSuffix)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	dump := &DumpFile{}
	if err := common.Unmarshal(data, dump); err != nil {
		return nil, err
	}
	return dump, nil
}

// Delete removes one capture file.
func Delete(id string) error {
	if !entryIDPattern.MatchString(id) {
		return fmt.Errorf("invalid relay dump id")
	}
	path := filepath.Join(resolvedDir(), id+fileSuffix)
	return os.Remove(path)
}

// Clear removes every capture file.
func Clear() (int, error) {
	dir := resolvedDir()
	names, err := listEntryNames(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}
	removed := 0
	for _, name := range names {
		if err := os.Remove(filepath.Join(dir, name)); err == nil {
			removed++
		}
	}
	return removed, nil
}

func entryIDFromFileName(name string) string {
	return strings.TrimSuffix(name, fileSuffix)
}

// resolvedDir reads the configured directory at call time so setting changes
// take effect immediately.
func resolvedDir() string {
	setting := operation_setting.GetRelayDumpSetting()
	if setting == nil {
		return "relay-dump"
	}
	return setting.ResolvedDirectory()
}

// writeDumpLog prints one capture to the server log. Bodies are already
// truncated to MaxBodyKB.
func writeDumpLog(dump *DumpFile) {
	id := dump.RequestID
	common.SysLog(common.LogText(
		"relay dump %s channel=%d model=%s stream=%t duration_ms=%d status=%d error=%q",
		id, dump.ChannelID, dump.Model, dump.IsStream, dump.DurationMS, responseStatus(dump), dump.Error,
	))
	if dump.Request != nil {
		requestJSON, err := common.Marshal(dump.Request)
		if err == nil {
			common.SysLog(common.LogText("relay dump %s request: %s", id, string(requestJSON)))
		}
	}
	if dump.Response != nil {
		responseJSON, err := common.Marshal(dump.Response)
		if err == nil {
			common.SysLog(common.LogText("relay dump %s response: %s", id, string(responseJSON)))
		}
	}
}

func responseStatus(dump *DumpFile) int {
	if dump.Response != nil {
		return dump.Response.StatusCode
	}
	return 0
}
