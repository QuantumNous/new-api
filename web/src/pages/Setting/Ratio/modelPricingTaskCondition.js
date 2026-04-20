const parseTaskConditionRatio = (rawTaskConditionRatio) => {
  if (!rawTaskConditionRatio) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawTaskConditionRatio);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    console.error('Failed to parse TaskConditionRatio:', error);
    return {};
  }
};

export function extractVideoInputRatioMap(rawTaskConditionRatio) {
  const parsed = parseTaskConditionRatio(rawTaskConditionRatio);
  const videoInput = parsed.video_input;
  return videoInput &&
    typeof videoInput === 'object' &&
    !Array.isArray(videoInput)
    ? videoInput
    : {};
}

export function buildTaskConditionRatioValueFromVideoInputMap(
  rawTaskConditionRatio,
  videoInputRatioMap,
) {
  const parsed = parseTaskConditionRatio(rawTaskConditionRatio);
  const nextTaskConditionRatio = { ...parsed };

  if (videoInputRatioMap && Object.keys(videoInputRatioMap).length > 0) {
    nextTaskConditionRatio.video_input = videoInputRatioMap;
  } else {
    delete nextTaskConditionRatio.video_input;
  }

  return JSON.stringify(nextTaskConditionRatio, null, 2);
}
