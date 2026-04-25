import i18next from 'i18next';
import React, { useState, useEffect } from 'react';
import { Avatar } from '@douyinfe/semi-ui';
import OpenAI from '@lobehub/icons/es/OpenAI';
import Claude from '@lobehub/icons/es/Claude';
import Gemini from '@lobehub/icons/es/Gemini';
import Moonshot from '@lobehub/icons/es/Moonshot';
import Zhipu from '@lobehub/icons/es/Zhipu';
import Qwen from '@lobehub/icons/es/Qwen';
import DeepSeek from '@lobehub/icons/es/DeepSeek';
import Minimax from '@lobehub/icons/es/Minimax';
import Wenxin from '@lobehub/icons/es/Wenxin';
import Spark from '@lobehub/icons/es/Spark';
import Midjourney from '@lobehub/icons/es/Midjourney';
import Hunyuan from '@lobehub/icons/es/Hunyuan';
import Cohere from '@lobehub/icons/es/Cohere';
import Cloudflare from '@lobehub/icons/es/Cloudflare';
import Ai360 from '@lobehub/icons/es/Ai360';
import Yi from '@lobehub/icons/es/Yi';
import Jina from '@lobehub/icons/es/Jina';
import Mistral from '@lobehub/icons/es/Mistral';
import XAI from '@lobehub/icons/es/XAI';
import Ollama from '@lobehub/icons/es/Ollama';
import Doubao from '@lobehub/icons/es/Doubao';
import Suno from '@lobehub/icons/es/Suno';
import Xinference from '@lobehub/icons/es/Xinference';
import OpenRouter from '@lobehub/icons/es/OpenRouter';
import Dify from '@lobehub/icons/es/Dify';
import Coze from '@lobehub/icons/es/Coze';
import SiliconCloud from '@lobehub/icons/es/SiliconCloud';
import FastGPT from '@lobehub/icons/es/FastGPT';
import Kling from '@lobehub/icons/es/Kling';
import Jimeng from '@lobehub/icons/es/Jimeng';
import Perplexity from '@lobehub/icons/es/Perplexity';
import Replicate from '@lobehub/icons/es/Replicate';

// 静态导入的图标映射，用于同步查找
const StaticIcons = {
  OpenAI, Claude, Gemini, Moonshot, Zhipu, Qwen, DeepSeek, Minimax,
  Wenxin, Spark, Midjourney, Hunyuan, Cohere, Cloudflare, Ai360, Yi,
  Jina, Mistral, XAI, Ollama, Doubao, Suno, Xinference, OpenRouter,
  Dify, Coze, SiliconCloud, FastGPT, Kling, Jimeng, Perplexity, Replicate,
};

// 动态导入图标的缓存
const dynamicIconCache = {};

