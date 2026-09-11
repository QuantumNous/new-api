package langfuse

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const defaultHost = "https://cloud.langfuse.com"

var defaultReporter atomic.Pointer[Reporter]

// Config controls Langfuse reporting and content capture behavior.
type Config struct {
	Enabled         bool
	Host            string
	PublicKey       string
	SecretKey       string
	SampleRate      float64
	Timeout         time.Duration
	QueueSize       int
	BatchSize       int
	CaptureContent  bool
	ContentMaxBytes int
	FlushInterval   time.Duration
	HTTPClient      *http.Client
}

// Event is the normalized gateway event sent to Langfuse.
type Event struct {
	RequestID    string
	TraceID      string
	SessionID    string
	ProjectID    string
	UserID       string
	Model        string
	InputTokens  int
	OutputTokens int
	TotalTokens  int
	Quota        int
	DurationMS   int
	IsStream     bool
	Status       string
	Error        string
	Metadata     map[string]any
	Input        any
	Output       any
}

// Reporter asynchronously batches and sends gateway events to Langfuse.
type Reporter struct {
	config    Config
	client    *http.Client
	queue     chan Event
	flush     chan chan struct{}
	done      chan struct{}
	stop      chan struct{}
	wg        sync.WaitGroup
	once      sync.Once
	stateMu   sync.Mutex
	workerCtx context.Context
	cancel    context.CancelFunc
	closed    atomic.Bool
	dropped   atomic.Uint64
	sent      atomic.Uint64
	failed    atomic.Uint64
}

// SetDefaultReporter sets the process-wide reporter used by Publish.
func SetDefaultReporter(reporter *Reporter) { defaultReporter.Store(reporter) }

// DefaultReporter returns the process-wide Langfuse reporter.
func DefaultReporter() *Reporter { return defaultReporter.Load() }

// Publish publishes an event to the process-wide reporter when enabled.
func Publish(event Event) {
	if reporter := DefaultReporter(); reporter != nil {
		reporter.Publish(event)
	}
}

// CloseDefault flushes and closes the process-wide reporter.
func CloseDefault(ctx context.Context) error {
	reporter := DefaultReporter()
	if reporter == nil {
		return nil
	}
	err := reporter.Close(ctx)
	defaultReporter.Store(nil)
	return err
}

type batchPayload struct {
	Batch []batchEvent `json:"batch"`
}

type batchEvent struct {
	ID   string         `json:"id"`
	Type string         `json:"type"`
	Body generationBody `json:"body"`
}

type generationBody struct {
	ID            string         `json:"id"`
	Name          string         `json:"name,omitempty"`
	Model         string         `json:"model,omitempty"`
	TraceID       string         `json:"traceId,omitempty"`
	SessionID     string         `json:"sessionId,omitempty"`
	ProjectID     string         `json:"projectId,omitempty"`
	UserID        string         `json:"userId,omitempty"`
	StartTime     time.Time      `json:"startTime"`
	EndTime       time.Time      `json:"endTime"`
	Usage         usage          `json:"usage"`
	Metadata      map[string]any `json:"metadata,omitempty"`
	Level         string         `json:"level,omitempty"`
	StatusMessage string         `json:"statusMessage,omitempty"`
	Input         any            `json:"input,omitempty"`
	Output        any            `json:"output,omitempty"`
}

type usage struct {
	Input  int `json:"input"`
	Output int `json:"output"`
	Total  int `json:"total"`
}

// LoadConfig reads Langfuse settings from environment variables.
func LoadConfig() Config {
	cfg := Config{
		Enabled:         envBool("LANGFUSE_ENABLED", false),
		Host:            strings.TrimRight(envString("LANGFUSE_HOST", defaultHost), "/"),
		PublicKey:       strings.TrimSpace(os.Getenv("LANGFUSE_PUBLIC_KEY")),
		SecretKey:       strings.TrimSpace(os.Getenv("LANGFUSE_SECRET_KEY")),
		SampleRate:      envFloat("LANGFUSE_SAMPLE_RATE", 1),
		Timeout:         time.Duration(envInt("LANGFUSE_TIMEOUT_MS", 3000)) * time.Millisecond,
		QueueSize:       envInt("LANGFUSE_QUEUE_SIZE", 256),
		BatchSize:       envInt("LANGFUSE_BATCH_SIZE", 20),
		CaptureContent:  envBool("LANGFUSE_CAPTURE_CONTENT", false),
		ContentMaxBytes: envInt("LANGFUSE_CONTENT_MAX_BYTES", 16384),
		FlushInterval:   time.Duration(envInt("LANGFUSE_FLUSH_INTERVAL_MS", 1000)) * time.Millisecond,
	}
	if cfg.SampleRate < 0 || cfg.SampleRate > 1 {
		cfg.SampleRate = 0
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = 3 * time.Second
	}
	if cfg.QueueSize <= 0 {
		cfg.QueueSize = 256
	}
	if cfg.BatchSize <= 0 {
		cfg.BatchSize = 20
	}
	if cfg.FlushInterval <= 0 {
		cfg.FlushInterval = time.Second
	}
	if cfg.ContentMaxBytes <= 0 {
		cfg.ContentMaxBytes = 16384
	}
	return cfg
}

