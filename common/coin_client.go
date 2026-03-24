package common

import (
	"os"
	"sync"

	coinsdk "github.com/xmz-ai/coin/sdk/go/coin"
)

var (
	coinClientOnce sync.Once
	coinClient     *coinsdk.Client
)

func GetCoinClient() *coinsdk.Client {
	coinClientOnce.Do(func() {
		c, err := coinsdk.NewClient(coinsdk.ClientOptions{
			BaseURL:        os.Getenv("COIN_BASE_URL"),
			MerchantNo:     os.Getenv("COIN_MERCHANT_NO"),
			MerchantSecret: os.Getenv("COIN_MERCHANT_SECRET"),
		})
		if err != nil {
			panic("coin client init failed: " + err.Error())
		}
		coinClient = c
	})
	return coinClient
}
