//go:build unix
// +build unix

package utils

import (
	"testing"
)

func TestSourceDir(t *testing.T) {
	cases := []struct {
		file string
		want string
	}{
		{
			file: "/Users/name/go/pkg/mod/gorm.io/gorm@v1.2.3/utils/utils.go",
			want: "/Users/name/go/pkg/mod/gorm.io/",
		},
		{
			file: "/go/work/proj/gorm/utils/utils.go",
			want: "/go/work/proj/gorm/",
		},
		{
			file: "/go/work/proj/gorm_alias/utils/utils.go",
			want: "/go/work/proj/gorm_alias/",
		},
		{
			file: "/go/work/proj/my.gorm.io/gorm@v1.2.3/utils/utils.go",
			want: "/go/work/proj/my.gorm.io/gorm@v1.2.3/",
		},
	}
	for _, c := range cases {
		s := sourceDir(c.file)
		if s != c.want {
			t.Fatalf("%s: expected %s, got %s", c.file, c.want, s)
		}
	}
}
