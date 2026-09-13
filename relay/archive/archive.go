package archive

import (
	"bufio"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	rootcommon "github.com/QuantumNous/new-api/common"
)

const (
	DefaultMaxFileSize int64 = 100 * 1024 * 1024
	archiveMagic             = "NEWAPI-CLAUDE-ARCHIVE-1\x00"
	redactedValue            = "[REDACTED]"
)

var targetModels = map[string]struct{}{
	"claude-opus-4-8": {}, "claude-opus-5": {}, "claude-fable-5": {}, "claude-fable-5-1": {},
}

type Config struct {
	Enabled     bool
	Directory   string
	MaxFileSize int64
	SyncOnWrite bool
}

var defaultManager = NewManager(Config{
	Enabled:     rootcommon.GetEnvOrDefaultBool("CLAUDE_ARCHIVE_ENABLED", false),
	Directory:   rootcommon.GetEnvOrDefaultString("CLAUDE_ARCHIVE_DIR", "data/claude-archive"),
	MaxFileSize: int64(rootcommon.GetEnvOrDefault("CLAUDE_ARCHIVE_MAX_FILE_MB", 100)) * 1024 * 1024,
	SyncOnWrite: rootcommon.GetEnvOrDefaultBool("CLAUDE_ARCHIVE_SYNC", false),
})

func DefaultManager() *Manager { return defaultManager }

type Metadata struct {
	RequestID string    `json:"request_id"`
	ChannelID int       `json:"channel_id"`
	Model     string    `json:"model"`
	StartedAt time.Time `json:"started_at"`
}

type Record struct {
	Metadata        Metadata
	StatusCode      int
	Complete        bool
	RequestHeaders  http.Header
	RequestBody     []byte
	ResponseHeaders http.Header
	ResponseBody    []byte
}

type recordHeader struct {
	Metadata        Metadata    `json:"metadata"`
	StatusCode      int         `json:"status_code"`
	Complete        bool        `json:"complete"`
	RequestHeaders  http.Header `json:"request_headers"`
	ResponseHeaders http.Header `json:"response_headers"`
	RequestSize     int64       `json:"request_size"`
	ResponseSize    int64       `json:"response_size"`
}

type fileState struct {
	mu       sync.Mutex
	file     *os.File
	size     int64
	sequence int
}
type Manager struct {
	config Config
	mu     sync.Mutex
	files  map[int]*fileState
}
type Session struct {
	manager                         *Manager
	metadata                        Metadata
	requestFile, responseFile       *os.File
	requestSize, responseSize       int64
	statusCode                      int
	requestHeaders, responseHeaders http.Header
	complete                        bool
	closed                          bool
	mu                              sync.Mutex
}
type captureReader struct {
	io.ReadCloser
	writer  io.Writer
	onClose func(bool) error
	onWrite func(int)
	sawEOF  bool
	once    sync.Once
}

func IsTargetModel(model string) bool { _, ok := targetModels[model]; return ok }

func NewManager(config Config) *Manager {
	if config.MaxFileSize <= 0 {
		config.MaxFileSize = DefaultMaxFileSize
	}
	return &Manager{config: config, files: make(map[int]*fileState)}
}

func (manager *Manager) Begin(metadata Metadata) (*Session, error) {
	if manager == nil || !manager.config.Enabled || metadata.ChannelID <= 0 || !IsTargetModel(metadata.Model) {
		return nil, nil
	}
	if metadata.StartedAt.IsZero() {
		metadata.StartedAt = time.Now().UTC()
	}
	if err := os.MkdirAll(manager.config.Directory, 0700); err != nil {
		return nil, fmt.Errorf("create archive directory: %w", err)
	}
	requestFile, err := os.CreateTemp(manager.config.Directory, ".request-*")
	if err != nil {
		return nil, fmt.Errorf("create request spool: %w", err)
	}
	responseFile, err := os.CreateTemp(manager.config.Directory, ".response-*")
	if err != nil {
		_ = requestFile.Close()
		_ = os.Remove(requestFile.Name())
		return nil, fmt.Errorf("create response spool: %w", err)
	}
	return &Session{manager: manager, metadata: metadata, requestFile: requestFile, responseFile: responseFile}, nil
}

