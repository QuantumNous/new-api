package service

import (
	"testing"

	"github.com/QuantumNous/new-api/setting"

	"github.com/stretchr/testify/assert"
)

func TestCheckSensitiveTextSuffixDetectsCrossChunkMatch(t *testing.T) {
	previousWords := append([]string(nil), setting.SensitiveWords...)
	previousEnabled := setting.CheckSensitiveEnabled
	previousCompletion := setting.CheckSensitiveOnCompletionEnabled
	setting.CheckSensitiveEnabled = true
	setting.CheckSensitiveOnCompletionEnabled = true
	setting.SensitiveWords = []string{"abcdef"}
	t.Cleanup(func() {
		setting.SensitiveWords = previousWords
		setting.CheckSensitiveEnabled = previousEnabled
		setting.CheckSensitiveOnCompletionEnabled = previousCompletion
	})

	part1 := "hello abc"
	hit, words, checked := CheckSensitiveTextSuffix(part1, 0)
	assert.False(t, hit)
	assert.Empty(t, words)
	assert.Equal(t, len(part1), checked)

	full := part1 + "def world"
	hit, words, checked = CheckSensitiveTextSuffix(full, checked)
	assert.True(t, hit)
	assert.NotEmpty(t, words)
	assert.Equal(t, len(full), checked)
}

func TestSensitiveWordsAreSubstrings(t *testing.T) {
	previousWords := append([]string(nil), setting.SensitiveWords...)
	setting.SensitiveWords = []string{"hello", "world"}
	t.Cleanup(func() {
		setting.SensitiveWords = previousWords
	})

	assert.True(t, SensitiveWordsAreSubstrings("say hello to the world", []string{"hello", "world"}))
	assert.False(t, SensitiveWordsAreSubstrings("say hello there", []string{"hello", "world"}))
	assert.False(t, SensitiveWordsAreSubstrings("anything", nil))
}
