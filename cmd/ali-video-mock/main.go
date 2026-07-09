package main

import (
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	taskali "github.com/QuantumNous/new-api/relay/channel/task/ali"
)

const (
	defaultListenAddr = ":8080"
	mockTaskPending   = "PENDING"
	mockTaskRunning   = "RUNNING"
	mockTaskSuccess   = "SUCCEEDED"
	mockTaskFailed    = "FAILED"
)

type mockServer struct {
	mu     sync.Mutex
	nextID int64
	tasks  map[string]*mockTask
	config mockConfig
	rng    *rand.Rand
}

type mockConfig struct {
	FailRate float64
}

type mockTask struct {
	ID           string
	Model        string
	Family       string
	Duration     int
	Resolution   string
	SR           int
	Audio        bool
	CreatedAt    time.Time
	ScheduledAt  time.Time
	CompletedAt  time.Time
	PollCount    int
	ShouldFail   bool
	FailReason   string
	VideoURL     string
	WatermarkURL string
}

type requestSummary struct {
	Model      string
	Family     string
	Prompt     string
	MediaCount int
	Duration   int
	Resolution string
	SR         int
	Audio      bool
}

func newMockServer() *mockServer {
	return newMockServerWithConfig(loadMockConfig())
}

func newMockServerWithConfig(cfg mockConfig) *mockServer {
	return &mockServer{
		tasks:  make(map[string]*mockTask),
		config: cfg,
		rng:    rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

func main() {
	addr := strings.TrimSpace(getenv("ALI_VIDEO_MOCK_LISTEN", defaultListenAddr))
	srv := newMockServer()
	log.Printf("ali-video-mock listening on %s fail_rate=%.2f", addr, srv.config.FailRate)
	if err := http.ListenAndServe(addr, srv.routes()); err != nil {
		log.Fatalf("ali-video-mock listen failed: %v", err)
	}
}

func (s *mockServer) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.handleHealth)
	mux.HandleFunc("/api/v1/services/aigc/video-generation/video-synthesis", s.handleSubmit)
	mux.HandleFunc("/api/v1/tasks/", s.handleFetchTask)
	mux.HandleFunc("/mock-assets/videos/", s.handleMockVideo)
	return mux
}