// NewReporter creates a Langfuse reporter. It starts a worker only when the
// feature is enabled and all required credentials are present.
func NewReporter(config Config) *Reporter {
	if config.Host == "" {
		config.Host = defaultHost
	}
	config.Host = strings.TrimRight(config.Host, "/")
	if config.SampleRate < 0 || config.SampleRate > 1 {
		config.SampleRate = 0
	}
	if config.QueueSize <= 0 {
		config.QueueSize = 256
	}
	if config.BatchSize <= 0 {
		config.BatchSize = 20
	}
	if config.Timeout <= 0 {
		config.Timeout = 3 * time.Second
	}
	if config.FlushInterval <= 0 {
		config.FlushInterval = time.Second
	}
	if config.ContentMaxBytes <= 0 {
		config.ContentMaxBytes = 16384
	}
	workerCtx, cancel := context.WithCancel(context.Background())
	r := &Reporter{config: config, client: config.HTTPClient, queue: make(chan Event, config.QueueSize), flush: make(chan chan struct{}), done: make(chan struct{}), stop: make(chan struct{}), workerCtx: workerCtx, cancel: cancel}
	if r.client == nil {
		r.client = &http.Client{Timeout: config.Timeout}
	}
	clientCopy := *r.client
	previousRedirectHandler := clientCopy.CheckRedirect
	clientCopy.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if req.URL == nil || req.URL.Scheme != "https" {
			return fmt.Errorf("refusing non-HTTPS Langfuse redirect")
		}
		if previousRedirectHandler != nil {
			return previousRedirectHandler(req, via)
		}
		return nil
	}
	r.client = &clientCopy
	if config.Enabled && config.PublicKey != "" && config.SecretKey != "" && config.SampleRate > 0 {
		r.wg.Add(1)
		go r.run()
	}
	return r
}

// Publish queues an event without blocking the caller when the queue is full.
func (r *Reporter) Publish(event Event) {
	if r == nil {
		return
	}
	r.stateMu.Lock()
	defer r.stateMu.Unlock()
	if !r.configured() || r.closed.Load() || !sample(r.config.SampleRate) {
		return
	}
	select {
	case r.queue <- event:
	default:
		dropped := r.dropped.Add(1)
		if dropped == 1 || dropped%100 == 0 {
			log.Printf("langfuse events dropped: queue is full, total=%d", dropped)
		}
	}
}

// Stats contains cumulative reporter delivery counters.
type Stats struct {
	Dropped uint64
	Sent    uint64
	Failed  uint64
}

// Stats returns the reporter's cumulative queue and delivery counters.
func (r *Reporter) Stats() Stats {
	if r == nil {
		return Stats{}
	}
	return Stats{Dropped: r.dropped.Load(), Sent: r.sent.Load(), Failed: r.failed.Load()}
}

