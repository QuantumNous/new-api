import OpenAIMono from '@lobehub/icons/es/OpenAI/components/Mono';
import ClaudeMono from '@lobehub/icons/es/Claude/components/Mono';
import ClaudeColor from '@lobehub/icons/es/Claude/components/Color';
import GeminiMono from '@lobehub/icons/es/Gemini/components/Mono';
import GeminiColor from '@lobehub/icons/es/Gemini/components/Color';
import MoonshotMono from '@lobehub/icons/es/Moonshot/components/Mono';
import ZhipuMono from '@lobehub/icons/es/Zhipu/components/Mono';
import ZhipuColor from '@lobehub/icons/es/Zhipu/components/Color';
import QwenMono from '@lobehub/icons/es/Qwen/components/Mono';
import QwenColor from '@lobehub/icons/es/Qwen/components/Color';
import DeepSeekMono from '@lobehub/icons/es/DeepSeek/components/Mono';
import DeepSeekColor from '@lobehub/icons/es/DeepSeek/components/Color';
import MinimaxMono from '@lobehub/icons/es/Minimax/components/Mono';
import MinimaxColor from '@lobehub/icons/es/Minimax/components/Color';
import WenxinMono from '@lobehub/icons/es/Wenxin/components/Mono';
import WenxinColor from '@lobehub/icons/es/Wenxin/components/Color';
import SparkMono from '@lobehub/icons/es/Spark/components/Mono';
import SparkColor from '@lobehub/icons/es/Spark/components/Color';
import MidjourneyMono from '@lobehub/icons/es/Midjourney/components/Mono';
import HunyuanMono from '@lobehub/icons/es/Hunyuan/components/Mono';
import HunyuanColor from '@lobehub/icons/es/Hunyuan/components/Color';
import CohereMono from '@lobehub/icons/es/Cohere/components/Mono';
import CohereColor from '@lobehub/icons/es/Cohere/components/Color';
import CloudflareMono from '@lobehub/icons/es/Cloudflare/components/Mono';
import CloudflareColor from '@lobehub/icons/es/Cloudflare/components/Color';
import Ai360Mono from '@lobehub/icons/es/Ai360/components/Mono';
import Ai360Color from '@lobehub/icons/es/Ai360/components/Color';
import YiMono from '@lobehub/icons/es/Yi/components/Mono';
import YiColor from '@lobehub/icons/es/Yi/components/Color';
import JinaMono from '@lobehub/icons/es/Jina/components/Mono';
import MistralMono from '@lobehub/icons/es/Mistral/components/Mono';
import MistralColor from '@lobehub/icons/es/Mistral/components/Color';
import XAIMono from '@lobehub/icons/es/XAI/components/Mono';
import OllamaMono from '@lobehub/icons/es/Ollama/components/Mono';
import DoubaoMono from '@lobehub/icons/es/Doubao/components/Mono';
import DoubaoColor from '@lobehub/icons/es/Doubao/components/Color';
import SunoMono from '@lobehub/icons/es/Suno/components/Mono';
import XinferenceMono from '@lobehub/icons/es/Xinference/components/Mono';
import XinferenceColor from '@lobehub/icons/es/Xinference/components/Color';
import OpenRouterMono from '@lobehub/icons/es/OpenRouter/components/Mono';
import DifyColor from '@lobehub/icons/es/Dify/components/Color';
import CozeMono from '@lobehub/icons/es/Coze/components/Mono';
import SiliconCloudMono from '@lobehub/icons/es/SiliconCloud/components/Mono';
import SiliconCloudColor from '@lobehub/icons/es/SiliconCloud/components/Color';
import KlingMono from '@lobehub/icons/es/Kling/components/Mono';
import KlingColor from '@lobehub/icons/es/Kling/components/Color';
import PerplexityMono from '@lobehub/icons/es/Perplexity/components/Mono';
import PerplexityColor from '@lobehub/icons/es/Perplexity/components/Color';
import ReplicateMono from '@lobehub/icons/es/Replicate/components/Mono';
import VolcengineMono from '@lobehub/icons/es/Volcengine/components/Mono';
import VolcengineColor from '@lobehub/icons/es/Volcengine/components/Color';
import QingyanMono from '@lobehub/icons/es/Qingyan/components/Mono';
import QingyanColor from '@lobehub/icons/es/Qingyan/components/Color';
import GrokMono from '@lobehub/icons/es/Grok/components/Mono';
import AzureAIMono from '@lobehub/icons/es/AzureAI/components/Mono';
import AzureAIColor from '@lobehub/icons/es/AzureAI/components/Color';