func (s *mockServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	log.Printf("healthz check remote=%s", r.RemoteAddr)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *mockServer) handleSubmit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeAliError(w, http.StatusMethodNotAllowed, "MethodNotAllowed", "method not allowed")
		return
	}

	var req taskali.AliVideoRequest
	if err := common.DecodeJson(r.Body, &req); err != nil {
		writeAliError(w, http.StatusBadRequest, "InvalidJSON", err.Error())
		return
	}

	family, ok := detectModelFamily(req.Model)
	if !ok {
		writeAliError(w, http.StatusBadRequest, "UnsupportedModel", fmt.Sprintf("mock only supports HappyHorse/Kling, got %s", req.Model))
		return
	}

	now := time.Now()
	duration := 5
	if req.Parameters != nil && req.Parameters.Duration > 0 {
		duration = req.Parameters.Duration
	}
	resolution, sr := resolveResolution(req)
	audio := resolveAudio(req)
	summary := summarizeRequest(req, family, duration, resolution, sr, audio)
	log.Printf("submit request remote=%s summary=%s", r.RemoteAddr, formatRequestSummary(summary))

	taskID := s.nextTaskID()
	videoURL := buildAbsoluteURL(r, fmt.Sprintf("/mock-assets/videos/%s.mp4", taskID))
	watermarkURL := ""
	if family == "kling" {
		watermarkURL = buildAbsoluteURL(r, fmt.Sprintf("/mock-assets/videos/%s-watermark.mp4", taskID))
	}

	task := &mockTask{
		ID:           taskID,
		Model:        req.Model,
		Family:       family,
		Duration:     duration,
		Resolution:   resolution,
		SR:           sr,
		Audio:        audio,
		CreatedAt:    now,
		ScheduledAt:  now.Add(800 * time.Millisecond),
		CompletedAt:  now.Add(1600 * time.Millisecond),
		ShouldFail:   s.shouldFail(),
		FailReason:   "mock upstream random failure",
		VideoURL:     videoURL,
		WatermarkURL: watermarkURL,
	}

	s.mu.Lock()
	s.tasks[taskID] = task
	s.mu.Unlock()
	log.Printf("task created id=%s model=%s family=%s duration=%ds resolution=%s sr=%d audio=%t should_fail=%t watermark=%t video_url=%s",
		task.ID, task.Model, task.Family, task.Duration, task.Resolution, task.SR, task.Audio, task.ShouldFail, task.WatermarkURL != "", task.VideoURL)

	resp := taskali.AliVideoResponse{
		RequestID: taskID + "-request",
		Output: taskali.AliVideoOutput{
			TaskID:        taskID,
			TaskStatus:    mockTaskPending,
			SubmitTime:    formatAliTime(now),
			ScheduledTime: formatAliTime(task.ScheduledAt),
		},
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *mockServer) handleFetchTask(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeAliError(w, http.StatusMethodNotAllowed, "MethodNotAllowed", "method not allowed")
		return
	}

	taskID := strings.TrimPrefix(r.URL.Path, "/api/v1/tasks/")
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		writeAliError(w, http.StatusBadRequest, "InvalidTaskID", "task id is required")
		return
	}

	s.mu.Lock()
	task, ok := s.tasks[taskID]
	if ok {
		task.PollCount++
	}
	s.mu.Unlock()
	if !ok {
		writeAliError(w, http.StatusNotFound, "TaskNotFound", "task not found")
		return
	}

	status := mockTaskPending
	videoURL := ""
	watermarkURL := ""
	failReason := ""
	endTime := ""
	switch {
	case task.PollCount >= 2:
		if task.ShouldFail {
			status = mockTaskFailed
			failReason = task.FailReason
		} else {
			status = mockTaskSuccess
			videoURL = task.VideoURL
			watermarkURL = task.WatermarkURL
		}
		endTime = formatAliTime(task.CompletedAt)
	case task.PollCount >= 1:
		status = mockTaskRunning
	default:
		status = mockTaskPending
	}
	log.Printf("fetch task remote=%s id=%s poll=%d status=%s model=%s resolution=%s sr=%d audio=%t should_fail=%t fail_reason=%q",
		r.RemoteAddr, task.ID, task.PollCount, status, task.Model, task.Resolution, task.SR, task.Audio, task.ShouldFail, failReason)

	resp := taskali.AliVideoResponse{
		RequestID: task.ID + "-request",
		Output: taskali.AliVideoOutput{
			TaskID:        task.ID,
			TaskStatus:    status,
			SubmitTime:    formatAliTime(task.CreatedAt),
			ScheduledTime: formatAliTime(task.ScheduledAt),
			EndTime:       endTime,
			VideoURL:      videoURL,
			WatermarkURL:  watermarkURL,
			Message:       failReason,
		},
		Usage: &taskali.AliUsage{
			Duration:            task.Duration,
			OutputVideoDuration: task.Duration,
			SR:                  task.SR,
			Audio:               task.Audio,
			Size:                task.Resolution,
		},
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *mockServer) handleMockVideo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	log.Printf("mock asset request remote=%s method=%s path=%s", r.RemoteAddr, r.Method, r.URL.Path)
	w.Header().Set("Content-Type", "video/mp4")
	w.Header().Set("Cache-Control", "no-store")
	if r.Method == http.MethodHead {
		w.WriteHeader(http.StatusOK)
		return
	}
	_, _ = w.Write([]byte("mock-mp4-placeholder"))
}

func (s *mockServer) nextTaskID() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.nextID++
	return fmt.Sprintf("mock-task-%06d", s.nextID)
}

func detectModelFamily(model string) (string, bool) {
	name := strings.ToLower(strings.TrimSpace(model))
	switch {
	case strings.HasPrefix(name, "happyhorse-1.0"), strings.HasPrefix(name, "happyhorse-1.1"):
		return "happyhorse", true
	case strings.HasPrefix(name, "kling/kling-v3-"):
		return "kling", true
	default:
		return "", false
	}
}

