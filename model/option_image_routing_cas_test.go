package model

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestUpdateRevisionedOptionCASRejectsASecondWriterFromSameRevision(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Option{}))
	require.NoError(t, db.Create(&Option{Key: "image_routing_setting.config", Value: `{"revision":4,"writer":"original"}`}).Error)
	oldDB := DB
	DB = db
	common.OptionMapRWMutex.Lock()
	oldOptionMap := common.OptionMap
	common.OptionMap = map[string]string{"image_routing_setting.config": `{"revision":4,"writer":"original"}`}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		DB = oldDB
		common.OptionMapRWMutex.Lock()
		common.OptionMap = oldOptionMap
		common.OptionMapRWMutex.Unlock()
	})

	require.NoError(t, UpdateRevisionedOptionCAS(
		"image_routing_setting.config",
		`{"revision":5,"writer":"first"}`,
		4,
	))
	err = UpdateRevisionedOptionCAS(
		"image_routing_setting.config",
		`{"revision":5,"writer":"second"}`,
		4,
	)
	assert.ErrorIs(t, err, ErrOptionRevisionConflict)

	var stored Option
	require.NoError(t, db.First(&stored, "key = ?", "image_routing_setting.config").Error)
	assert.JSONEq(t, `{"revision":5,"writer":"first"}`, stored.Value)
}

func TestUpdateRevisionedOptionCASRequiresNextRevision(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Option{}))
	require.NoError(t, db.Create(&Option{Key: "image_routing_setting.config", Value: `{"revision":4}`}).Error)
	oldDB := DB
	DB = db
	t.Cleanup(func() { DB = oldDB })

	err = UpdateRevisionedOptionCAS("image_routing_setting.config", `{"revision":6}`, 4)
	assert.True(t, errors.Is(err, ErrOptionRevisionConflict))
}
