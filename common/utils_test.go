package common

import "testing"

func TestBytes2Size(t *testing.T) {
	tests := []struct {
		name  string
		input int64
		want  string
	}{
		{name: "bytes", input: 500, want: "500 B"},
		{name: "kilobyte", input: 1024, want: "1 KB"},
		{name: "kilobyteRounding", input: 1536, want: "1 KB"},
		{name: "megabyte", input: 1024 * 1024, want: "1 MB"},
		{name: "gigabyte", input: 1024 * 1024 * 1024, want: "1.00 GB"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Bytes2Size(tt.input); got != tt.want {
				t.Fatalf("Bytes2Size(%d) = %s, want %s", tt.input, got, tt.want)
			}
		})
	}
}
