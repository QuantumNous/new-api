package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestResolveAffiliateInviteSource(t *testing.T) {
	tests := []struct {
		name  string
		input AffiliateInviteInput
		want  string
	}{
		{
			name: "empty invite code has no source",
			input: AffiliateInviteInput{
				ModuleEnabled: true,
			},
			want: AffiliateInviteSourceNone,
		},
		{
			name: "ordinary inviter remains normal invite",
			input: AffiliateInviteInput{
				ModuleEnabled: true,
				InviteCode:    "abc123",
				InviterUserId: 7,
			},
			want: AffiliateInviteSourceNormal,
		},
		{
			name: "active level one profile is affiliate invite",
			input: AffiliateInviteInput{
				ModuleEnabled:          true,
				InviteCode:             "abc123",
				InviterUserId:          7,
				InviterAffiliateStatus: "active",
				InviterAffiliateLevel:  1,
			},
			want: AffiliateInviteSourceAffiliate,
		},
		{
			name: "active level two profile is affiliate invite",
			input: AffiliateInviteInput{
				ModuleEnabled:          true,
				InviteCode:             "abc123",
				InviterUserId:          7,
				InviterAffiliateStatus: "active",
				InviterAffiliateLevel:  2,
			},
			want: AffiliateInviteSourceAffiliate,
		},
		{
			name: "disabled module downgrades affiliate code to normal invite",
			input: AffiliateInviteInput{
				ModuleEnabled:          false,
				InviteCode:             "abc123",
				InviterUserId:          7,
				InviterAffiliateStatus: "active",
				InviterAffiliateLevel:  1,
			},
			want: AffiliateInviteSourceNormal,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ResolveAffiliateInviteSource(tt.input)
			if got.Source != tt.want {
				t.Fatalf("expected source %q, got %q", tt.want, got.Source)
			}
		})
	}
}

func TestResolveAffiliateAccessScope(t *testing.T) {
	tests := []struct {
		name  string
		input AffiliateScopeInput
		want  AffiliateScope
	}{
		{
			name: "root has global scope",
			input: AffiliateScopeInput{
				UserId: 1,
				Role:   common.RoleRootUser,
			},
			want: AffiliateScope{Kind: AffiliateScopeGlobal, UserId: 1, MaxDepth: 0},
		},
		{
			name: "admin has global scope",
			input: AffiliateScopeInput{
				UserId: 2,
				Role:   common.RoleAdminUser,
			},
			want: AffiliateScope{Kind: AffiliateScopeGlobal, UserId: 2, MaxDepth: 0},
		},
		{
			name: "ordinary user without active profile has no affiliate scope",
			input: AffiliateScopeInput{
				UserId: 3,
				Role:   common.RoleCommonUser,
			},
			want: AffiliateScope{Kind: AffiliateScopeNone, UserId: 3, MaxDepth: 0},
		},
		{
			name: "level one affiliate can see two levels",
			input: AffiliateScopeInput{
				UserId:        4,
				Role:          common.RoleCommonUser,
				ProfileStatus: "active",
				ProfileLevel:  1,
			},
			want: AffiliateScope{Kind: AffiliateScopeAffiliate, UserId: 4, AffiliateLevel: 1, MaxDepth: 2},
		},
		{
			name: "level two affiliate can see one level",
			input: AffiliateScopeInput{
				UserId:        5,
				Role:          common.RoleCommonUser,
				ProfileStatus: "active",
				ProfileLevel:  2,
			},
			want: AffiliateScope{Kind: AffiliateScopeAffiliate, UserId: 5, AffiliateLevel: 2, MaxDepth: 1},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ResolveAffiliateAccessScope(tt.input)
			if got != tt.want {
				t.Fatalf("expected %+v, got %+v", tt.want, got)
			}
		})
	}
}
