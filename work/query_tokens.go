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

	rows, err := db.Query(`select id, name, key, remain_quota, used_quota from tokens order by id desc limit 10`)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	for rows.Next() {
		var id int
		var name, key string
		var remainQuota, usedQuota int
		if err := rows.Scan(&id, &name, &key, &remainQuota, &usedQuota); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("%d\t%s\t%s\t%d\t%d\n", id, name, key, remainQuota, usedQuota)
	}
}
