package main

import (
	"database/sql"
	"log"
	"strings"

	_ "modernc.org/sqlite"
)

func main() {
	db, err := sql.Open("sqlite", `F:/aicoding/newapi/one-api.db?_busy_timeout=30000`)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	var models string
	if err := db.QueryRow(`select models from channels where id = 1`).Scan(&models); err != nil {
		log.Fatal(err)
	}

	want := []string{"MiniMax/speech-02-turbo", "minimax-tts", "qwen3-tts-vc-realtime-2026-01-15"}
	existing := map[string]bool{}
	items := strings.Split(models, ",")
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		existing[item] = true
	}
	for _, model := range want {
		if !existing[model] {
			items = append(items, model)
		}
	}
	newModels := strings.Join(items, ",")

	tx, err := db.Begin()
	if err != nil {
		log.Fatal(err)
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`update channels set models = ? where id = 1`, newModels); err != nil {
		log.Fatal(err)
	}
	for _, model := range want {
		if _, err := tx.Exec(`insert or ignore into abilities ("group", model, channel_id, enabled, priority, weight, tag) values (?, ?, 1, 1, 0, 0, null)`, "default", model); err != nil {
			log.Fatal(err)
		}
	}
	if err := tx.Commit(); err != nil {
		log.Fatal(err)
	}
}