func (session *Session) WrapRequestBody(body io.ReadCloser) io.ReadCloser {
	return &captureReader{ReadCloser: body, writer: session.requestFile, onWrite: func(size int) { session.requestSize += int64(size) }}
}

func (session *Session) WrapResponseBody(body io.ReadCloser, statusCode int, requestHeaders, responseHeaders http.Header) io.ReadCloser {
	session.statusCode = statusCode
	session.requestHeaders = RedactHeaders(requestHeaders)
	session.responseHeaders = RedactHeaders(responseHeaders)
	return &captureReader{ReadCloser: body, writer: session.responseFile, onWrite: func(size int) { session.responseSize += int64(size) }, onClose: session.commit}
}

func (reader *captureReader) Read(data []byte) (int, error) {
	readSize, readErr := reader.ReadCloser.Read(data)
	if errors.Is(readErr, io.EOF) {
		reader.sawEOF = true
	}
	if readSize == 0 {
		return readSize, readErr
	}
	writtenSize, writeErr := reader.writer.Write(data[:readSize])
	reader.onWrite(writtenSize)
	if writeErr != nil {
		return readSize, errors.Join(readErr, writeErr)
	}
	if writtenSize != readSize {
		return readSize, errors.Join(readErr, io.ErrShortWrite)
	}
	return readSize, readErr
}

func (reader *captureReader) Close() error {
	closeErr := reader.ReadCloser.Close()
	var archiveErr error
	reader.once.Do(func() {
		if reader.onClose != nil {
			archiveErr = reader.onClose(reader.sawEOF)
		}
	})
	if archiveErr != nil {
		rootcommon.SysError("failed to archive Claude relay: " + archiveErr.Error())
	}
	return closeErr
}

func (session *Session) Abort() {
	if session == nil {
		return
	}
	session.mu.Lock()
	defer session.mu.Unlock()
	if session.closed {
		return
	}
	session.closed = true
	session.cleanup()
}

func (session *Session) commit(complete bool) error {
	session.mu.Lock()
	defer session.mu.Unlock()
	if session.closed {
		return nil
	}
	session.closed = true
	session.complete = complete
	defer session.cleanup()
	if err := session.requestFile.Sync(); err != nil {
		return err
	}
	if err := session.responseFile.Sync(); err != nil {
		return err
	}
	if _, err := session.requestFile.Seek(0, io.SeekStart); err != nil {
		return err
	}
	if _, err := session.responseFile.Seek(0, io.SeekStart); err != nil {
		return err
	}
	return session.manager.write(session)
}

func (session *Session) cleanup() {
	_ = session.requestFile.Close()
	_ = session.responseFile.Close()
	_ = os.Remove(session.requestFile.Name())
	_ = os.Remove(session.responseFile.Name())
}

func RedactHeaders(headers http.Header) http.Header {
	result := make(http.Header, len(headers))
	for key, values := range headers {
		copiedValues := append([]string(nil), values...)
		if isSensitiveHeader(key) {
			for index := range copiedValues {
				copiedValues[index] = redactedValue
			}
		}
		result[key] = copiedValues
	}
	return result
}

func isSensitiveHeader(key string) bool {
	lowerKey := strings.ToLower(key)
	return lowerKey == "authorization" || lowerKey == "proxy-authorization" || lowerKey == "x-api-key" || lowerKey == "x-goog-api-key" || lowerKey == "cookie" || lowerKey == "set-cookie" || strings.Contains(lowerKey, "api-key")
}

func (manager *Manager) write(session *Session) error {
	headerBytes, err := rootcommon.Marshal(recordHeader{Metadata: session.metadata, StatusCode: session.statusCode, Complete: session.complete, RequestHeaders: session.requestHeaders, ResponseHeaders: session.responseHeaders, RequestSize: session.requestSize, ResponseSize: session.responseSize})
	if err != nil {
		return err
	}
	recordSize := int64(len(archiveMagic)+4+8+8+len(headerBytes)) + session.requestSize + session.responseSize
	state := manager.channelState(session.metadata.ChannelID)
	state.mu.Lock()
	defer state.mu.Unlock()
	if state.file == nil {
		if err = manager.open(state, session.metadata.ChannelID); err != nil {
			return err
		}
	}
	if state.size > 0 && state.size+recordSize > manager.config.MaxFileSize {
		_ = state.file.Close()
		state.file = nil
		state.size = 0
		state.sequence++
		if err = manager.open(state, session.metadata.ChannelID); err != nil {
			return err
		}
	}
	if err = writeFrame(state.file, headerBytes, session); err != nil {
		return err
	}
	state.size += recordSize
	if manager.config.SyncOnWrite {
		return state.file.Sync()
	}
	return nil
}