// Flush synchronously drains the reporter queue within the caller's deadline.
func (r *Reporter) Flush(ctx context.Context) error {
	if r == nil || !r.configured() {
		return nil
	}
	ack := make(chan struct{})
	select {
	case r.flush <- ack:
	case <-ctx.Done():
		return ctx.Err()
	}
	select {
	case <-ack:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Close flushes pending events and stops the reporter within the caller's deadline.
func (r *Reporter) Close(ctx context.Context) error {
	if r == nil || !r.configured() {
		return nil
	}
	r.stateMu.Lock()
	if !r.closed.CompareAndSwap(false, true) {
		r.stateMu.Unlock()
		return nil
	}
	r.stateMu.Unlock()
	flushDone := make(chan struct{})
	go func() {
		_ = r.Flush(ctx)
		close(flushDone)
	}()
	select {
	case <-flushDone:
	case <-ctx.Done():
		if r.cancel != nil {
			r.cancel()
		}
	}
	r.once.Do(func() { close(r.stop) })
	select {
	case <-r.done:
		return nil
	case <-ctx.Done():
		if r.cancel != nil {
			r.cancel()
		}
		return ctx.Err()
	}
}

func (r *Reporter) configured() bool {
	return r.config.Enabled && r.config.PublicKey != "" && r.config.SecretKey != "" && r.config.SampleRate > 0
}

func (r *Reporter) run() {
	defer r.wg.Done()
	defer close(r.done)
	ticker := time.NewTicker(r.config.FlushInterval)
	defer ticker.Stop()
	batch := make([]Event, 0, r.config.BatchSize)
	flush := func() {
		if len(batch) == 0 {
			return
		}
		if err := r.send(r.workerCtx, batch); err != nil {
			r.failed.Add(uint64(len(batch)))
			log.Printf("langfuse batch send failed: %v", err)
		} else {
			r.sent.Add(uint64(len(batch)))
		}
		batch = batch[:0]
	}
	for {
		select {
		case event := <-r.queue:
			batch = append(batch, event)
			if len(batch) >= r.config.BatchSize {
				flush()
			}
		case <-ticker.C:
			flush()
		case ack := <-r.flush:
			for {
			fill:
				for len(batch) < r.config.BatchSize {
					select {
					case event := <-r.queue:
						batch = append(batch, event)
					default:
						break fill
					}
				}
				if len(batch) == 0 {
					break
				}
				flush()
			}
			close(ack)
		case <-r.stop:
			flush()
			return
		}
	}
}

func (r *Reporter) take(limit int) []Event {
	batch := make([]Event, 0, limit)
	for len(batch) < limit {
		select {
		case event := <-r.queue:
			batch = append(batch, event)
		default:
			return batch
		}
	}
	return batch
}

func (r *Reporter) send(ctx context.Context, events []Event) error {
	parsedHost, err := url.Parse(r.config.Host)
	if err != nil {
		return fmt.Errorf("invalid Langfuse host: %w", err)
	}
	if parsedHost.Scheme != "https" || parsedHost.Host == "" {
		return fmt.Errorf("Langfuse host must use HTTPS")
	}
	payload := batchPayload{Batch: make([]batchEvent, 0, len(events))}
	now := time.Now().UTC()
	for _, event := range events {
		traceID := event.TraceID
		if traceID == "" {
			traceID = event.RequestID
		}
		metadata := make(map[string]any, len(event.Metadata)+5)
		for key, value := range event.Metadata {
			metadata[key] = value
		}
		metadata["request_id"] = event.RequestID
		metadata["quota"] = event.Quota
		metadata["duration_ms"] = event.DurationMS
		metadata["is_stream"] = event.IsStream
		body := generationBody{ID: newID(), Name: event.Model, Model: event.Model, TraceID: traceID, SessionID: event.SessionID, ProjectID: event.ProjectID, UserID: event.UserID, StartTime: now.Add(-time.Duration(event.DurationMS) * time.Millisecond), EndTime: now, Usage: usage{Input: event.InputTokens, Output: event.OutputTokens, Total: event.TotalTokens}, Metadata: metadata, Level: "DEFAULT", StatusMessage: event.Error}
		if event.Status == "error" {
			body.Level = "ERROR"
		}
		if r.config.CaptureContent {
			body.Input = sanitizeContent(event.Input, r.config.ContentMaxBytes)
			body.Output = sanitizeContent(event.Output, r.config.ContentMaxBytes)
		}
		payload.Batch = append(payload.Batch, batchEvent{ID: newID(), Type: "generation-create", Body: body})
	}
	data, err := common.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, r.config.Host+"/api/public/ingestion", strings.NewReader(string(data)))
	if err != nil {
		return err
	}
	req.SetBasicAuth(r.config.PublicKey, r.config.SecretKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := r.client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return &httpError{status: resp.StatusCode}
	}
	return nil
}

func sanitizeContent(value any, maxBytes int) any {
	if value == nil {
		return nil
	}
	data, err := common.Marshal(value)
	if err != nil {
		return "[content omitted: not serializable]"
	}
	if len(data) <= maxBytes {
		return value
	}
	return map[string]any{"truncated": true, "original_bytes": len(data), "preview": strings.ToValidUTF8(string(data[:maxBytes]), "�")}
}

type httpError struct{ status int }

func (e *httpError) Error() string {
	return "langfuse ingestion returned HTTP " + strconv.Itoa(e.status)
}

func sample(rate float64) bool {
	if rate >= 1 {
		return true
	}
	if rate <= 0 {
		return false
	}
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return false
	}
	return float64(uint64FromBytes(b[:]))/float64(^uint64(0)) < rate
}

func uint64FromBytes(b []byte) uint64 {
	var n uint64
	for _, v := range b {
		n = n<<8 | uint64(v)
	}
	return n
}
func newID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return strconv.FormatInt(time.Now().UnixNano(), 10)
	}
	return hex.EncodeToString(b[:])
}
func envString(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
func envBool(key string, fallback bool) bool {
	value, err := strconv.ParseBool(os.Getenv(key))
	if err != nil {
		return fallback
	}
	return value
}
func envInt(key string, fallback int) int {
	value, err := strconv.Atoi(os.Getenv(key))
	if err != nil {
		return fallback
	}
	return value
}
func envFloat(key string, fallback float64) float64 {
	value, err := strconv.ParseFloat(os.Getenv(key), 64)
	if err != nil {
		return fallback
	}
	return value
}
