export const feedbackCategoryDefinitions = [
  {
    value: 'bug',
    labelKey: '问题反馈',
    descriptionKey: '反馈报错、异常行为、兼容性问题或功能不可用。',
    tagColor: 'red',
  },
  {
    value: 'consulting',
    labelKey: '采购咨询',
    descriptionKey: '适用于套餐、计费、部署、私有化或商务合作咨询。',
    tagColor: 'blue',
  },
  {
    value: 'feature',
    labelKey: '产品建议',
    descriptionKey: '适用于功能建议、体验优化和工作流改进。',
    tagColor: 'green',
  },
  {
    value: 'other',
    labelKey: '其他反馈',
    descriptionKey: '无法归类的问题、补充信息或其他说明。',
    tagColor: 'grey',
  },
];

export const getFeedbackCategoryOptions = (t) =>
  feedbackCategoryDefinitions.map((definition) => ({
    ...definition,
    label: t(definition.labelKey),
    description: t(definition.descriptionKey),
  }));

export const getFeedbackCategoryMeta = (value, t) => {
  const matched = feedbackCategoryDefinitions.find(
    (definition) => definition.value === value,
  );

  if (!matched) {
    return {
      value,
      label: value,
      description: '',
      tagColor: 'blue',
    };
  }

  return {
    ...matched,
    label: t(matched.labelKey),
    description: t(matched.descriptionKey),
  };
};

export const getFeedbackCategoryLabel = (value, t) =>
  getFeedbackCategoryMeta(value, t).label;