const DEFAULT_AVATAR_BG = 'var(--semi-color-primary)';
const DEFAULT_AVATAR_FG = '#ffffff';

const SIZE_MAP = {
  small: 16,
  default: 24,
  large: 32,
  'extra-small': 16,
  'extra-extra-small': 14,
  'extra-large': 40,
  'extra-extra-large': 48,
};

function resolveSize(size, fallback = 24) {
  if (typeof size === 'number' && Number.isFinite(size)) return size;
  if (typeof size === 'string') return SIZE_MAP[size] || fallback;
  return fallback;
}

function createIconAvatar(IconComponent, background = DEFAULT_AVATAR_BG) {
  const IconAvatar = ({
    background: customBackground,
    color = DEFAULT_AVATAR_FG,
    iconMultiple = 0.75,
    iconStyle,
    shape = 'circle',
    size = 24,
    style,
    ...rest
  }) => {
    const avatarSize = resolveSize(size);
    const iconSize = Math.max(12, Math.round(avatarSize * iconMultiple));

    return (
      <span
        {...rest}
        style={{
          alignItems: 'center',
          background: customBackground || background,
          borderRadius: shape === 'square' ? Math.floor(avatarSize * 0.1) : '50%',
          color,
          display: 'inline-flex',
          height: avatarSize,
          justifyContent: 'center',
          overflow: 'hidden',
          width: avatarSize,
          ...style,
        }}
      >
        <IconComponent color={color} size={iconSize} style={iconStyle} />
      </span>
    );
  };

  return IconAvatar;
}

function createLobeIcon(
  MonoComponent,
  {
    ColorComponent = null,
    avatarBackground = DEFAULT_AVATAR_BG,
  } = {},
) {
  const BaseIcon = MonoComponent;
  BaseIcon.Mono = MonoComponent;
  if (ColorComponent) {
    BaseIcon.Color = ColorComponent;
  }
  BaseIcon.Avatar = createIconAvatar(
    ColorComponent || MonoComponent,
    avatarBackground,
  );
  return BaseIcon;
}

