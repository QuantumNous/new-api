package vertex

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetRequestURLWithAPIKey(t *testing.T) {
	tests := []struct {
		name      string
		projectID string
		region    string
		stream    bool
		want      string
	}{
		{
			name:      "project ID keeps the global region",
			projectID: "my-project",
			region:    `{"default":"global"}`,
			want:      "https://aiplatform.googleapis.com/v1/projects/my-project/locations/global/publishers/google/models/gemini-4-argon:generateContent?key=test-key",
		},
		{
			name:      "project ID keeps a regional endpoint when streaming",
			projectID: "my-project",
			region:    `{"default":"us-central1"}`,
			stream:    true,
			want:      "https://us-central1-aiplatform.googleapis.com/v1/projects/my-project/locations/us-central1/publishers/google/models/gemini-4-argon:streamGenerateContent?alt=sse&key=test-key",
		},
		{
			name:   "no project ID keeps the express-mode URL",
			region: `{"default":"global"}`,
			want:   "https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-4-argon:generateContent?key=test-key",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{
				IsStream:        tt.stream,
				OriginModelName: "gemini-4-argon",
				ChannelMeta: &relaycommon.ChannelMeta{
					ApiVersion:        tt.region,
					ApiKey:            "test-key",
					UpstreamModelName: "gemini-4-argon",
					ChannelOtherSettings: dto.ChannelOtherSettings{
						VertexKeyType:   dto.VertexKeyTypeAPIKey,
						VertexProjectID: tt.projectID,
					},
				},
			}
			adaptor := &Adaptor{}
			adaptor.Init(info)

			got, err := adaptor.GetRequestURL(info)
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}
