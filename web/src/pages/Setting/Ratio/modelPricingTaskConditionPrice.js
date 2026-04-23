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

const CONTROLLED_TASK_CONDITION_FIELDS = {
  '720p_text_only': ['720p', 'input_text_only'],
  '720p_video_input': ['720p', 'input_with_video'],
  '1080p_text_only': ['1080p', 'input_text_only'],
  '1080p_video_input': ['1080p', 'input_with_video'],
};

const cloneTaskConditionResolutionMap = (value) => {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return JSON.parse(JSON.stringify(value));
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
  const nextTaskConditionPrice = cloneTaskConditionResolutionMap(parsed);

  Object.entries(modelMap).forEach(([modelName, value]) => {
    const nextModelValue = cloneTaskConditionResolutionMap(parsed[modelName]);

    Object.entries(CONTROLLED_TASK_CONDITION_FIELDS).forEach(
      ([fieldKey, [resolution, conditionKey]]) => {
        const fieldValue = value[fieldKey];
        if (fieldValue === undefined) {
          return;
        }

        if (fieldValue === null) {
          if (nextModelValue[resolution] && typeof nextModelValue[resolution] === 'object') {
            delete nextModelValue[resolution][conditionKey];
            if (Object.keys(nextModelValue[resolution]).length === 0) {
              delete nextModelValue[resolution];
            }
          }
          return;
        }

        if (!nextModelValue[resolution] || typeof nextModelValue[resolution] !== 'object') {
          nextModelValue[resolution] = {};
        }
        nextModelValue[resolution][conditionKey] = fieldValue;
      },
    );

    if (Object.keys(nextModelValue).length > 0) {
      nextTaskConditionPrice[modelName] = nextModelValue;
    } else {
      delete nextTaskConditionPrice[modelName];
    }
  });

  return JSON.stringify(nextTaskConditionPrice, null, 2);
}
