package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestPostSetupRejectsPasswordOutsideSupportedLength(t *testing.T) {
	tests := []struct {
		name     string
		password string
	}{
		{name: "seven emoji", password: strings.Repeat("😀", 7)},
		{name: "twenty one ASCII characters", password: strings.Repeat("a", 21)},
		{name: "twenty emoji exceed bcrypt byte limit", password: strings.Repeat("😀", 20)},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			previousDB := model.DB
			previousSetup := constant.Setup
			previousOptionMap := common.OptionMap
			db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
			require.NoError(t, err)
			require.NoError(t, db.AutoMigrate(&model.User{}, &model.Option{}, &model.Setup{}))
			model.DB = db
			constant.Setup = false
			common.OptionMap = make(map[string]string)
			t.Cleanup(func() {
				model.DB = previousDB
				constant.Setup = previousSetup
				common.OptionMap = previousOptionMap
			})

			body := fmt.Sprintf(
				`{"username":"root","password":%q,"confirmPassword":%q}`,
				test.password,
				test.password,
			)
			recorder := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(recorder)
			context.Request = httptest.NewRequest(http.MethodPost, "/api/setup", strings.NewReader(body))
			context.Request.Header.Set("Content-Type", "application/json")

			PostSetup(context)

			assert.Contains(t, recorder.Body.String(), `"success":false`)
			var userCount int64
			require.NoError(t, db.Model(&model.User{}).Count(&userCount).Error)
			assert.Zero(t, userCount)
		})
	}
}
