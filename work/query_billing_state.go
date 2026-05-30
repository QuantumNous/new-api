package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
)

func main() {
	db, err := sql.Open("sqlite", `F:/aicoding/newapi/one-api.db?_busy_timeout=30000`)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	var userQuota int
	if err := db.QueryRow(`select quota from users where id = 1`).Scan(&userQuota); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("user_quota\t%d\n", userQuota)

	rows, err := db.Query(`
		select id, model_name, quota, prompt_tokens, completion_tokens, token_name, request_id
		from logs
		where model_name in ('qwen3-tts-flash', 'qwen-voice-enrollment', 'MiniMax/speech-02-turbo')
		order by id desc
		limit 10`)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	for rows.Next() {
		var id, quota, promptTokens, completionTokens int
		var modelName, tokenName, requestID string
		if err := rows.Scan(&id, &modelName, &quota, &promptTokens, &completionTokens, &tokenName, &requestID); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("log\t%d\t%s\t%d\t%d\t%d\t%s\t%s\n", id, modelName, quota, promptTokens, completionTokens, tokenName, requestID)
	}
}
