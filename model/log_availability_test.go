package model

import (
	"reflect"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGroupAvailabilityRecordJSONWhitelist(t *testing.T) {
	t.Parallel()

	typ := reflect.TypeOf(GroupAvailabilityRecord{})
	require.Equal(t, 3, typ.NumField())

	allowed := map[string]struct{}{
		"created_at": {},
		"use_time":   {},
		"ok":         {},
	}
	forbiddenSubstr := []string{"channel", "token", "username", "request", "other"}

	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)
		jsonTag := field.Tag.Get("json")
		require.NotEmpty(t, jsonTag)
		assert.Contains(t, allowed, jsonTag)
		lowerName := field.Name
		for _, bad := range forbiddenSubstr {
			assert.NotContains(t, lowerName, bad)
			assert.NotContains(t, jsonTag, bad)
		}
	}
}
