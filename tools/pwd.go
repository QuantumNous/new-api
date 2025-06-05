package main

import (
	"bufio"
	"fmt"
	"github.com/joho/godotenv"
	"os"
	"strings"

	"one-api/common"
)

func main() {
	reader := bufio.NewReader(os.Stdin)
	fmt.Print("PASSWORD: ")
	plainPwd, _ := reader.ReadString('\n')
	plainPwd = strings.TrimSpace(plainPwd)

	fmt.Print("SESSION_SECRET: ")
	secret, _ := reader.ReadString('\n')
	secret = strings.TrimSpace(secret)
	if secret == "" {
		err := godotenv.Load()
		if err != nil {
			return
		}
		secret = os.Getenv("SESSION_SECRET")
	}

	defaultPrefix := "{AES}"
	if strings.HasPrefix(plainPwd, defaultPrefix) {
		dec, err := common.DecryptAES(strings.TrimPrefix(plainPwd, defaultPrefix), secret)
		fmt.Println(dec, err)
		return
	}
	enc, err := common.EncryptAES(plainPwd, secret)
	fmt.Println(enc, err)
}
