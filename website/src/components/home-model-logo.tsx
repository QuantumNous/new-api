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

const DEFAULT_LOGO: LogoSpec = {
  background: "#F8F7FF",
  border: "rgba(109, 40, 217, 0.18)",
  fallbackColor: "#4C1D95",
  label: "Model",
};

const LOGO_SPECS: Array<{ match: RegExp; spec: LogoSpec }> = [
  {
    match: /openai|gpt|(^|\s)o[1-9]|dall-e|sora|codex/,
    spec: { src: "/assets/logos/openai.svg", label: "OpenAI", background: "#F6F6F6", border: "rgba(17, 17, 17, 0.14)", fallbackColor: "#111111" },
  },
  {
    match: /anthropic|claude/,
    spec: { src: "/assets/logos/claude.svg", label: "Claude", background: "#FFF3EE", border: "rgba(217, 119, 87, 0.22)", fallbackColor: "#D97757" },
  },
  {
    match: /google|gemini|imagen|veo/,
    spec: { src: "/assets/logos/googlegemini.svg", label: "Gemini", background: "#F4F0FF", border: "rgba(66, 133, 244, 0.2)", fallbackColor: "#4285F4" },
  },
  {
    match: /deepseek|deep-seek/,
    spec: { src: "/assets/logos/deepseek.svg", label: "DeepSeek", background: "#EEF3FF", border: "rgba(77, 107, 254, 0.22)", fallbackColor: "#4D6BFE" },
  },
  {
    match: /kimi|moonshot/,
    spec: { src: "/assets/logos/moonshotai.svg", label: "Kimi", background: "#F2F5F8", border: "rgba(22, 25, 30, 0.16)", fallbackColor: "#16191E" },
  },
  {
    match: /qwen|alibaba|aliyun|通义/,
    spec: { src: "/assets/logos/qwen.svg", label: "Qwen", background: "#F2F1FF", border: "rgba(97, 92, 237, 0.2)", fallbackColor: "#615CED" },
  },
  {
    match: /minimax/,
    spec: { src: "/assets/logos/minimax.svg", label: "MiniMax", background: "#FFF0F3", border: "rgba(242, 63, 93, 0.2)", fallbackColor: "#F23F5D" },
  },
  {
    match: /bytedance|doubao|seedance/,
    spec: { src: "/assets/logos/bytedance.svg", label: "ByteDance", background: "#EEF6FF", border: "rgba(60, 140, 255, 0.2)", fallbackColor: "#3C8CFF" },
  },
  {
    match: /meta|llama/,
    spec: { src: "/assets/logos/meta.svg", label: "Meta", background: "#EFF6FF", border: "rgba(4, 103, 223, 0.2)", fallbackColor: "#0467DF" },
  },
  {
    match: /mistral/,
    spec: { src: "/assets/logos/mistralai.svg", label: "Mistral", background: "#FFF7ED", border: "rgba(250, 82, 15, 0.2)", fallbackColor: "#FA520F" },
  },
  {
    match: /perplexity/,
    spec: { src: "/assets/logos/perplexity.svg", label: "Perplexity", background: "#EFFBFC", border: "rgba(32, 128, 141, 0.2)", fallbackColor: "#20808D" },
  },
  {
    match: /ollama/,
    spec: { src: "/assets/logos/ollama.svg", label: "Ollama", background: "#F4F4FA", border: "rgba(23, 22, 58, 0.18)", fallbackColor: "#17163A" },
  },
  {
    match: /nvidia/,
    spec: { src: "/assets/logos/nvidia.svg", label: "NVIDIA", background: "#F1FAE8", border: "rgba(118, 185, 0, 0.22)", fallbackColor: "#76B900" },
  },
  {
    match: /baidu|ernie|文心/,
    spec: { src: "/logos/baidu.svg", label: "Baidu", background: "#EEF3FF", border: "rgba(41, 50, 225, 0.2)", fallbackColor: "#2932E1" },
  },
  {
    match: /huggingface|hugging-face/,
    spec: { src: "/assets/logos/huggingface.svg", label: "Hugging Face", background: "#FFF8E7", border: "rgba(255, 210, 30, 0.28)", fallbackColor: "#8A5A00" },
  },
];

export function resolveHomeModelLogo(input: { iconKey?: string; modelName: string; vendor?: string }): LogoSpec {
  const identity = `${input.modelName} ${input.vendor ?? ""}`
    .toLowerCase()
    .replace(/[_./:]+/g, " ");
  const fromIdentity = LOGO_SPECS.find((entry) => entry.match.test(identity))?.spec;
  if (fromIdentity) return fromIdentity;

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
