package service

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateTokenGroupCandidates(t *testing.T) {
	tests := []struct {
		name        string
		userGroup   string
		groups      []string
		wantErr     bool
		messagePart string
	}{
		{name: "ordered concrete groups", userGroup: "default", groups: []string{"default", "vip"}},
		{name: "empty list clears custom selection", userGroup: "default", groups: []string{}},
		{name: "empty candidate", userGroup: "default", groups: []string{"default", " "}, wantErr: true, messagePart: "不能为空"},
		{name: "duplicate candidate", userGroup: "default", groups: []string{"default", "default"}, wantErr: true, messagePart: "不能重复"},
		{name: "virtual auto candidate", userGroup: "default", groups: []string{"auto"}, wantErr: true, messagePart: "不能包含 auto"},
		{name: "too many candidates", userGroup: "default", groups: make([]string, MaxTokenGroupCandidates+1), wantErr: true, messagePart: "不能超过"},
		{name: "candidate name too long", userGroup: "default", groups: []string{strings.Repeat("a", MaxTokenGroupNameLength+1)}, wantErr: true, messagePart: "长度"},
		{name: "unusable candidate", userGroup: "default", groups: []string{"hidden"}, wantErr: true, messagePart: "无权访问"},
		{name: "candidate without ratio", userGroup: "orphan", groups: []string{"orphan"}, wantErr: true, messagePart: "已被弃用"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateTokenGroupCandidates(tt.userGroup, tt.groups)
			if !tt.wantErr {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.messagePart)
		})
	}
}

func TestValidateTokenGroupAutoRequiresVirtualPermission(t *testing.T) {
	err := ValidateTokenGroup("default", "auto")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "无权访问")

	require.NoError(t, ValidateTokenGroupCandidates("default", []string{"default", "vip"}))
}
