package service

import (
	"fmt"
	"strings"

	"github.com/MoeForge/moego/base64"
)

func parseAudio(audioBase64 string, format string) (duration float64, err error) {
	audioData, err := base64.StdEncoding.DecodeString(audioBase64)
	if err != nil {
		return 0, fmt.Errorf("base64 decode error: %v", err)
	}

	var samplesCount int
	var sampleRate int

	switch format {
	case "pcm16":
		samplesCount = len(audioData) / 2 // 16 bits = 2 bytes per sample
		sampleRate = 24000                // 24kHz
	case "g711_ulaw", "g711_alaw":
		samplesCount = len(audioData) // 8 bits = 1 byte per sample
		sampleRate = 8000             // 8kHz
	default:
		samplesCount = len(audioData) // 8 bits = 1 byte per sample
		sampleRate = 8000             // 8kHz
	}

	duration = float64(samplesCount) / float64(sampleRate)
	return duration, nil
}

func DecodeBase64AudioData(audioBase64 string) (string, error) {
	// Check and remove data:audio/xxx;base64, prefix
	idx := strings.Index(audioBase64, ",")
	if idx != -1 {
		audioBase64 = audioBase64[idx+1:]
	}

	// Verify Base64 data
	_, err := base64.StdEncoding.ValidateString(audioBase64)
	if err != nil {
		return "", fmt.Errorf("base64 decode error: %v", err)
	}

	return audioBase64, nil
}
