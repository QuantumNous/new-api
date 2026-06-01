package model

import "testing"

func TestNewUserSortOptions(t *testing.T) {
	tests := []struct {
		name      string
		sortBy    string
		sortOrder string
		wantBy    string
		wantOrder string
	}{
		{
			name:      "额度降序",
			sortBy:    "quota",
			sortOrder: "desc",
			wantBy:    "quota",
			wantOrder: "desc",
		},
		{
			name:      "创建时间升序",
			sortBy:    " CREATED_AT ",
			sortOrder: "ASC",
			wantBy:    "created_at",
			wantOrder: "asc",
		},
		{
			name:      "默认降序",
			sortBy:    "last_login_at",
			sortOrder: "",
			wantBy:    "last_login_at",
			wantOrder: "desc",
		},
		{
			name:      "非法字段回落",
			sortBy:    "password",
			sortOrder: "asc",
			wantBy:    "",
			wantOrder: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NewUserSortOptions(tt.sortBy, tt.sortOrder)
			if got.SortBy != tt.wantBy {
				t.Fatalf("SortBy = %q, want %q", got.SortBy, tt.wantBy)
			}
			if got.SortOrder != tt.wantOrder {
				t.Fatalf("SortOrder = %q, want %q", got.SortOrder, tt.wantOrder)
			}
		})
	}
}