func resolveResolution(req taskali.AliVideoRequest) (string, int) {
	if req.Parameters != nil {
		if resolution, sr, ok := normalizeResolution(req.Parameters.Resolution); ok {
			return resolution, sr
		}
		if resolution, sr, ok := sizeToResolution(req.Parameters.Size); ok {
			return resolution, sr
		}
		if req.Parameters.Mode != nil {
			if strings.EqualFold(strings.TrimSpace(*req.Parameters.Mode), "std") {
				return "720P", 720
			}
			return "1080P", 1080
		}
	}
	return "1080P", 1080
}

func normalizeResolution(raw string) (string, int, bool) {
	value := strings.ToUpper(strings.TrimSpace(raw))
	switch value {
	case "480P":
		return "480P", 480, true
	case "720P":
		return "720P", 720, true
	case "1080P":
		return "1080P", 1080, true
	case "2K":
		return "2K", 2000, true
	case "4K":
		return "4K", 4000, true
	default:
		return "", 0, false
	}
}

func sizeToResolution(size string) (string, int, bool) {
	switch strings.TrimSpace(size) {
	case "832*480", "480*832", "624*624":
		return "480P", 480, true
	case "1280*720", "720*1280", "960*960", "1088*832", "832*1088":
		return "720P", 720, true
	case "1920*1080", "1080*1920", "1440*1440", "1632*1248", "1248*1632":
		return "1080P", 1080, true
	default:
		return "", 0, false
	}
}

func resolveAudio(req taskali.AliVideoRequest) bool {
	if req.Parameters == nil || req.Parameters.Audio == nil {
		return true
	}
	return *req.Parameters.Audio
}

func formatAliTime(t time.Time) string {
	return t.Format("2006-01-02 15:04:05.000")
}

func buildAbsoluteURL(r *http.Request, path string) string {
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	return scheme + "://" + r.Host + path
}

func writeAliError(w http.ResponseWriter, status int, code string, message string) {
	log.Printf("mock error status=%d code=%s message=%s", status, code, message)
	writeJSON(w, status, taskali.AliVideoResponse{
		Code:      code,
		Message:   message,
		RequestID: "mock-error",
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	body, err := common.Marshal(payload)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

func getenv(key string, fallback string) string {
	if env := strings.TrimSpace(os.Getenv(key)); env != "" {
		return env
	}
	return fallback
}

func loadMockConfig() mockConfig {
	failRate := 0.0
	if raw := strings.TrimSpace(os.Getenv("ALI_VIDEO_MOCK_FAIL_RATE")); raw != "" {
		if parsed, err := strconv.ParseFloat(raw, 64); err == nil {
			switch {
			case parsed < 0:
				failRate = 0
			case parsed > 1:
				failRate = 1
			default:
				failRate = parsed
			}
		}
	}
	return mockConfig{FailRate: failRate}
}

func (s *mockServer) shouldFail() bool {
	if s.config.FailRate <= 0 {
		return false
	}
	if s.config.FailRate >= 1 {
		return true
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.rng.Float64() < s.config.FailRate
}

func summarizeRequest(req taskali.AliVideoRequest, family string, duration int, resolution string, sr int, audio bool) requestSummary {
	mediaCount := len(req.Input.Media)
	if req.Input.ImgURL != "" {
		mediaCount++
	}
	if req.Input.FirstFrameURL != "" {
		mediaCount++
	}
	if req.Input.LastFrameURL != "" {
		mediaCount++
	}
	return requestSummary{
		Model:      req.Model,
		Family:     family,
		Prompt:     truncateText(firstNonEmpty(req.Input.Prompt, req.Input.Template), 80),
		MediaCount: mediaCount,
		Duration:   duration,
		Resolution: resolution,
		SR:         sr,
		Audio:      audio,
	}
}

func formatRequestSummary(summary requestSummary) string {
	return fmt.Sprintf("model=%s family=%s duration=%ds resolution=%s sr=%d audio=%t media=%d prompt=%q",
		summary.Model, summary.Family, summary.Duration, summary.Resolution, summary.SR, summary.Audio, summary.MediaCount, summary.Prompt)
}

func truncateText(value string, limit int) string {
	value = strings.TrimSpace(value)
	if len(value) <= limit {
		return value
	}
	return value[:limit] + "..."
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
