package pool

import (
	"time"
)

func (cn *Conn) SetCreatedAt(tm time.Time) {
	cn.createdAt = tm
}