// 可用的图标模块名称（用于验证动态导入路径）
const ICON_MODULES = new Set([
  'Adobe','AdobeFirefly','Agui','Ai2','Ai21','Ai302','Ai360','AiHubMix','AiMass','AionLabs',
  'AiStudio','AkashChat','AlephAlpha','Alibaba','AlibabaCloud','AntGroup','Anthropic','Anyscale',
  'Apple','Arcee','AssemblyAI','Automatic','Aws','Aya','Azure','AzureAI','BAAI','Baichuan',
  'Baidu','BaiduCloud','Bailian','Baseten','Bedrock','Bfl','Bilibili','BilibiliIndex','Bing',
  'BurnCloud','ByteDance','CapCut','CentML','Cerebras','ChatGLM','Civitai','Claude','Cline',
  'Clipdrop','Cloudflare','CodeFlicker','CodeGeeX','CogVideo','CogView','Cohere','Colab',
  'CometAPI','ComfyUI','CommandA','Copilot','CopilotKit','Coqui','Coze','CrewAI','Crusoe',
  'Cursor','CyberCut','Dalle','Dbrx','DeepAI','DeepCogito','DeepInfra','DeepL','DeepMind',
  'DeepSeek','Dify','Doc2X','DocSearch','Dolphin','Doubao','DreamMachine','ElevenLabs','ElevenX',
  'EssentialAI','Exa','Fal','FastGPT','Featherless','Figma','Fireworks','FishAudio','Flora',
  'Flowith','Flux','Friendli','Gemini','Gemma','GiteeAI','Github','GithubCopilot','Glama',
  'Glif','GLMV','Google','GoogleCloud','Goose','Gradio','Greptile','Grok','Groq','Hailuo',
  'Haiper','Hedra','Higress','Huawei','HuaweiCloud','HuggingFace','Hunyuan','Hyperbolic','IBM',
  'Ideogram','IFlyTekCloud','Inception','Inference','Infermatic','Infinigence','Inflection',
  'InternLM','Jimeng','Jina','Kimi','Kling','Kluster','Kolors','Krea','KwaiKAT','Kwaipilot',
  'Lambda','LangChain','Langfuse','LangGraph','LangSmith','LeptonAI','LG','Lightricks','Liquid',
  'LiveKit','LlamaIndex','LLaVA','LmStudio','LobeHub','LongCat','Lovable','Luma','Magic','Make',
  'Manus','Mastra','MCP','McpSo','Menlo','Meta','MetaAI','MetaGPT','Microsoft','Midjourney',
  'Minimax','Mistral','ModelScope','Monica','Moonshot','Morph','MyShell','N8n','Nebius','NewAPI',
  'NotebookLM','Notion','NousResearch','Nova','NovelAI','Novita','NPLCloud','Nvidia','Ollama',
  'OpenAI','OpenChat','OpenRouter','OpenWebUI','PaLM','Parasail','Perplexity','Phidata','Phind',
  'Pika','PixVerse','Player2','Poe','Pollinations','PPIO','PydanticAI','Qingyan','Qiniu','Qwen',
  'Railway','Recraft','Relace','Replicate','Replit','RSSHub','Runway','Rwkv','SambaNova',
  'Search1API','SearchApi','SenseNova','SiliconCloud','Skywork','Smithery','Snowflake','SophNet',
  'Sora','Spark','Stability','StateCloud','Stepfun','Straico','StreamLake','SubModel','Suno',
  'Sync','Targon','Tavily','Tencent','TencentCloud','Tiangong','TII','Together','TopazLabs',
  'Trae','Tripo','TuriX','Udio','Unstructured','Upstage','V0','VectorizerAI','Vercel','VertexAI',
  'Vidu','Viggle','Vllm','Volcengine','Voyage','Wenxin','Windsurf','WorkersAI','XAI','Xinference',
  'Xuanyuan','Yandex','Yi','YouMind','Yuanbao','ZAI','Zapier','Zeabur','ZenMux','ZeroOne','Zhipu',
]);