func (manager *Manager) channelState(channelID int) *fileState {
	manager.mu.Lock()
	defer manager.mu.Unlock()
	state := manager.files[channelID]
	if state == nil {
		state = &fileState{sequence: nextSequence(manager.config.Directory, channelID)}
		manager.files[channelID] = state
	}
	return state
}

func writeFrame(writer io.Writer, headerBytes []byte, session *Session) error {
	if _, err := io.WriteString(writer, archiveMagic); err != nil {
		return err
	}
	for _, value := range []any{uint32(len(headerBytes)), uint64(session.requestSize), uint64(session.responseSize)} {
		if err := binary.Write(writer, binary.BigEndian, value); err != nil {
			return err
		}
	}
	if _, err := writer.Write(headerBytes); err != nil {
		return err
	}
	if _, err := io.Copy(writer, session.requestFile); err != nil {
		return err
	}
	_, err := io.Copy(writer, session.responseFile)
	return err
}

func (manager *Manager) open(state *fileState, channelID int) error {
	path := filepath.Join(manager.config.Directory, fmt.Sprintf("channel-%d-%d.log", channelID, state.sequence))
	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
	if err != nil {
		return err
	}
	info, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return err
	}
	state.file, state.size = file, info.Size()
	return nil
}

func nextSequence(directory string, channelID int) int {
	matches, _ := filepath.Glob(filepath.Join(directory, fmt.Sprintf("channel-%d-*.log", channelID)))
	maximum := 0
	for _, path := range matches {
		parts := strings.Split(strings.TrimSuffix(filepath.Base(path), ".log"), "-")
		sequence, err := strconv.Atoi(parts[len(parts)-1])
		if err == nil && sequence > maximum {
			maximum = sequence
		}
	}
	return maximum + 1
}

func ReadFile(path string) ([]Record, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	reader := bufio.NewReader(file)
	var records []Record
	for {
		magic := make([]byte, len(archiveMagic))
		if _, err = io.ReadFull(reader, magic); errors.Is(err, io.EOF) {
			return records, nil
		} else if err != nil {
			return nil, err
		}
		if string(magic) != archiveMagic {
			return nil, errors.New("invalid archive magic")
		}
		var headerSize uint32
		var requestSize, responseSize uint64
		for _, target := range []any{&headerSize, &requestSize, &responseSize} {
			if err = binary.Read(reader, binary.BigEndian, target); err != nil {
				return nil, err
			}
		}
		headerBytes := make([]byte, headerSize)
		if _, err = io.ReadFull(reader, headerBytes); err != nil {
			return nil, err
		}
		var header recordHeader
		if err = rootcommon.Unmarshal(headerBytes, &header); err != nil {
			return nil, err
		}
		record := Record{Metadata: header.Metadata, StatusCode: header.StatusCode, Complete: header.Complete, RequestHeaders: header.RequestHeaders, ResponseHeaders: header.ResponseHeaders, RequestBody: make([]byte, requestSize), ResponseBody: make([]byte, responseSize)}
		if _, err = io.ReadFull(reader, record.RequestBody); err != nil {
			return nil, err
		}
		if _, err = io.ReadFull(reader, record.ResponseBody); err != nil {
			return nil, err
		}
		records = append(records, record)
	}
}

func (manager *Manager) Close() error {
	manager.mu.Lock()
	defer manager.mu.Unlock()
	var firstError error
	for _, state := range manager.files {
		state.mu.Lock()
		if state.file != nil {
			if err := state.file.Close(); err != nil && firstError == nil {
				firstError = err
			}
			state.file = nil
		}
		state.mu.Unlock()
	}
	return firstError
}
