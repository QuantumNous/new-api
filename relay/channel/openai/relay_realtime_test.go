package openai

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAddRealtimeUsage(t *testing.T) {
	tests := []struct {
		name     string
		total    dto.RealtimeUsage
		delta    dto.RealtimeUsage
		expected dto.RealtimeUsage
	}{
		{
			name: "adds every realtime billing field",
			total: dto.RealtimeUsage{
				TotalTokens:  9,
				InputTokens:  5,
				OutputTokens: 4,
				InputTokenDetails: dto.InputTokenDetails{
					CachedTokens: 1,
					TextTokens:   2,
					AudioTokens:  3,
				},
				OutputTokenDetails: dto.OutputTokenDetails{TextTokens: 2, AudioTokens: 2},
			},
			delta: dto.RealtimeUsage{
				TotalTokens:  11,
				InputTokens:  7,
				OutputTokens: 4,
				InputTokenDetails: dto.InputTokenDetails{
					CachedTokens: 2,
					TextTokens:   3,
					AudioTokens:  4,
				},
				OutputTokenDetails: dto.OutputTokenDetails{TextTokens: 1, AudioTokens: 3},
			},
			expected: dto.RealtimeUsage{
				TotalTokens:  20,
				InputTokens:  12,
				OutputTokens: 8,
				InputTokenDetails: dto.InputTokenDetails{
					CachedTokens: 3,
					TextTokens:   5,
					AudioTokens:  7,
				},
				OutputTokenDetails: dto.OutputTokenDetails{TextTokens: 3, AudioTokens: 5},
			},
		},
		{
			name: "copies billing fields into an empty total",
			delta: dto.RealtimeUsage{
				TotalTokens:       7,
				InputTokens:       6,
				OutputTokens:      1,
				InputTokenDetails: dto.InputTokenDetails{AudioTokens: 6},
				OutputTokenDetails: dto.OutputTokenDetails{
					TextTokens: 1,
				},
			},
			expected: dto.RealtimeUsage{
				TotalTokens:       7,
				InputTokens:       6,
				OutputTokens:      1,
				InputTokenDetails: dto.InputTokenDetails{AudioTokens: 6},
				OutputTokenDetails: dto.OutputTokenDetails{
					TextTokens: 1,
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.expected, addRealtimeUsage(test.total, test.delta))
		})
	}
}

func TestBillableRealtimeTranscriptionUsage(t *testing.T) {
	tests := []struct {
		name             string
		event            *dto.RealtimeEvent
		expected         dto.RealtimeUsage
		expectedBillable bool
	}{
		{
			name: "ignores a completed event without usage",
			event: &dto.RealtimeEvent{
				Type: dto.RealtimeEventInputAudioTranscriptionCompleted,
			},
		},
		{
			name: "leaves whisper duration usage to local estimation",
			event: &dto.RealtimeEvent{
				Type:  dto.RealtimeEventInputAudioTranscriptionCompleted,
				Usage: &dto.RealtimeUsage{},
			},
		},
		{
			name: "ignores usage on a different event",
			event: &dto.RealtimeEvent{
				Type:  dto.RealtimeEventTypeResponseDone,
				Usage: &dto.RealtimeUsage{TotalTokens: 1},
			},
		},
		{
			name: "fills missing output details as text tokens",
			event: &dto.RealtimeEvent{
				Type: dto.RealtimeEventInputAudioTranscriptionCompleted,
				Usage: &dto.RealtimeUsage{
					TotalTokens:       13,
					InputTokens:       10,
					OutputTokens:      3,
					InputTokenDetails: dto.InputTokenDetails{AudioTokens: 10},
				},
			},
			expected: dto.RealtimeUsage{
				TotalTokens:       13,
				InputTokens:       10,
				OutputTokens:      3,
				InputTokenDetails: dto.InputTokenDetails{AudioTokens: 10},
				OutputTokenDetails: dto.OutputTokenDetails{
					TextTokens: 3,
				},
			},
			expectedBillable: true,
		},
		{
			name: "preserves provided output details",
			event: &dto.RealtimeEvent{
				Type: dto.RealtimeEventInputAudioTranscriptionCompleted,
				Usage: &dto.RealtimeUsage{
					TotalTokens:  13,
					InputTokens:  10,
					OutputTokens: 3,
					OutputTokenDetails: dto.OutputTokenDetails{
						TextTokens:  1,
						AudioTokens: 2,
					},
				},
			},
			expected: dto.RealtimeUsage{
				TotalTokens:  13,
				InputTokens:  10,
				OutputTokens: 3,
				OutputTokenDetails: dto.OutputTokenDetails{
					TextTokens:  1,
					AudioTokens: 2,
				},
			},
			expectedBillable: true,
		},
		{
			name: "does not fill text when audio output details are present",
			event: &dto.RealtimeEvent{
				Type: dto.RealtimeEventInputAudioTranscriptionCompleted,
				Usage: &dto.RealtimeUsage{
					TotalTokens:  13,
					InputTokens:  10,
					OutputTokens: 3,
					OutputTokenDetails: dto.OutputTokenDetails{
						AudioTokens: 3,
					},
				},
			},
			expected: dto.RealtimeUsage{
				TotalTokens:  13,
				InputTokens:  10,
				OutputTokens: 3,
				OutputTokenDetails: dto.OutputTokenDetails{
					AudioTokens: 3,
				},
			},
			expectedBillable: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var original *dto.RealtimeUsage
			if test.event != nil && test.event.Usage != nil {
				usageCopy := *test.event.Usage
				original = &usageCopy
			}

			actual, billable := billableRealtimeTranscriptionUsage(test.event)

			assert.Equal(t, test.expectedBillable, billable)
			assert.Equal(t, test.expected, actual)
			if original != nil {
				assert.Equal(t, *original, *test.event.Usage, "normalization must not mutate the upstream usage")
			}
		})
	}
}

