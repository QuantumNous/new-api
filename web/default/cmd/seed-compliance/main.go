package main

import (
	"log"
	"os"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func main() {
	os.Setenv("SQLITE_PATH", "one-api.db?_busy_timeout=30000")
	common.RedisEnabled = false
	common.RDB = nil
	common.InitEnv()
	if err := model.InitDB(); err != nil {
		log.Fatalf("init db: %v", err)
	}
	updates := map[string]string{
		"payment_setting.compliance_confirmed":     "true",
		"payment_setting.compliance_terms_version": "v1",
	}
	for k, v := range updates {
		if err := model.UpdateOption(k, v); err != nil {
			log.Fatalf("update %s: %v", k, err)
		}
		log.Printf("[seed-compliance] %s = %s", k, v)
	}
}
