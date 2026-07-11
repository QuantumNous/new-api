package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/model_setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestApplyForceStream guards the invariant that ForceStream only activates
// when the channel opts in, the client requested non-streaming, and neither
// pass-through mode is active. When activated it must flip stream to true and
// set ForceStreamBuffer; otherwise the request stream must be left untouched.
func TestApplyForceStream(t *testing.T) {
	// ApplyForceStream reads the global pass-through flag, so save and restore it.
	original := model_setting.GetGlobalSettings().PassThroughRequestEnabled
	t.Cleanup(func() { model_setting.GetGlobalSettings().PassThroughRequestEnabled = original })

	ptrBool := func(v bool) *bool { return &v }

	tests := []struct {
		name              string
		forceStream       bool
		passThroughBody   bool
		globalPassThrough bool
		inStream          *bool // incoming request.Stream
		wantActive        bool
	}{
		{name: "active when force stream and non-stream client", forceStream: true, inStream: ptrBool(false), wantActive: true},
		{name: "active when force stream and stream nil", forceStream: true, inStream: nil, wantActive: true},
		{name: "inactive when client already streaming", forceStream: true, inStream: ptrBool(true), wantActive: false},
		{name: "inactive when force stream disabled", forceStream: false, inStream: ptrBool(false), wantActive: false},
		{name: "inactive when channel pass-through enabled", forceStream: true, passThroughBody: true, inStream: ptrBool(false), wantActive: false},
		{name: "inactive when global pass-through enabled", forceStream: true, globalPassThrough: true, inStream: ptrBool(false), wantActive: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			model_setting.GetGlobalSettings().PassThroughRequestEnabled = tt.globalPassThrough

			info := &relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelSetting: dto.ChannelSettings{
						ForceStream:            tt.forceStream,
						PassThroughBodyEnabled: tt.passThroughBody,
					},
				},
			}
			req := &dto.GeneralOpenAIRequest{Stream: tt.inStream}

			ApplyForceStream(info, req)

			require.Equal(t, tt.wantActive, info.ForceStreamBuffer)
			if tt.wantActive {
				require.NotNil(t, req.Stream)
				assert.True(t, *req.Stream, "stream must be forced true when active")
			} else {
				// Inactive: the stream pointer must be untouched.
				if tt.inStream == nil {
					assert.Nil(t, req.Stream)
				} else {
					require.NotNil(t, req.Stream)
					assert.Equal(t, *tt.inStream, *req.Stream)
				}
			}
		})
	}
}
