package apimartvideo

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestParseTaskResultCompleted(t *testing.T) {
	body := []byte(`{
	  "code": 200,
	  "data": {
	    "status": "completed",
	    "progress": 100,
	    "result": {
	      "videos": [{"url": ["https://upload.apib.ai/f/demo.mp4"]}]
	    }
	  }
	}`)
	a := &TaskAdaptor{}
	info, err := a.ParseTaskResult(body)
	require.NoError(t, err)
	require.Equal(t, model.TaskStatusSuccess, info.Status)
	require.Equal(t, "https://upload.apib.ai/f/demo.mp4", info.Url)
}

func TestNormalizeModel(t *testing.T) {
	require.Equal(t, "sora-2", normalizeModel("sora"))
	require.True(t, IsVideoModel("sora"))
}
