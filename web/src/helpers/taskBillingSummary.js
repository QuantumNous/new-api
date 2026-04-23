export function isTaskLog(other) {
  return other?.is_task === true || other?.task_id != null;
}

export function buildTaskBillingSummaryLines({
  other,
  content,
  t,
  formatPrice,
}) {
  if (!isTaskLog(other)) {
    return [];
  }

  const lines = [];
  const conditionalInputPrice = Number(other?.conditional_input_price);

  if (Number.isFinite(conditionalInputPrice) && conditionalInputPrice > 0) {
    lines.push(
      t('输入价格 {{price}} / 1M tokens', {
        price: formatPrice(conditionalInputPrice),
      }),
    );
  }

  if (content) {
    lines.push(content);
  } else if (other?.task_id != null) {
    lines.push(t('异步任务结算'));
  } else {
    lines.push(t('任务预扣费（将在任务完成后按实际token重算）'));
  }

  return lines;
}
