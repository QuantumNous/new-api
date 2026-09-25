export const emptyChartSpec = {
  type: 'pie',
  data: [{}],
  background: 'rgba(0,0,0,1)',
  theme: {}
};
export const getAnimationSpec = spec => {
  if (!spec) {
    return {};
  }
  return {
    animation: spec.animation,
    animationAppear: spec.animationAppear,
    animationUpdate: spec.animationUpdate,
    animationEnter: spec.animationEnter,
    animationExit: spec.animationExit
  };
};

export const chartUpdate = (chartInstance, preChartSpec, curSpec) => {
  const preAnimationSpec = getAnimationSpec(preChartSpec);
  const curAnimationSpec = getAnimationSpec(curSpec);
  const reAnimate = JSON.stringify(preAnimationSpec) !== JSON.stringify(curAnimationSpec);
  // VChart图表分批updateSpec, 流程待图表库底层优化
  // step1. update除data外的spec
  // step2. updateData

  const specWithoutDataChange = {
    ...curSpec,
    data: preChartSpec?.data ?? [
      {
        id: 'data',
        values: []
      }
    ]
  };
  const curData = curSpec.data;
  chartInstance.updateSpec(specWithoutDataChange, false, undefined, { reAnimate: true }); // remake, 无动画
  chartInstance.updateFullDataSync(curData);
};
