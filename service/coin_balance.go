package service

import (
	"context"
	"errors"

	"github.com/QuantumNous/new-api/common"
	coinsdk "github.com/xmz-ai/coin/sdk/go/coin"
)

// GetCoinBalance 查询 coin 服务中用户的余额，转换为 new-api quota 单位返回。
// 若用户不存在（404），返回 0 余额而非错误。
func GetCoinBalance(outUserID string) (int, error) {
	resp, err := common.GetCoinClient().Customers.GetBalance(context.Background(), outUserID)
	if err != nil {
		var apiErr *coinsdk.APIError
		if errors.As(err, &apiErr) && apiErr.HTTPStatus == 404 {
			return 0, nil
		}
		return 0, err
	}
	return coinsToQuota(resp.Balance), nil
}