func TestCaptureRealtimeTranscriptionModel(t *testing.T) {
	tests := []struct {
		name         string
		payload      string
		currentModel string
		expected     string
	}{
		{
			name:     "captures client session update",
			payload:  `{"type":"session.update","session":{"input_audio_transcription":{"model":"gpt-4o-transcribe"}}}`,
			expected: "gpt-4o-transcribe",
		},
		{
			name:     "captures upstream session created",
			payload:  `{"type":"session.created","session":{"input_audio_transcription":{"model":"gpt-4o-transcribe"}}}`,
			expected: "gpt-4o-transcribe",
		},
		{
			name:         "updates from upstream session updated",
			payload:      `{"type":"session.updated","session":{"input_audio_transcription":{"model":"gpt-4o-mini-transcribe"}}}`,
			currentModel: "whisper-1",
			expected:     "gpt-4o-mini-transcribe",
		},
		{
			name:         "does not overwrite with an empty model",
			payload:      `{"type":"session.updated","session":{"input_audio_transcription":{}}}`,
			currentModel: "gpt-4o-transcribe",
			expected:     "gpt-4o-transcribe",
		},
		{
			name:         "ignores a missing session",
			payload:      `{"type":"session.updated"}`,
			currentModel: "gpt-4o-transcribe",
			expected:     "gpt-4o-transcribe",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var event dto.RealtimeEvent
			require.NoError(t, common.Unmarshal([]byte(test.payload), &event))
			info := &relaycommon.RelayInfo{}
			info.InitRealtimeTranscriptionState()
			info.SetRealtimeTranscriptionModel(test.currentModel)

			captureRealtimeTranscriptionModel(info, event.Session)

			assert.Equal(t, test.expected, info.GetRealtimeTranscriptionModel())
		})
	}
}

func TestRealtimeTranscriptionBilling(t *testing.T) {
	event := &dto.RealtimeEvent{
		Type: dto.RealtimeEventInputAudioTranscriptionCompleted,
		Usage: &dto.RealtimeUsage{
			TotalTokens:       13,
			InputTokens:       10,
			OutputTokens:      3,
			InputTokenDetails: dto.InputTokenDetails{AudioTokens: 10},
		},
	}
	tests := []struct {
		name                     string
		originModelName          string
		transcriptionModelName   string
		expectedModelName        string
		expectedOutputTextTokens int
	}{
		{
			name:                     "mixed session uses the ASR model and separate usage sum",
			originModelName:          "gpt-realtime",
			transcriptionModelName:   "gpt-4o-transcribe",
			expectedModelName:        "gpt-4o-transcribe",
			expectedOutputTextTokens: 3,
		},
		{
			name:                     "transcription-only session falls back to the origin model",
			originModelName:          "gpt-4o-transcribe",
			expectedModelName:        "gpt-4o-transcribe",
			expectedOutputTextTokens: 3,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			billing, ok := realtimeTranscriptionBilling(test.originModelName, test.transcriptionModelName, event)
			require.True(t, ok)
			assert.Equal(t, test.expectedModelName, billing.ModelName)
			assert.Equal(t, test.expectedOutputTextTokens, billing.Usage.OutputTokenDetails.TextTokens)
		})
	}
}
