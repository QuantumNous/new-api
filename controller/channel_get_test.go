package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGetChannelNotFoundAndOutOfScopeAreIndistinguishable guards against an
// existence leak / message oracle: for a restricted (non-super-admin) caller,
// requesting a nonexistent channel id and requesting an existing channel that
// sits outside the caller's visible groups must yield the exact same
// status+body, so a restricted admin cannot use the error message to probe
// which channel ids exist in other groups.
func TestGetChannelNotFoundAndOutOfScopeAreIndistinguishable(t *testing.T) {
	previousDB := model.DB
	t.Cleanup(func() { model.DB = previousDB })

	db := newChannelScopeDB(t)
	model.DB = db

	configureVisibleGroupsForChannelTest(t) // caller only sees {default, vip}

	gin.SetMode(gin.TestMode)

	callGetChannel := func(id string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/channel/"+id, nil)
		c.Params = gin.Params{{Key: "id", Value: id}}
		c.Set("role", common.RoleAdminUser)
		c.Set("group", "default")

		GetChannel(c)
		return recorder
	}

	// id 3 exists (group "svip") but is outside the caller's visible groups.
	outOfScope := callGetChannel("3")
	// id 999 does not exist at all.
	notFound := callGetChannel("999")

	assert.Equal(t, http.StatusOK, outOfScope.Code)
	assert.Equal(t, http.StatusOK, notFound.Code)
	assert.Equal(t, outOfScope.Body.String(), notFound.Body.String(),
		"out-of-scope and not-found responses must be identical to avoid an existence leak")

	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(outOfScope.Body.Bytes(), &response))
	assert.False(t, response.Success)
	assert.NotEmpty(t, response.Message)
}
