package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTaskModel2DtoResultURLContract(t *testing.T) {
	t.Run("failure reason is not exposed as a result URL", func(t *testing.T) {
		task := &model.Task{
			Status:     model.TaskStatusFailure,
			FailReason: "provider rejected the image request",
		}

		result := TaskModel2Dto(task)

		require.NotNil(t, result)
		assert.Empty(t, result.ResultURL)
	})

	t.Run("successful legacy task keeps result URL fallback", func(t *testing.T) {
		const legacyResultURL = "https://cdn.example.com/generated/image.png"
		task := &model.Task{
			Status:     model.TaskStatusSuccess,
			FailReason: legacyResultURL,
		}

		result := TaskModel2Dto(task)

		require.NotNil(t, result)
		assert.Equal(t, legacyResultURL, result.ResultURL)
	})
}
