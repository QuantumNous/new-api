package ali

import (
	"github.com/QuantumNous/new-api/dto"
	"github.com/samber/lo"
)

// https://help.aliyun.com/document_detail/613695.html?spm=a2c4g.2399480.0.0.1adb778fAdzP9w#341800c0f8w0r

const EnableSearchModelSuffix = "-internet"

func requestOpenAI2Ali(request dto.GeneralOpenAIRequest) *dto.GeneralOpenAIRequest {
	topP := lo.FromPtrOr(request.TopP, 0)
	if topP >= 1 {
		request.TopP = lo.ToPtr(0.999)
	} else if topP <= 0 {
		request.TopP = lo.ToPtr(0.001)
	}
	return &request
}