// 获取模型分类
export const getModelCategories = (() => {
  let categoriesCache = null;
  let lastLocale = null;

  return (t) => {
    const currentLocale = i18next.language;
    if (categoriesCache && lastLocale === currentLocale) {
      return categoriesCache;
    }

    categoriesCache = {
      all: {
        label: t('全部模型'),
        icon: null,
        filter: () => true,
      },
      openai: {
        label: 'OpenAI',
        icon: <OpenAI />,
        filter: (model) =>
          model.model_name.toLowerCase().includes('gpt') ||
          model.model_name.toLowerCase().includes('dall-e') ||
          model.model_name.toLowerCase().includes('whisper') ||
          model.model_name.toLowerCase().includes('tts-1') ||
          model.model_name.toLowerCase().includes('text-embedding-3') ||
          model.model_name.toLowerCase().includes('text-moderation') ||
          model.model_name.toLowerCase().includes('babbage') ||
          model.model_name.toLowerCase().includes('davinci') ||
          model.model_name.toLowerCase().includes('curie') ||
          model.model_name.toLowerCase().includes('ada') ||
          model.model_name.toLowerCase().includes('o1') ||
          model.model_name.toLowerCase().includes('o3') ||
          model.model_name.toLowerCase().includes('o4'),
      },
      anthropic: {
        label: 'Anthropic',
        icon: <Claude.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('claude'),
      },
      gemini: {
        label: 'Gemini',
        icon: <Gemini.Color />,
        filter: (model) =>
          model.model_name.toLowerCase().includes('gemini') ||
          model.model_name.toLowerCase().includes('gemma') ||
          model.model_name.toLowerCase().includes('learnlm') ||
          model.model_name.toLowerCase().startsWith('embedding-') ||
          model.model_name.toLowerCase().includes('text-embedding-004') ||
          model.model_name.toLowerCase().includes('imagen-4') ||
          model.model_name.toLowerCase().includes('veo-') ||
          model.model_name.toLowerCase().includes('aqa'),
      },
      moonshot: {
        label: 'Moonshot',
        icon: <Moonshot />,
        filter: (model) =>
          model.model_name.toLowerCase().includes('moonshot') ||
          model.model_name.toLowerCase().includes('kimi'),
      },
      zhipu: {
        label: t('智谱'),
        icon: <Zhipu.Color />,
        filter: (model) =>
          model.model_name.toLowerCase().includes('chatglm') ||
          model.model_name.toLowerCase().includes('glm-') ||
          model.model_name.toLowerCase().includes('cogview') ||
          model.model_name.toLowerCase().includes('cogvideo'),
      },
      qwen: {
        label: t('通义千问'),
        icon: <Qwen.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('qwen'),
      },
      deepseek: {
        label: 'DeepSeek',
        icon: <DeepSeek.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('deepseek'),
      },
      minimax: {
        label: 'MiniMax',
        icon: <Minimax.Color />,
        filter: (model) =>
          model.model_name.toLowerCase().includes('abab') ||
          model.model_name.toLowerCase().includes('minimax'),
      },
      baidu: {
        label: t('文心一言'),
        icon: <Wenxin.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('ernie'),
      },
      xunfei: {
        label: t('讯飞星火'),
        icon: <Spark.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('spark'),
      },
      midjourney: {
        label: 'Midjourney',
        icon: <Midjourney />,
        filter: (model) => model.model_name.toLowerCase().includes('mj_'),
      },
      tencent: {
        label: t('腾讯混元'),
        icon: <Hunyuan.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('hunyuan'),
      },
      cohere: {
        label: 'Cohere',
        icon: <Cohere.Color />,
        filter: (model) =>
          model.model_name.toLowerCase().includes('command') ||
          model.model_name.toLowerCase().includes('c4ai-') ||
          model.model_name.toLowerCase().includes('embed-'),
      },
      cloudflare: {
        label: 'Cloudflare',
        icon: <Cloudflare.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('@cf/'),
      },
      ai360: {
        label: t('360智脑'),
        icon: <Ai360.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('360'),
      },
      jina: {
        label: 'Jina',
        icon: <Jina />,
        filter: (model) => model.model_name.toLowerCase().includes('jina'),
      },
      mistral: {
        label: 'Mistral AI',
        icon: <Mistral.Color />,
        filter: (model) =>
          model.model_name.toLowerCase().includes('mistral') ||
          model.model_name.toLowerCase().includes('codestral') ||
          model.model_name.toLowerCase().includes('pixtral') ||
          model.model_name.toLowerCase().includes('voxtral') ||
          model.model_name.toLowerCase().includes('magistral'),
      },
      xai: {
        label: 'xAI',
        icon: <XAI />,
        filter: (model) => model.model_name.toLowerCase().includes('grok'),
      },
      llama: {
        label: 'Llama',
        icon: <Ollama />,
        filter: (model) => model.model_name.toLowerCase().includes('llama'),
      },
      doubao: {
        label: t('豆包'),
        icon: <Doubao.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('doubao'),
      },
      yi: {
        label: t('零一万物'),
        icon: <Yi.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('yi'),
      },
    };

    lastLocale = currentLocale;
    return categoriesCache;
  };
})();

/**
 * 根据渠道类型返回对应的厂商图标
 * @param {number} channelType - 渠道类型值
 * @returns {JSX.Element|null} - 对应的厂商图标组件
 */
