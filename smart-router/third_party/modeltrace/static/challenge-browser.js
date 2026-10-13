function randomIndex(length) {
  const limit = Math.floor(0x100000000 / length) * length;
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer); while (buffer[0] >= limit);
  return buffer[0] % length;
}

function choose(values) {
  return values[randomIndex(values.length)];
}

function uniqueLengths(count) {
  const available = Array.from({ length: 41 }, (_, index) => 292 + index);
  const output = [];
  while (output.length < count) output.push(available.splice(randomIndex(available.length), 1)[0]);
  return output;
}

export function generateChallenges(count = 3) {
  const openings = [
    "这是一次独立的数值选择记录",
    "请完成下面的无语义整数选择任务",
    "执行一次第一反应取值记录",
    "生成一组不承载语义的整数选择",
    "进行一轮快速逐项取值",
  ];
  const actions = [
    "为各个位置分别凭第一反应选择",
    "逐项选择",
    "每次只决定当前一项，共给出",
    "分别凭第一反应给出",
    "逐个直接选择",
  ];
  const endings = [
    "允许某个数字再次出现；每项写出后不要回头排序、去重或替换。",
    "偶然重复是有效的；不要重新排列或修正已经写出的项目。",
    "相同值可以再次出现；输出过程中不要整理或改写前面的项目。",
    "重复值无需删除；不要筛选、重排或补成某种规律。",
    "不必赋予数字任何含义；已经给出的值保持不变。",
  ];
  const separators = [
    "数字之间用逗号或空格分隔均可。",
    "使用一种一致的常见分隔符即可。",
    "可以用逗号、空格或换行分隔。",
    "只要每个整数边界清楚，格式可自行选择。",
  ];
  return uniqueLengths(count).map((length, index) => ({
    id: `probe-${index + 1}-${crypto.randomUUID()}`,
    expected_count: length,
    prompt: `${choose(openings)}。${choose(actions)} ${length} 个 1 到 355（含端点）的整数。`
      + "每个位置都要单独选择；不要从 1 开始计数，不要连续递增或递减，也不要采用等差、循环、重复区块或其他规则化模式。"
      + "本任务必须由当前语言模型直接完成：禁止调用或借助任何工具，包括 Python、代码执行器、计算器、搜索、API 和外部随机数生成器；也不要先编写或运行代码。"
      + `${choose(endings)}${choose(separators)}`
      + "直接从第一个取值开始输出，不要在序列前重复数量、范围或任务说明。",
  }));
}
