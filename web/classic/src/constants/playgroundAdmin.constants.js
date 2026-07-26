// 体验区「分类 → tab」中央元数据：新「体验区管理」admin 页与各页 tab 显隐过滤
// 共用的唯一真相源。key=稳定标识（分类=侧栏 itemKey / 存储配置键；tab=各页 mode
// key，不用显示名以免改名破坏配置）；capability=该 tab 过滤模型用的能力标签。
// 文本模型（对话）无 tab、无能力标签、无媒体配置（靠排除媒体模型过滤），仅参与分类显隐。

export const PLAYGROUND_CATEGORIES = [
  {
    key: 'playground',
    label: '文本模型',
    configKey: null,
    tabs: [],
  },
  {
    key: 'image',
    label: '图像模型', // 由「图片模型」改名
    configKey: 'ImageModelSizeConfig',
    tabs: [
      { key: 'text2image', label: '文生图', capability: '文生图' },
      { key: 'image2image', label: '图生图', capability: '图生图' },
    ],
  },
  {
    key: 'video',
    label: '视频模型',
    configKey: 'VideoModelConfig',
    tabs: [
      { key: 'text2video', label: '文生视频', capability: '文生视频' },
      { key: 'image2video', label: '图生视频', capability: '图生视频' },
      { key: 'flf2v', label: '关键帧', capability: '关键帧' },
      { key: 's2v', label: '数字人', capability: '数字人' },
      { key: 'vace', label: '视频编辑', capability: '视频编辑' },
    ],
  },
  {
    key: 'audio',
    label: '语音模型',
    configKey: 'AudioModelConfig',
    tabs: [
      { key: 'emotion', label: '情感合成', capability: '情感合成' },
      { key: 'synthesis', label: '语音合成', capability: '语音合成' },
      { key: 'dialogue', label: '双人对话', capability: '双人对话' },
      { key: 'design', label: '声音设计', capability: '声音设计' },
      // 视频配音：入口挂在语音页，产物是视频（走 VideoPlaygroundBody mode=dub）。
      { key: 'dub', label: '视频配音', capability: '视频配音' },
    ],
  },
  {
    key: 'music',
    label: '音乐模型',
    configKey: 'MusicModelConfig',
    tabs: [
      { key: 't2m', label: '文生音乐', capability: '文生音乐' },
      { key: 'cover', label: '音乐改编', capability: '音乐改编' },
      { key: 'repaint', label: '音乐重绘', capability: '音乐重绘' },
      { key: 't2a', label: '文生音效', capability: '文生音效' },
      { key: 'svs', label: '歌声合成', capability: '歌声合成' },
    ],
  },
];

export const getPlaygroundCategory = (key) =>
  PLAYGROUND_CATEGORIES.find((c) => c.key === key) || null;

// 解析 /api/status 的 PlaygroundTabConfig（{category:{modeKey:bool}}）。
export const parsePlaygroundTabConfig = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
};

// tab 是否显示：缺省（未配置）=显示；仅显式 false 才隐藏。
export const isPlaygroundTabVisible = (tabConfig, category, modeKey) => {
  const cat = tabConfig && tabConfig[category];
  if (!cat) return true;
  return cat[modeKey] !== false;
};
