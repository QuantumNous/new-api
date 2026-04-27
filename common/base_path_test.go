package common

import "testing"

func TestNormalizeBasePath(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{name: "empty", input: "", want: ""},
		{name: "root", input: "/", want: ""},
		{name: "single segment", input: "/new-api", want: "/new-api"},
		{name: "strip trailing slash", input: "/new-api/", want: "/new-api"},
		{name: "nested path", input: "/foo/bar", want: "/foo/bar"},
		{name: "missing leading slash", input: "new-api", wantErr: true},
		{name: "double slash", input: "/foo//bar", wantErr: true},
		{name: "dot segment", input: "/foo/./bar", wantErr: true},
		{name: "dot dot segment", input: "/foo/../bar", wantErr: true},
		{name: "query fragment", input: "/foo?bar", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NormalizeBasePath(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil and %q", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("NormalizeBasePath() error = %v", err)
			}
			if got != tt.want {
				t.Fatalf("NormalizeBasePath() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestWithAppBasePath(t *testing.T) {
	original := AppBasePath
	t.Cleanup(func() {
		AppBasePath = original
	})

	AppBasePath = "/new-api"

	tests := []struct {
		name string
		path string
		want string
	}{
		{name: "root", path: "/", want: "/new-api"},
		{name: "console", path: "/console", want: "/new-api/console"},
		{name: "already prefixed", path: "/new-api/console", want: "/new-api/console"},
		{name: "empty", path: "", want: "/new-api"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := WithAppBasePath(tt.path); got != tt.want {
				t.Fatalf("WithAppBasePath() = %q, want %q", got, tt.want)
			}
		})
	}
}
