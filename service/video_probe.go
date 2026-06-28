package service

import (
	"context"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const probeVideoMaxBytes = 100 << 20

// ProbeRemoteVideoDurationSeconds downloads (up to 100MB) and probes MP4/MOV duration.
// Duration is rounded up (ceil) to whole seconds.
func ProbeRemoteVideoDurationSeconds(ctx context.Context, rawURL string) (int, error) {
	return probeRemoteVideoDurationSeconds(ctx, rawURL, math.Ceil)
}

// ProbeRemoteVideoDurationSecondsRound is like ProbeRemoteVideoDurationSeconds but rounds
// to the nearest whole second (四舍五入). Used for motion-control pre-charge at submit.
func ProbeRemoteVideoDurationSecondsRound(ctx context.Context, rawURL string) (int, error) {
	return probeRemoteVideoDurationSeconds(ctx, rawURL, math.Round)
}

func probeRemoteVideoDurationSeconds(ctx context.Context, rawURL string, roundFn func(float64) float64) (int, error) {
	u := strings.TrimSpace(rawURL)
	if u == "" {
		return 0, fmt.Errorf("empty video url")
	}
	parsed, err := url.Parse(u)
	if err != nil || parsed.Scheme != "http" && parsed.Scheme != "https" {
		return 0, fmt.Errorf("unsupported video url")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return 0, err
	}
	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return 0, fmt.Errorf("video fetch http %d", resp.StatusCode)
	}

	ext := videoProbeExt(u, resp.Header.Get("Content-Type"))
	tmp, err := os.CreateTemp("", "video-probe-*"+ext)
	if err != nil {
		return 0, err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)

	if _, err := io.Copy(tmp, io.LimitReader(resp.Body, probeVideoMaxBytes)); err != nil {
		tmp.Close()
		return 0, err
	}
	if err := tmp.Close(); err != nil {
		return 0, err
	}

	f, err := os.Open(tmpPath)
	if err != nil {
		return 0, err
	}
	defer f.Close()

	seconds, err := common.GetAudioDuration(ctx, f, ext)
	if err != nil {
		return 0, err
	}
	if seconds <= 0 {
		return 0, fmt.Errorf("zero duration")
	}
	rounded := int(roundFn(seconds))
	if rounded <= 0 && seconds > 0 {
		rounded = 1
	}
	return rounded, nil
}

func videoProbeExt(rawURL, contentType string) string {
	ct := strings.ToLower(strings.TrimSpace(contentType))
	switch {
	case strings.Contains(ct, "quicktime"):
		return ".mov"
	case strings.Contains(ct, "mp4"), strings.Contains(ct, "mpeg"):
		return ".mp4"
	}
	ext := strings.ToLower(filepath.Ext(strings.Split(rawURL, "?")[0]))
	switch ext {
	case ".mov":
		return ".mov"
	case ".mp4", ".m4v":
		return ".mp4"
	default:
		return ".mp4"
	}
}