export function getChannelIcon(channelType) {
  const iconSize = 14;

  switch (channelType) {
    case 1: // OpenAI
    case 3: // Azure OpenAI
    case 57: // Codex
      return <OpenAI size={iconSize} />;
    case 2: // Midjourney Proxy
    case 5: // Midjourney Proxy Plus
      return <Midjourney size={iconSize} />;
    case 36: // Suno API
      return <Suno size={iconSize} />;
    case 4: // Ollama
      return <Ollama size={iconSize} />;
    case 14: // Anthropic Claude
    case 33: // AWS Claude
      return <Claude.Color size={iconSize} />;
    case 41: // Vertex AI
      return <Gemini.Color size={iconSize} />;
    case 34: // Cohere
      return <Cohere.Color size={iconSize} />;
    case 39: // Cloudflare
      return <Cloudflare.Color size={iconSize} />;
    case 43: // DeepSeek
      return <DeepSeek.Color size={iconSize} />;
    case 15: // 百度文心千帆
    case 46: // 百度文心千帆V2
      return <Wenxin.Color size={iconSize} />;
    case 17: // 阿里通义千问
      return <Qwen.Color size={iconSize} />;
    case 18: // 讯飞星火认知
      return <Spark.Color size={iconSize} />;
    case 16: // 智谱 ChatGLM
    case 26: // 智谱 GLM-4V
      return <Zhipu.Color size={iconSize} />;
    case 24: // Google Gemini
    case 11: // Google PaLM2
      return <Gemini.Color size={iconSize} />;
    case 47: // Xinference
      return <Xinference.Color size={iconSize} />;
    case 25: // Moonshot
      return <Moonshot size={iconSize} />;
    case 27: // Perplexity
      return <Perplexity.Color size={iconSize} />;
    case 20: // OpenRouter
      return <OpenRouter size={iconSize} />;
    case 19: // 360 智脑
      return <Ai360.Color size={iconSize} />;
    case 23: // 腾讯混元
      return <Hunyuan.Color size={iconSize} />;
    case 31: // 零一万物
      return <Yi.Color size={iconSize} />;
    case 35: // MiniMax
      return <Minimax.Color size={iconSize} />;
    case 37: // Dify
      return <Dify.Color size={iconSize} />;
    case 38: // Jina
      return <Jina size={iconSize} />;
    case 40: // SiliconCloud
      return <SiliconCloud.Color size={iconSize} />;
    case 42: // Mistral AI
      return <Mistral.Color size={iconSize} />;
    case 45: // 字节火山方舟、豆包通用
      return <Doubao.Color size={iconSize} />;
    case 48: // xAI
      return <XAI size={iconSize} />;
    case 49: // Coze
      return <Coze size={iconSize} />;
    case 50: // 可灵 Kling
      return <Kling.Color size={iconSize} />;
    case 51: // 即梦 Jimeng
      return <Jimeng.Color size={iconSize} />;
    case 54: // 豆包视频 Doubao Video
      return <Doubao.Color size={iconSize} />;
    case 56: // Replicate
      return <Replicate size={iconSize} />;
    case 8: // 自定义渠道
    case 22: // 知识库：FastGPT
      return <FastGPT.Color size={iconSize} />;
    case 21: // 知识库：AI Proxy
    case 44: // 嵌入模型：MokaAI M3E
    default:
      return null; // 未知类型或自定义渠道不显示图标
  }
}

/**
 * 根据图标名称动态获取 LobeHub 图标组件
 * 支持：
 * - 基础："OpenAI"、"OpenAI.Color" 等
 * - 额外属性（点号链式）："OpenAI.Avatar.type={'platform'}"、"OpenRouter.Avatar.shape={'square'}"
 * - 继续兼容第二参数 size；若字符串里有 size=，以字符串为准
 * @param {string} iconName - 图标名称/描述
 * @param {number} size - 图标大小，默认为 14
 * @returns {JSX.Element} - 对应的图标组件或 Avatar
 */