export const OpenAI = createLobeIcon(OpenAIMono, {
  avatarBackground: '#111827',
});
export const Claude = createLobeIcon(ClaudeMono, {
  ColorComponent: ClaudeColor,
  avatarBackground: '#d97706',
});
export const Gemini = createLobeIcon(GeminiMono, {
  ColorComponent: GeminiColor,
  avatarBackground: '#2563eb',
});
export const Moonshot = createLobeIcon(MoonshotMono, {
  avatarBackground: '#111827',
});
export const Zhipu = createLobeIcon(ZhipuMono, {
  ColorComponent: ZhipuColor,
  avatarBackground: '#2563eb',
});
export const Qwen = createLobeIcon(QwenMono, {
  ColorComponent: QwenColor,
  avatarBackground: '#7c3aed',
});
export const DeepSeek = createLobeIcon(DeepSeekMono, {
  ColorComponent: DeepSeekColor,
  avatarBackground: '#2563eb',
});
export const Minimax = createLobeIcon(MinimaxMono, {
  ColorComponent: MinimaxColor,
  avatarBackground: '#dc2626',
});
export const Wenxin = createLobeIcon(WenxinMono, {
  ColorComponent: WenxinColor,
  avatarBackground: '#2563eb',
});
export const Spark = createLobeIcon(SparkMono, {
  ColorComponent: SparkColor,
  avatarBackground: '#ea580c',
});
export const Midjourney = createLobeIcon(MidjourneyMono, {
  avatarBackground: '#111827',
});
export const Hunyuan = createLobeIcon(HunyuanMono, {
  ColorComponent: HunyuanColor,
  avatarBackground: '#0f766e',
});
export const Cohere = createLobeIcon(CohereMono, {
  ColorComponent: CohereColor,
  avatarBackground: '#dc2626',
});
export const Cloudflare = createLobeIcon(CloudflareMono, {
  ColorComponent: CloudflareColor,
  avatarBackground: '#f97316',
});
export const Ai360 = createLobeIcon(Ai360Mono, {
  ColorComponent: Ai360Color,
  avatarBackground: '#16a34a',
});
export const Yi = createLobeIcon(YiMono, {
  ColorComponent: YiColor,
  avatarBackground: '#2563eb',
});
export const Jina = createLobeIcon(JinaMono, {
  avatarBackground: '#111827',
});
export const Mistral = createLobeIcon(MistralMono, {
  ColorComponent: MistralColor,
  avatarBackground: '#ea580c',
});
export const XAI = createLobeIcon(XAIMono, {
  avatarBackground: '#111827',
});
export const Ollama = createLobeIcon(OllamaMono, {
  avatarBackground: '#111827',
});
export const Doubao = createLobeIcon(DoubaoMono, {
  ColorComponent: DoubaoColor,
  avatarBackground: '#2563eb',
});
export const Suno = createLobeIcon(SunoMono, {
  avatarBackground: '#111827',
});
export const Xinference = createLobeIcon(XinferenceMono, {
  ColorComponent: XinferenceColor,
  avatarBackground: '#059669',
});
export const OpenRouter = createLobeIcon(OpenRouterMono, {
  avatarBackground: '#111827',
});
export const Dify = createLobeIcon(DifyColor, {
  avatarBackground: '#4f46e5',
});
export const Coze = createLobeIcon(CozeMono, {
  avatarBackground: '#111827',
});
export const SiliconCloud = createLobeIcon(SiliconCloudMono, {
  ColorComponent: SiliconCloudColor,
  avatarBackground: '#2563eb',
});
export const FastGPT = createLobeIcon(DifyColor, {
  avatarBackground: '#4f46e5',
});
export const Kling = createLobeIcon(KlingMono, {
  ColorComponent: KlingColor,
  avatarBackground: '#2563eb',
});
export const Jimeng = createLobeIcon(DoubaoMono, {
  ColorComponent: DoubaoColor,
  avatarBackground: '#2563eb',
});
export const Perplexity = createLobeIcon(PerplexityMono, {
  ColorComponent: PerplexityColor,
  avatarBackground: '#0f766e',
});
export const Replicate = createLobeIcon(ReplicateMono, {
  avatarBackground: '#111827',
});
export const Volcengine = createLobeIcon(VolcengineMono, {
  ColorComponent: VolcengineColor,
  avatarBackground: '#dc2626',
});
export const Qingyan = createLobeIcon(QingyanMono, {
  ColorComponent: QingyanColor,
  avatarBackground: '#9333ea',
});
export const Grok = createLobeIcon(GrokMono, {
  avatarBackground: '#111827',
});
export const AzureAI = createLobeIcon(AzureAIMono, {
  ColorComponent: AzureAIColor,
  avatarBackground: '#2563eb',
});

export const LOBE_ICON_REGISTRY = {
  OpenAI,
  Claude,
  Gemini,
  Moonshot,
  Zhipu,
  Qwen,
  DeepSeek,
  Minimax,
  Wenxin,
  Spark,
  Midjourney,
  Hunyuan,
  Cohere,
  Cloudflare,
  Ai360,
  Yi,
  Jina,
  Mistral,
  XAI,
  Ollama,
  Doubao,
  Suno,
  Xinference,
  OpenRouter,
  Dify,
  Coze,
  SiliconCloud,
  FastGPT,
  Kling,
  Jimeng,
  Perplexity,
  Replicate,
  Volcengine,
  Qingyan,
  Grok,
  AzureAI,
};
