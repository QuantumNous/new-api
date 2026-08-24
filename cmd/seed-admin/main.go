package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func main() {
	var (
		username = flag.String("username", "admin", "用户名")
		password = flag.String("password", "123456", "明文密码（自动 bcrypt 哈希）")
		role     = flag.Int("role", common.RoleAdminUser, "用户角色 (10=admin, 100=root)")
	)
	flag.Parse()

	// SQLite 文件路径保持和 new-api 默认一致。
	os.Setenv("SQLITE_PATH", "one-api.db?_busy_timeout=30000")

	// 关闭 Redis：seed 脚本无外部依赖，禁用 Redis 避免触发 user_cache 的 nil deref。
	common.RedisEnabled = false
	common.RDB = nil

	common.InitEnv()
	if err := model.InitDB(); err != nil {
		log.Fatalf("init db: %v", err)
	}

	if *role != common.RoleAdminUser && *role != common.RoleRootUser {
		log.Fatalf("unsupported role %d (only 10=admin or 100=root)", *role)
	}

	hash, err := common.Password2Hash(*password)
	if err != nil {
		log.Fatalf("hash: %v", err)
	}

	// 已存在则直接重置密码与角色；不存在则插入。
	res := model.DB.Model(&model.User{}).
		Where("username = ?", *username).
		Updates(map[string]interface{}{
			"password":     hash,
			"role":         *role,
			"status":       common.UserStatusEnabled,
			"display_name": *username,
			"group":        "default",
		})
	if err := res.Error; err != nil {
		log.Fatalf("update: %v", err)
	}
	if res.RowsAffected == 0 {
		u := model.User{
			Username:    *username,
			Password:    hash,
			Role:        *role,
			Status:      common.UserStatusEnabled,
			DisplayName: *username,
			Group:       "default",
		}
		if err := u.Insert(0); err != nil {
			log.Fatalf("insert: %v", err)
		}
		fmt.Printf("[seed] created user %q (id=%d, role=%d)\n", *username, u.Id, *role)
		return
	}
	var existing model.User
	if err := model.DB.Where("username = ?", *username).First(&existing).Error; err != nil {
		log.Fatalf("read back: %v", err)
	}
	fmt.Printf("[seed] reset user %q (id=%d, role=%d, status=%d)\n", existing.Username, existing.Id, existing.Role, existing.Status)
}