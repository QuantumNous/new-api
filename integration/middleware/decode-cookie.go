package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/gin-contrib/sessions/cookie"
)

type Result struct {
	OK       bool   `json:"ok"`
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
	Role     int    `json:"role"`
	Status   int    `json:"status"`
	Group    string `json:"group"`
	Error    string `json:"error,omitempty"`
}

func main() {
	if len(os.Args) < 2 {
		fmt.Println(`{"ok":false,"error":"usage: decode-cookie <cookie_value>"}`)
		os.Exit(1)
	}
	cookieVal := os.Args[1]
	secretStr := os.Getenv("SESSION_SECRET")
	if secretStr == "" {
		secretStr = "e6e60c89fa342258a3e995e0997290eb92656f1bc517759520f98c9b04f66b49"
	}
	store := cookie.NewStore([]byte(secretStr))
	req, _ := http.NewRequest("GET", "https://router.atius.com.br/", nil)
	req.Header.Set("Cookie", "session="+cookieVal)
	session, err := store.Get(req, "session")
	if err != nil {
		out, _ := json.Marshal(Result{OK: false, Error: err.Error()})
		fmt.Println(string(out))
		os.Exit(1)
	}
	r := Result{OK: true}
	if v, ok := session.Values["id"].(int); ok {
		r.UserID = v
	}
	if v, ok := session.Values["username"].(string); ok {
		r.Username = v
	}
	if v, ok := session.Values["role"].(int); ok {
		r.Role = v
	}
	if v, ok := session.Values["status"].(int); ok {
		r.Status = v
	}
	if v, ok := session.Values["group"].(string); ok {
		r.Group = v
	}
	out, _ := json.Marshal(r)
	fmt.Println(string(out))
}
