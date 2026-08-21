import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoSpec = {
  background: string;
  border: string;
  fallbackColor: string;
  label: string;
  src?: string;
};

type HomeModelLogoProps = {
  className?: string;
  fallback?: string;
  iconKey?: string;
  imageSize?: number;
  modelName: string;
  surfaceSize?: number;
  vendor?: string;
};

// Logo tiles are white so every mark sits on the same neutral surface and the
// row reads as one column. The only exception is a mark that is itself white or
// near-white, which needs a dark tile to stay visible — INK_TILE below.
const WHITE_TILE = "#FFFFFF";
const TILE_BORDER = "rgba(226, 232, 240, 0.95)";
const INK_TILE = "#101014";
const INK_TILE_BORDER = "rgba(255, 255, 255, 0.14)";

const DEFAULT_LOGO: LogoSpec = {
  background: WHITE_TILE,
  border: TILE_BORDER,
  fallbackColor: "#4C1D95",
  label: "Model",
};

function tile(src: string, label: string, fallbackColor: string): LogoSpec {
  return { src, label, background: WHITE_TILE, border: TILE_BORDER, fallbackColor };
}

/** For marks drawn in white, which would vanish on a white tile. */
function inkTile(src: string, label: string): LogoSpec {
  return { src, label, background: INK_TILE, border: INK_TILE_BORDER, fallbackColor: "#FFFFFF" };
}

const LOGO_SPECS: Array<{ match: RegExp; spec: LogoSpec }> = [
  { match: /openai|gpt|(^|\s)o[1-9]|dall-e|sora|codex/, spec: tile("/assets/logos/openai.svg", "OpenAI", "#111111") },
  { match: /anthropic|claude/, spec: tile("/assets/logos/claude.svg", "Claude", "#D97757") },
  { match: /google|gemini|imagen|veo|gemma|nano-banana/, spec: tile("/assets/logos/googlegemini.svg", "Gemini", "#4285F4") },
  { match: /deepseek|deep-seek/, spec: tile("/assets/logos/deepseek.svg", "DeepSeek", "#4D6BFE") },
  { match: /kimi|moonshot/, spec: tile("/assets/logos/moonshotai.svg", "Kimi", "#16191E") },
  { match: /qwen|alibaba|aliyun|通义/, spec: tile("/assets/logos/qwen.svg", "Qwen", "#615CED") },
  { match: /minimax/, spec: tile("/assets/logos/minimax.svg", "MiniMax", "#F23F5D") },
  { match: /bytedance|doubao|seedance|seedream/, spec: tile("/assets/logos/bytedance.svg", "ByteDance", "#3C8CFF") },
  { match: /zhipu|glm|chatglm|z\.ai|z-ai|智谱/, spec: tile("/assets/logos/zai.svg", "Z.ai", "#2D2D2D") },
  { match: /grok|xai|x\.ai/, spec: tile("/assets/logos/xai.svg", "xAI", "#0B0B0F") },
  { match: /macaron/, spec: tile("/assets/logos/macaron.svg", "Macaron", "#E879A6") },
  { match: /sonilo/, spec: tile("/assets/logos/sonilo.svg", "Sonilo", "#8B5CF6") },
  { match: /kuaishou|kling|快手/, spec: tile("/assets/logos/kuaishou.svg", "Kuaishou", "#FF4906") },
  { match: /elevenlabs|eleven-labs/, spec: tile("/assets/logos/elevenlabs.svg", "ElevenLabs", "#000000") },
  { match: /alibabacloud|aliyun-cloud/, spec: tile("/assets/logos/alibabacloud.svg", "Alibaba Cloud", "#FF6A00") },
  { match: /meta|llama/, spec: tile("/assets/logos/meta.svg", "Meta", "#0467DF") },
  { match: /mistral/, spec: tile("/assets/logos/mistralai.svg", "Mistral", "#FA520F") },
  { match: /perplexity/, spec: tile("/assets/logos/perplexity.svg", "Perplexity", "#20808D") },
  { match: /ollama/, spec: tile("/assets/logos/ollama.svg", "Ollama", "#17163A") },
  { match: /nvidia/, spec: tile("/assets/logos/nvidia.svg", "NVIDIA", "#76B900") },
  { match: /baidu|ernie|文心/, spec: tile("/logos/baidu.svg", "Baidu", "#2932E1") },
  { match: /huggingface|hugging-face/, spec: tile("/assets/logos/huggingface.svg", "Hugging Face", "#8A5A00") },
];

// Vendors with no local asset yet: a lettered tile, dark so the monogram reads
// like a mark rather than looking like a failed image.
const MONOGRAM_TILES: Array<{ match: RegExp; label: string }> = [];

export function resolveHomeModelLogo(input: { iconKey?: string; modelName: string; vendor?: string }): LogoSpec {
  const identity = `${input.modelName} ${input.vendor ?? ""}`
    .toLowerCase()
    .replace(/[_./:]+/g, " ");
  const fromIdentity = LOGO_SPECS.find((entry) => entry.match.test(identity))?.spec;
  if (fromIdentity) return fromIdentity;

  const monogram = MONOGRAM_TILES.find((entry) => entry.match.test(identity));
  if (monogram) return { ...DEFAULT_LOGO, background: INK_TILE, border: INK_TILE_BORDER, fallbackColor: "#FFFFFF", label: monogram.label };

  const iconKey = (input.iconKey ?? "").toLowerCase().replace(/[_./:]+/g, " ");
  return LOGO_SPECS.find((entry) => entry.match.test(iconKey))?.spec ?? DEFAULT_LOGO;
}

export function HomeModelLogo(props: HomeModelLogoProps) {
  const spec = resolveHomeModelLogo(props);
  const surfaceSize = props.surfaceSize ?? 32;
  const imageSize = props.imageSize ?? Math.round(surfaceSize * 0.64);
  const fallback = (props.fallback || props.modelName.charAt(0) || "?").slice(0, 2).toUpperCase();

  return (
    <span
      aria-label={spec.label}
      title={spec.label}
      className={cn("inline-grid shrink-0 place-items-center overflow-hidden border shadow-[0_10px_24px_-18px_rgba(16,16,20,0.45)]", props.className)}
      style={{
        width: surfaceSize,
        height: surfaceSize,
        borderColor: spec.border,
        borderRadius: Math.max(8, Math.round(surfaceSize * 0.26)),
        background: spec.background,
        ...(!spec.src ? { color: spec.fallbackColor } : {}),
      }}
    >
      {spec.src ? (
        <Image
          src={spec.src}
          alt=""
          width={imageSize}
          height={imageSize}
          className="block object-contain object-center"
          style={{ width: imageSize, height: imageSize }}
        />
      ) : (
        <span className="font-sans text-[11px] font-black leading-none">{fallback}</span>
      )}
    </span>
  );
}
