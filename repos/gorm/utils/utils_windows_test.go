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
			file: `C:/Users/name/go/pkg/mod/gorm.io/gorm@v1.2.3/utils/utils.go`,
			want: `C:/Users/name/go/pkg/mod/gorm.io/`,
		},
		{
			file: `C:/go/work/proj/gorm/utils/utils.go`,
			want: `C:/go/work/proj/gorm/`,
		},
		{
			file: `C:/go/work/proj/gorm_alias/utils/utils.go`,
			want: `C:/go/work/proj/gorm_alias/`,
		},
		{
			file: `C:/go/work/proj/my.gorm.io/gorm@v1.2.3/utils/utils.go`,
			want: `C:/go/work/proj/my.gorm.io/gorm@v1.2.3/`,
		},
	}
	for _, c := range cases {
		s := sourceDir(c.file)
		if s != c.want {
			t.Fatalf("%s: expected %s, got %s", c.file, c.want, s)
		}
	}
}
