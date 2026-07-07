package gemini

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestResolveVeoDurationCapsMetadataDuration(t *testing.T) {
	metadata := map[string]any{"durationSeconds": float64(relaycommon.MaxTaskDurationSeconds + 1)}
	if got := ResolveVeoDuration(metadata, 0, ""); got != relaycommon.MaxTaskDurationSeconds {
		t.Fatalf("duration = %d, want cap %d", got, relaycommon.MaxTaskDurationSeconds)
	}
}

func TestResolveVeoDurationCapsStandardFields(t *testing.T) {
	if got := ResolveVeoDuration(nil, relaycommon.MaxTaskDurationSeconds+1, ""); got != relaycommon.MaxTaskDurationSeconds {
		t.Fatalf("duration field = %d, want cap %d", got, relaycommon.MaxTaskDurationSeconds)
	}
	if got := ResolveVeoDuration(nil, 0, "3601"); got != relaycommon.MaxTaskDurationSeconds {
		t.Fatalf("seconds field = %d, want cap %d", got, relaycommon.MaxTaskDurationSeconds)
	}
}
