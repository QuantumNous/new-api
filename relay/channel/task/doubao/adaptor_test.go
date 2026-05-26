package doubao

import "testing"

func TestParseCreateTaskID(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		body    string
		want    string
		wantErr bool
	}{
		{
			name: "native volc",
			body: `{"id":"cgt-20260526171350-mwcrj","status":"running"}`,
			want: "cgt-20260526171350-mwcrj",
		},
		{
			name: "gateway wrapper",
			body: `{"id":33,"request_id":"gw_1","upstream_task_id":"cgt-20260526171350-mwcrj","upstream_response":{"id":"cgt-20260526171350-mwcrj"}}`,
			want: "cgt-20260526171350-mwcrj",
		},
		{
			name: "nested upstream_response only",
			body: `{"id":12,"upstream_response":{"id":"cgt-abc"}}`,
			want: "cgt-abc",
		},
		{
			name:    "numeric id only",
			body:    `{"id":33}`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := parseCreateTaskID([]byte(tt.body))
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got id %q", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("parseCreateTaskID: %v", err)
			}
			if got != tt.want {
				t.Fatalf("got %q, want %q", got, tt.want)
			}
		})
	}
}
