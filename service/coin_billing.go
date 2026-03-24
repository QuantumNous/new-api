package service

import (
	"context"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	coinsdk "github.com/xmz-ai/coin/sdk/go/coin"
)

// quotaToCoins 将 new-api quota 单位换算为 coin 单位。
// QuotaPerUnit = 500000 (quota/USD), coin: 1 credit = 1 USD = 1_000_000 coins
// => 1 quota = 1_000_000 / 500_000 = 2 coins
func quotaToCoins(quota int) int64 {
	return int64(quota) * (1_000_000 / int64(common.QuotaPerUnit))
}

// coinsToQuota 将 coin 单位换算为 new-api quota 单位。
func coinsToQuota(coins int64) int {
	multiplier := int64(1_000_000 / common.QuotaPerUnit)
	if multiplier <= 0 {
		multiplier = 1
	}
	return int(coins / multiplier)
}

// ParseOutUserIDFromTokenName 从 token name 中解析 out_user_id。
// token name 格式: "agentrix-{user-xxxxx}-{apikeyName}"
// user id 格式: "user-{cuid}"（cuid 不含"-"），取前两段拼接。
func ParseOutUserIDFromTokenName(tokenName string) string {
	prefix := "agentrix-"
	if len(tokenName) <= len(prefix) || tokenName[:len(prefix)] != prefix {
		return ""
	}
	s := tokenName[len(prefix):]
	// s = "user-xxxxx-apikeyName..."
	// 找第一个 "-" 和第二个 "-" 的位置
	idx1 := -1
	idx2 := -1
	for i, ch := range s {
		if ch == '-' {
			if idx1 == -1 {
				idx1 = i
			} else {
				idx2 = i
				break
			}
		}
	}
	if idx1 == -1 || idx2 == -1 {
		return ""
	}
	return s[:idx2]
}

// ---------------------------------------------------------------------------
// CoinFundingSource — 基于 coin 服务的资金来源实现
// ---------------------------------------------------------------------------

type CoinFundingSource struct {
	outUserID     string
	taskID        string
	title         string // 交易标题，写入账户流水 title 字段
	preOutTradeNo string // 预扣时使用的 out_trade_no，退款时引用
	consumed      int64  // 预扣的 coins 数量
}

func (c *CoinFundingSource) Source() string { return "coin" }

func (c *CoinFundingSource) PreConsume(amount int) error {
	if amount <= 0 {
		return nil
	}
	coins := quotaToCoins(amount)
	outTradeNo := fmt.Sprintf("pre-%s-%d", c.taskID, time.Now().UnixMilli())
	_, err := common.GetCoinClient().Transactions.Debit(context.Background(), coinsdk.DebitRequest{
		OutTradeNo:     outTradeNo,
		DebitOutUserID: c.outUserID,
		Amount:         coins,
		Title:          "Pre-charge: " + c.title,
	})
	if err != nil {
		return err
	}
	c.preOutTradeNo = outTradeNo
	c.consumed = coins
	return nil
}

func (c *CoinFundingSource) Settle(delta int) error {
	if delta == 0 {
		return nil
	}
	coins := quotaToCoins(delta)
	if coins == 0 {
		return nil
	}
	outTradeNo := fmt.Sprintf("set-%s-%d", c.taskID, time.Now().UnixMilli())
	if delta > 0 {
		// 补扣
		_, err := common.GetCoinClient().Transactions.Debit(context.Background(), coinsdk.DebitRequest{
			OutTradeNo:     outTradeNo,
			DebitOutUserID: c.outUserID,
			Amount:         coins,
			Title:          c.title,
		})
		return err
	}
	// 退还：用 refund 退预扣交易
	if c.preOutTradeNo == "" {
		return nil
	}
	txn, err := common.GetCoinClient().Transactions.GetByOutTradeNo(context.Background(), c.preOutTradeNo)
	if err != nil {
		return err
	}
	refundAmount := -coins // coins 是负数，取反为正
	if refundAmount > txn.RefundableAmount {
		refundAmount = txn.RefundableAmount
	}
	if refundAmount <= 0 {
		return nil
	}
	_, err = common.GetCoinClient().Transactions.Refund(context.Background(), coinsdk.RefundRequest{
		OutTradeNo:    outTradeNo,
		RefundOfTxnNo: txn.TxnNo,
		Amount:        refundAmount,
		Title:         "Refund: " + c.title,
	})
	return err
}

func (c *CoinFundingSource) Refund() error {
	if c.consumed <= 0 || c.preOutTradeNo == "" {
		return nil
	}
	txn, err := common.GetCoinClient().Transactions.GetByOutTradeNo(context.Background(), c.preOutTradeNo)
	if err != nil {
		return err
	}
	refundAmount := c.consumed
	if refundAmount > txn.RefundableAmount {
		refundAmount = txn.RefundableAmount
	}
	if refundAmount <= 0 {
		return nil
	}
	outTradeNo := fmt.Sprintf("ref-%s-%d", c.taskID, time.Now().UnixMilli())
	_, err = common.GetCoinClient().Transactions.Refund(context.Background(), coinsdk.RefundRequest{
		OutTradeNo:    outTradeNo,
		RefundOfTxnNo: txn.TxnNo,
		Amount:        refundAmount,
		Title:         "Refund: " + c.title,
	})
	return err
}
