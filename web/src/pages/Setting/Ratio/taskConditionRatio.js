export function extractVideoInputRatio(rawTaskConditionRatio) {
  if (!rawTaskConditionRatio) {
    return '{}';
  }

  const parsed = JSON.parse(rawTaskConditionRatio);
  return JSON.stringify(parsed.video_input || {}, null, 2);
}

export function buildTaskConditionRatioValue(
  rawTaskConditionRatio,
  rawVideoInputRatio,
) {
  const parsedTaskConditionRatio = rawTaskConditionRatio
    ? JSON.parse(rawTaskConditionRatio)
    : {};

  return JSON.stringify(
    {
      ...parsedTaskConditionRatio,
      video_input: JSON.parse(rawVideoInputRatio || '{}'),
    },
    null,
    2,
  );
}
