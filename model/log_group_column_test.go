package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLogGroupColumnPrefersInitializedLogDialect(t *testing.T) {
	old := logGroupCol
	t.Cleanup(func() { logGroupCol = old })
	logGroupCol = `"group"`
	assert.Equal(t, `"group"`, LogGroupColumn())
	logGroupCol = ""
	assert.Contains(t, []string{"`group`", `"group"`}, LogGroupColumn())
}
