const parseTaskConditionPrice = (rawTaskConditionPrice) => {
  if (!rawTaskConditionPrice) {
    return {};
  }
  try {
    const parsed = JSON.parse(rawTaskConditionPrice);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('Failed to parse TaskConditionPrice:', error);
    return {};
  }
};

export function extractTaskConditionPriceMap(rawTaskConditionPrice) {
  const parsed = parseTaskConditionPrice(rawTaskConditionPrice);
  const result = {};
  Object.entries(parsed).forEach(([modelName, resolutionMap]) => {
    if (!resolutionMap || typeof resolutionMap !== 'object') {
      return;
    }
    result[modelName] = {
      '720p_text_only': resolutionMap['720p']?.input_text_only,
      '720p_video_input': resolutionMap['720p']?.input_with_video,
      '1080p_text_only': resolutionMap['1080p']?.input_text_only,
      '1080p_video_input': resolutionMap['1080p']?.input_with_video,
    };
  });
  return result;
}

export function buildTaskConditionPriceValueFromModelMap(
  rawTaskConditionPrice,
  modelMap,
) {
  const parsed = parseTaskConditionPrice(rawTaskConditionPrice);
  const nextTaskConditionPrice = {};

  Object.entries(parsed).forEach(([modelName, value]) => {
    if (!modelMap[modelName]) {
      nextTaskConditionPrice[modelName] = value;
    }
  });

  Object.entries(modelMap).forEach(([modelName, value]) => {
    const nextModelValue = {};
    if (
      value['720p_text_only'] !== undefined ||
      value['720p_video_input'] !== undefined
    ) {
      nextModelValue['720p'] = {};
      if (value['720p_text_only'] !== undefined && value['720p_text_only'] !== null) {
        nextModelValue['720p'].input_text_only = value['720p_text_only'];
      }
      if (
        value['720p_video_input'] !== undefined &&
        value['720p_video_input'] !== null
      ) {
        nextModelValue['720p'].input_with_video = value['720p_video_input'];
      }
      if (Object.keys(nextModelValue['720p']).length === 0) {
        delete nextModelValue['720p'];
      }
    }
    if (
      value['1080p_text_only'] !== undefined ||
      value['1080p_video_input'] !== undefined
    ) {
      nextModelValue['1080p'] = {};
      if (
        value['1080p_text_only'] !== undefined &&
        value['1080p_text_only'] !== null
      ) {
        nextModelValue['1080p'].input_text_only = value['1080p_text_only'];
      }
      if (
        value['1080p_video_input'] !== undefined &&
        value['1080p_video_input'] !== null
      ) {
        nextModelValue['1080p'].input_with_video = value['1080p_video_input'];
      }
      if (Object.keys(nextModelValue['1080p']).length === 0) {
        delete nextModelValue['1080p'];
      }
    }
    if (Object.keys(nextModelValue).length > 0) {
      nextTaskConditionPrice[modelName] = nextModelValue;
    }
  });

  return JSON.stringify(nextTaskConditionPrice, null, 2);
}
