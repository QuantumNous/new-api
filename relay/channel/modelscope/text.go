package modelscope

import (
	"github.com/QuantumNous/new-api/dto"
)

func requestOpenAI2Modelscope(request dto.GeneralOpenAIRequest) *dto.GeneralOpenAIRequest {
	if request.TopP >= 1 {
		request.TopP = 0.99
	} else if request.TopP <= 0 {
		request.TopP = 0.01
	}
	return &request
}
