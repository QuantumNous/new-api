package service

import (
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func createChannelTypeSelectionFixture(
	t *testing.T,
	db *gorm.DB,
	id int,
	channelType int,
	priorityValue int64,
) {
	t.Helper()
	weight := uint(100)
	channel := &model.Channel{
		Id:       id,
		Type:     channelType,
		Key:      fmt.Sprintf("key-%d", id),
		Status:   common.ChannelStatusEnabled,
		Name:     fmt.Sprintf("channel-%d", id),
		Weight:   &weight,
		Models:   "storage:gs:bucket-a",
		Group:    "default",
		Priority: &priorityValue,
	}
	require.NoError(t, db.Create(channel).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     "default",
		Model:     "storage:gs:bucket-a",
		ChannelId: id,
		Enabled:   true,
		Priority:  &priorityValue,
		Weight:    weight,
	}).Error)
}

func TestRequiredChannelTypeFiltersCachedCandidates(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	createChannelTypeSelectionFixture(t, db, 3101, constant.ChannelTypeGemini, 100)
	createChannelTypeSelectionFixture(t, db, 3102, constant.ChannelTypeVertexAi, 0)
	model.InitChannelCache()

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	for _, testCase := range []struct {
		name                string
		requiredChannelType int
		wantID              int
		wantType            int
	}{
		{name: "limits candidates to the requested channel type", requiredChannelType: constant.ChannelTypeVertexAi, wantID: 3102, wantType: constant.ChannelTypeVertexAi},
		{name: "zero preserves the unrestricted candidate set", wantID: 3101, wantType: constant.ChannelTypeGemini},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			selected, group, err := CacheGetRandomSatisfiedChannel(&RetryParam{
				Ctx:                 ctx,
				TokenGroup:          "default",
				ModelName:           "storage:gs:bucket-a",
				RequestPath:         "/vertexai/storage/v1/b/bucket-a/o",
				RequiredChannelType: testCase.requiredChannelType,
			})

			require.NoError(t, err)
			require.NotNil(t, selected)
			assert.Equal(t, testCase.wantID, selected.Id)
			assert.Equal(t, testCase.wantType, selected.Type)
			assert.Equal(t, "default", group)
		})
	}
}
