"use client";

import { Check, Code2, Copy, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { ClaudeCodeInstallTabs } from "@/components/claude-code-install-tabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTER_ORIGIN } from "@/lib/origins";
import type { Locale } from "@/lib/locales";

type Props = {
  locale: Locale;
};

type TutorialCopy = {
  eyebrow: string;
  title: string;
  body: string;
  agentTab: string;
  sdkTab: string;
  agentTitle: string;
  agentBody: string;
  sdkTitle: string;
  sdkBody: string;
  copy: string;
  copied: string;
};

const tutorialCopy: Record<Locale, TutorialCopy> = {
  en: {
    eyebrow: "Tutorial",
    title: "Quick Start — one command, 30 seconds to set up everything",
    body: "Pick the path you need: route Codex / Claude Code through Flatkey, or copy an OpenAI SDK example for your own product.",
    agentTab: "Codex / Claude Code",
    sdkTab: "OpenAI SDK",
    agentTitle: "Directly use Flatkey with Codex / Claude Code",
    agentBody: "Run one installer, select Codex CLI or Claude Code, paste your Flatkey API key, then restart the terminal.",
    sdkTitle: "Use Flatkey in your own code",
    sdkBody: "Keep the OpenAI SDK. Change base_url and API key, then call Flatkey from curl, Python, or Node.js.",
    copy: "Copy",
    copied: "Copied",
  },
  zh: {
    eyebrow: "快速教程",
    title: "Quick Start — 一行命令，30 秒完成配置",
    body: "选择你的接入方式：把 Codex / Claude Code 跑到 Flatkey，或复制 OpenAI SDK 示例接入自己的产品。",
    agentTab: "Codex / Claude Code",
    sdkTab: "OpenAI SDK",
    agentTitle: "直接用 Flatkey 接入 Codex / Claude Code",
    agentBody: "运行一键安装脚本，选择 Codex CLI 或 Claude Code，粘贴 Flatkey API key，然后重启终端。",
    sdkTitle: "在自己的代码里接入 Flatkey",
    sdkBody: "沿用 OpenAI SDK，只改 base_url 和 API key，即可用 curl、Python 或 Node.js 调用 Flatkey。",
    copy: "复制",
    copied: "已复制",
  },
  es: {
    eyebrow: "Tutorial",
    title: "Quick Start — un comando, 30 segundos para configurar todo",
    body: "Elige ruta: Codex / Claude Code por Flatkey, o ejemplo OpenAI SDK para tu producto.",
    agentTab: "Codex / Claude Code",
    sdkTab: "OpenAI SDK",
    agentTitle: "Usa Flatkey con Codex / Claude Code",
    agentBody: "Ejecuta el instalador, elige Codex CLI o Claude Code, pega tu API key Flatkey y reinicia la terminal.",
    sdkTitle: "Usa Flatkey en tu código",
    sdkBody: "Conserva el OpenAI SDK. Cambia base_url y API key, luego llama a Flatkey con curl, Python o Node.js.",
    copy: "Copiar",
    copied: "Copiado",
  },
  fr: {
    eyebrow: "Tutoriel",
    title: "Quick Start — une commande, 30 secondes pour tout configurer",
    body: "Choisissez votre chemin : Codex / Claude Code via Flatkey, ou un exemple OpenAI SDK pour votre produit.",
    agentTab: "Codex / Claude Code",
    sdkTab: "OpenAI SDK",
    agentTitle: "Utiliser Flatkey avec Codex / Claude Code",
    agentBody: "Lancez l'installateur, choisissez Codex CLI ou Claude Code, collez votre clé API Flatkey puis redémarrez le terminal.",
    sdkTitle: "Utiliser Flatkey dans votre code",
    sdkBody: "Gardez le SDK OpenAI. Changez base_url et la clé API, puis appelez Flatkey en curl, Python ou Node.js.",
    copy: "Copier",
    copied: "Copié",
  },
  pt: {
    eyebrow: "Tutorial",
    title: "Quick Start — um comando, 30 segundos para configurar tudo",
    body: "Escolha o caminho: Codex / Claude Code via Flatkey, ou exemplo OpenAI SDK para seu produto.",
    agentTab: "Codex / Claude Code",
    sdkTab: "OpenAI SDK",
    agentTitle: "Use Flatkey com Codex / Claude Code",
    agentBody: "Rode o instalador, escolha Codex CLI ou Claude Code, cole sua API key Flatkey e reinicie o terminal.",
    sdkTitle: "Use Flatkey no seu código",
    sdkBody: "Mantenha o SDK OpenAI. Troque base_url e API key, depois chame Flatkey com curl, Python ou Node.js.",
    copy: "Copiar",
    copied: "Copiado",
  },
  ru: {
    eyebrow: "Tutorial",
    title: "Quick Start — одна команда, 30 секунд на настройку",
    body: "Выберите путь: Codex / Claude Code через Flatkey или пример OpenAI SDK для вашего продукта.",
    agentTab: "Codex / Claude Code",
    sdkTab: "OpenAI SDK",
    agentTitle: "Используйте Flatkey с Codex / Claude Code",
    agentBody: "Запустите installer, выберите Codex CLI или Claude Code, вставьте Flatkey API key и перезапустите terminal.",
    sdkTitle: "Используйте Flatkey в своём коде",
    sdkBody: "Оставьте OpenAI SDK. Измените base_url и API key, затем вызывайте Flatkey через curl, Python или Node.js.",
    copy: "Копировать",
    copied: "Скопировано",
  },
  ja: {
    eyebrow: "使い方",
    title: "30秒でセットアップ完了",
    body: "用途に合わせて選択できます。Codex / Claude CodeをFlatkey経由で使うか、OpenAI SDKの例をコピーして自分のプロダクトに組み込みます。",
    agentTab: "Codex / Claude Code",
    sdkTab: "OpenAI SDK",
    agentTitle: "FlatkeyでCodex / Claude Codeを直接使う",
    agentBody: "一鍵インストールスクリプトを実行し、Codex CLIまたはClaude Codeを選択。Flatkey APIキーを貼り付け、ターミナルを再起動します。",
    sdkTitle: "自分のコードにFlatkeyを接続",
    sdkBody: "OpenAI SDKはそのまま利用できます。base_urlとAPIキーを変更し、curl、Python、Node.jsからFlatkeyを呼び出します。",
    copy: "コピー",
    copied: "コピー済み",
  },
  vi: {
    eyebrow: "Tutorial",
    title: "Quick Start — một lệnh, 30 giây để cài xong",
    body: "Chọn cách dùng: Codex / Claude Code qua Flatkey, hoặc ví dụ OpenAI SDK cho sản phẩm của bạn.",
    agentTab: "Codex / Claude Code",
    sdkTab: "OpenAI SDK",
    agentTitle: "Dùng Flatkey với Codex / Claude Code",
    agentBody: "Chạy installer, chọn Codex CLI hoặc Claude Code, dán API key Flatkey rồi khởi động lại terminal.",
    sdkTitle: "Dùng Flatkey trong code của bạn",
    sdkBody: "Giữ OpenAI SDK. Đổi base_url và API key, rồi gọi Flatkey bằng curl, Python hoặc Node.js.",
    copy: "Sao chép",
    copied: "Đã sao chép",
  },
  de: {
    eyebrow: "Tutorial",
    title: "Quick Start — ein Befehl, 30 Sekunden bis alles eingerichtet ist",
    body: "Wähle deinen Weg: Codex / Claude Code über Flatkey oder OpenAI-SDK-Beispiele für dein Produkt.",
    agentTab: "Codex / Claude Code",
    sdkTab: "OpenAI SDK",
    agentTitle: "Flatkey mit Codex / Claude Code nutzen",
    agentBody: "Starte den Installer, wähle Codex CLI oder Claude Code, füge deinen Flatkey API key ein und starte das Terminal neu.",
    sdkTitle: "Flatkey in deinem Code nutzen",
    sdkBody: "Behalte das OpenAI SDK. Ändere base_url und API key, dann rufe Flatkey mit curl, Python oder Node.js auf.",
    copy: "Kopieren",
    copied: "Kopiert",
  },
};

const sdkTabs = [
  { id: "curl", label: "curl" },
  { id: "python", label: "Python" },
  { id: "nodejs", label: "Node.js" },
] as const;

type SdkTab = (typeof sdkTabs)[number]["id"];

function sdkExample(tab: SdkTab) {
  if (tab === "python") {
    return `from openai import OpenAI\n\nclient = OpenAI(\n    api_key=\"sk-...\",\n    base_url=\"${ROUTER_ORIGIN}/v1\",\n)\n\nresponse = client.chat.completions.create(\n    model=\"gpt-5.5\",\n    messages=[{\"role\": \"user\", \"content\": \"Hello from Flatkey\"}],\n)\n\nprint(response.choices[0].message.content)`;
  }

  if (tab === "nodejs") {
    return `import OpenAI from \"openai\";\n\nconst client = new OpenAI({\n  apiKey: \"sk-...\",\n  baseURL: \"${ROUTER_ORIGIN}/v1\",\n});\n\nconst response = await client.chat.completions.create({\n  model: \"gpt-5.5\",\n  messages: [{ role: \"user\", content: \"Hello from Flatkey\" }],\n});\n\nconsole.log(response.choices[0]?.message?.content);`;
  }

  return `curl ${ROUTER_ORIGIN}/v1/chat/completions \\\n  -H \"Authorization: Bearer sk-...\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n    \"model\": \"gpt-5.5\",\n    \"messages\": [{\"role\": \"user\", \"content\": \"Hello from Flatkey\"}]\n  }'`;
}

export function PersonalAiQuickStartTabs({ locale }: Props) {
  const copy = tutorialCopy[locale] ?? tutorialCopy.en;
  const [activeMode, setActiveMode] = useState<"agent" | "sdk">("agent");
  const [activeSdk, setActiveSdk] = useState<SdkTab>("curl");
  const [copied, setCopied] = useState(false);
  const code = sdkExample(activeSdk);

  useEffect(() => {
    const syncModeFromHash = () => {
      if (window.location.hash !== "#sdk-quickstart" && window.location.hash !== "#agent-quickstart") return;
      setActiveMode(window.location.hash === "#sdk-quickstart" ? "sdk" : "agent");
      window.requestAnimationFrame(() => {
        document.getElementById("quickstart")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    syncModeFromHash();
    window.addEventListener("hashchange", syncModeFromHash);
    return () => window.removeEventListener("hashchange", syncModeFromHash);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
  };

  return (
    <section id="quickstart" className="mx-auto max-w-6xl scroll-mt-28 px-5 py-14 md:scroll-mt-32 md:px-6 md:py-18">
      <div className="max-w-3xl">
        <p className="text-xs font-bold tracking-[0.22em] text-violet-700 uppercase dark:text-violet-300">{copy.eyebrow}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{copy.title}</h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{copy.body}</p>
      </div>

      <Tabs value={activeMode} onValueChange={(value) => setActiveMode(value as "agent" | "sdk")} className="mt-8 min-w-0 overflow-hidden rounded-lg border border-border bg-card p-4 md:p-5">
        <TabsList className="mb-5 !grid !h-auto w-full min-w-0 grid-cols-1 gap-1 md:w-fit md:grid-cols-2" aria-label={copy.title}>
          <TabsTrigger value="agent" className="h-10 min-w-0 justify-center px-3 md:px-4">
            <Terminal className="size-4" />
            {copy.agentTab}
          </TabsTrigger>
          <TabsTrigger value="sdk" className="h-10 min-w-0 justify-center px-3 md:px-4">
            <Code2 className="size-4" />
            {copy.sdkTab}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agent" keepMounted>
          <div className="mb-4">
            <h3 className="text-xl font-bold tracking-tight">{copy.agentTitle}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.agentBody}</p>
          </div>
          <ClaudeCodeInstallTabs locale={locale} />
        </TabsContent>

        <TabsContent value="sdk" keepMounted>
          <div className="mb-4">
            <h3 className="text-xl font-bold tracking-tight">{copy.sdkTitle}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.sdkBody}</p>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-2">
              <Tabs value={activeSdk} onValueChange={(value) => setActiveSdk(value as SdkTab)}>
                <TabsList className="h-9" aria-label={copy.sdkTab}>
                  {sdkTabs.map((tab) => (
                    <TabsTrigger key={tab.id} value={tab.id} className="h-8 px-3">
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <button type="button" onClick={copyCode} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold transition hover:bg-muted">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? copy.copied : copy.copy}
              </button>
            </div>
            <pre className="overflow-x-auto bg-slate-950 p-4 text-xs leading-6 text-slate-100 md:text-sm">
              <code>{code}</code>
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