export function getLobeHubIcon(iconName, size = 14) {
  if (typeof iconName === 'string') iconName = iconName.trim();
  // 如果没有图标名称，返回 Avatar
  if (!iconName) {
    return <Avatar size='extra-extra-small'>?</Avatar>;
  }

  // 解析组件路径与点号链式属性
  const segments = String(iconName).split('.');
  const baseKey = segments[0];
  const BaseIcon = StaticIcons[baseKey];

  let IconComponent = undefined;
  let propStartIndex = 1;

  if (BaseIcon && segments.length > 1 && BaseIcon[segments[1]]) {
    IconComponent = BaseIcon[segments[1]];
    propStartIndex = 2;
  } else if (BaseIcon) {
    IconComponent = BaseIcon;
    propStartIndex = 1;
  }

  // 静态图标未命中，尝试动态加载
  if (!IconComponent && ICON_MODULES.has(baseKey)) {
    // 已缓存
    if (dynamicIconCache[baseKey]) {
      const cached = dynamicIconCache[baseKey];
      if (segments.length > 1 && cached[segments[1]]) {
        IconComponent = cached[segments[1]];
        propStartIndex = 2;
      } else {
        IconComponent = cached;
        propStartIndex = 1;
      }
    } else {
      // 返回异步加载的包装组件
      return <DynamicLobeIcon iconName={iconName} size={size} />;
    }
  }

  // 失败兜底
  if (
    !IconComponent ||
    (typeof IconComponent !== 'function' && typeof IconComponent !== 'object')
  ) {
    const firstLetter = String(iconName).charAt(0).toUpperCase();
    return <Avatar size='extra-extra-small'>{firstLetter}</Avatar>;
  }

  // 解析点号链式属性，形如：key={...}、key='...'、key="..."、key=123、key、key=true/false
  const props = {};

  const parseValue = (raw) => {
    if (raw == null) return true;
    let v = String(raw).trim();
    // 去除一层花括号包裹
    if (v.startsWith('{') && v.endsWith('}')) {
      v = v.slice(1, -1).trim();
    }
    // 去除引号
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      return v.slice(1, -1);
    }
    // 布尔
    if (v === 'true') return true;
    if (v === 'false') return false;
    // 数字
    if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v);
    // 其他原样返回字符串
    return v;
  };

  for (let i = propStartIndex; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) continue;
    const eqIdx = seg.indexOf('=');
    if (eqIdx === -1) {
      props[seg.trim()] = true;
      continue;
    }
    const key = seg.slice(0, eqIdx).trim();
    const valRaw = seg.slice(eqIdx + 1).trim();
    props[key] = parseValue(valRaw);
  }

  // 兼容第二参数 size，若字符串中未显式指定 size，则使用函数入参
  if (props.size == null && size != null) props.size = size;

  return <IconComponent {...props} />;
}

// 动态加载图标的 React 包装组件
function DynamicLobeIcon({ iconName, size = 14 }) {
  const [IconComponent, setIconComponent] = useState(null);

  useEffect(() => {
    const segments = String(iconName).split('.');
    const baseKey = segments[0];

    if (dynamicIconCache[baseKey]) {
      setIconComponent(() => resolveIcon(dynamicIconCache[baseKey], segments));
      return;
    }

    let cancelled = false;
    import(`@lobehub/icons/es/${baseKey}`)
      .then((mod) => {
        const exported = mod[baseKey] || mod.default || mod;
        dynamicIconCache[baseKey] = exported;
        if (!cancelled) {
          setIconComponent(() => resolveIcon(exported, segments));
        }
      })
      .catch(() => {
        if (!cancelled) setIconComponent(null);
      });

    return () => { cancelled = true; };
  }, [iconName]);

  if (!IconComponent) {
    const firstLetter = String(iconName).charAt(0).toUpperCase();
    return <Avatar size='extra-extra-small'>{firstLetter}</Avatar>;
  }

  // 解析属性
  const segments = String(iconName).split('.');
  const baseKey = segments[0];
  const BaseIcon = dynamicIconCache[baseKey];
  let propStartIndex = 1;
  if (BaseIcon && segments.length > 1 && BaseIcon[segments[1]]) {
    propStartIndex = 2;
  }

  const props = {};
  for (let i = propStartIndex; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) continue;
    const eqIdx = seg.indexOf('=');
    if (eqIdx === -1) {
      props[seg.trim()] = true;
      continue;
    }
    const key = seg.slice(0, eqIdx).trim();
    const valRaw = seg.slice(eqIdx + 1).trim();
    let v = String(valRaw).trim();
    if (v.startsWith('{') && v.endsWith('}')) v = v.slice(1, -1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      props[key] = v.slice(1, -1);
    } else if (v === 'true') {
      props[key] = true;
    } else if (v === 'false') {
      props[key] = false;
    } else if (/^-?\d+(?:\.\d+)?$/.test(v)) {
      props[key] = Number(v);
    } else {
      props[key] = v;
    }
  }
  if (props.size == null && size != null) props.size = size;

  return <IconComponent {...props} />;
}

// 根据 segments 解析出最终的图标组件
function resolveIcon(baseIcon, segments) {
  if (segments.length > 1 && baseIcon[segments[1]]) {
    return baseIcon[segments[1]];
  }
  return baseIcon;
}
