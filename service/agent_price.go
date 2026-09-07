package service

import (
	"errors"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

const agentQuoteContextKey = "server_agent_image_quote"

type lockedAgentQuote struct{ Quote *types.AgentImageQuote }

func ResolveAgentImageQuote(userID int, modelName string) (*types.AgentImageQuote, error) {
	if userID <= 0 || modelName != model.AgentImageModel {
		return nil, nil
	}
	agent, err := model.AgentForCustomer(userID)
	if err != nil || agent == nil {
		return nil, err
	}
	if agent.PriceCents < model.AgentMinimumPriceCents || agent.PriceCents > model.AgentMaximumPriceCents {
		return nil, model.ErrAgentPriceRange
	}
	rate := operation_setting.USDExchangeRate
	if rate <= 0 || math.IsNaN(rate) || math.IsInf(rate, 0) {
		return nil, errors.New("Invalid CNY conversion rate")
	}
	quota, err := common.QuotaFromDecimalStrict(decimal.NewFromInt(int64(agent.PriceCents)).Div(decimal.NewFromInt(100)).Div(decimal.NewFromFloat(rate)).Mul(decimal.NewFromFloat(common.QuotaPerUnit)))
	if err != nil {
		return nil, err
	}
	if quota <= 0 {
		return nil, errors.New("Image price is below quota precision")
	}
	return &types.AgentImageQuote{CustomerID: userID, AgentID: agent.UserID, Model: modelName, PriceCents: agent.PriceCents, UnitQuota: quota, Version: agent.Version}, nil
}

func SetLockedAgentImageQuote(c *gin.Context, quote *types.AgentImageQuote) {
	c.Set(agentQuoteContextKey, lockedAgentQuote{Quote: quote})
}

func AgentImagePrice(c *gin.Context, info *relaycommon.RelayInfo) (types.PriceData, bool, error) {
	if info.OriginModelName != model.AgentImageModel {
		return types.PriceData{}, false, nil
	}
	var quote *types.AgentImageQuote
	var err error
	if value, exists := c.Get(agentQuoteContextKey); exists {
		snapshot, ok := value.(lockedAgentQuote)
		if !ok {
			return types.PriceData{}, false, errors.New("Invalid internal price snapshot")
		}
		quote = snapshot.Quote
	} else {
		quote, err = ResolveAgentImageQuote(info.UserId, info.OriginModelName)
	}
	if err != nil {
		return types.PriceData{}, false, err
	}
	if quote == nil {
		return types.PriceData{}, false, nil
	}
	if quote.CustomerID != info.UserId || quote.Model != info.OriginModelName || quote.UnitQuota <= 0 || quote.PriceCents < 2 || quote.PriceCents > 6 {
		return types.PriceData{}, false, errors.New("Image price snapshot does not match the request")
	}
	request, ok := info.Request.(*dto.ImageRequest)
	if !ok {
		return types.PriceData{}, false, errors.New("Agent image pricing requires the Images API")
	}
	n := uint(1)
	if request.N != nil {
		n = *request.N
	}
	if n < 1 || n > dto.MaxImageN {
		return types.PriceData{}, false, errors.New("Invalid image count")
	}
	total, err := common.QuotaFromDecimalStrict(decimal.NewFromInt(int64(quote.UnitQuota)).Mul(decimal.NewFromInt(int64(n))))
	if err != nil {
		return types.PriceData{}, false, err
	}
	price := types.PriceData{UsePrice: true, ModelPrice: float64(quote.UnitQuota) / common.QuotaPerUnit, GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1, GroupSpecialRatio: -1}, QuotaToPreConsume: total, AgentImageQuote: quote, AgentImageQuota: total}
	price.AddOtherRatio("n", float64(n))
	info.PriceData = price
	return price, true, nil
}
