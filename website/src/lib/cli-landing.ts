import { LOCALES, type Locale, withIdFallback } from "@/lib/locales";

export const CLI_LANDING_PATH = "/cli";
export const CLI_IMAGE_PATH = "/cli/image";
export const CLI_VIDEO_PATH = "/cli/video";
export const HIGGSFIELD_ALTERNATIVE_PATH = "/higgsfield-alternative";

type CodeSample = {
  label: string;
  code: string;
};

type MediaSectionCopy = {
  eyebrow: string;
  title: string;
  body: string;
  items: Array<{
    kind: string;
    title: string;
    body: string;
    outcome: string;
  }>;
};

type CliLandingBaseCopy = {
  seo: {
    title: string;
    description: string;
  };
  navLabel: string;
  hero: {
    eyebrow: string;
    title: string;
    accent: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
  };
  stats: Array<{ value: string; label: string }>;
  codeSamples: CodeSample[];
  sections: {
    workflow: {
      eyebrow: string;
      title: string;
      body: string;
      cards: Array<{ title: string; body: string }>;
    };
    spend: {
      title: string;
      body: string;
      bullets: string[];
    };
    agent: {
      title: string;
      body: string;
      bullets: string[];
    };
    useCases: {
      title: string;
      items: Array<{ title: string; body: string }>;
    };
    faq: {
      title: string;
      items: Array<{ question: string; answer: string }>;
    };
    cta: {
      title: string;
      body: string;
      primaryCta: string;
      secondaryCta: string;
    };
  };
};

type CliLandingCopy = Omit<CliLandingBaseCopy, "sections"> & {
  sections: CliLandingBaseCopy["sections"] & {
    media: MediaSectionCopy;
  };
};

type CompareCopy = {
  seo: {
    title: string;
    description: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
  };
  position: {
    title: string;
    body: string;
  };
  comparison: {
    title: string;
    headers: [string, string, string];
    rows: Array<[string, string, string]>;
  };
  pains: {
    eyebrow: string;
    title: string;
    body: string;
    items: Array<{ title: string; body: string }>;
  };
  migration: {
    title: string;
    body: string;
    code: string;
  };
  cta: {
    title: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
  };
};

const installCode = `npm i -g @flatkey-ai/cli
flatkey login

Then ask your AI agent:
"Use Flatkey CLI to generate campaign images, short videos, audio, and copy for this brief."`;

const agentCode = `Ask Claude Code, Codex, Cursor, or another agent:

"Use Flatkey CLI to create:
- product images
- short video clips
- voiceover or audio
- hooks, captions, and ad copy

Save the files locally and summarize the run."`;

const compareCode = `npm i -g @flatkey-ai/cli
flatkey login

Then ask your AI agent:
"Use Flatkey CLI to turn this campaign brief into image, video, audio, and copy assets."`;

const mediaSectionCopy: Record<Locale, MediaSectionCopy> = {
  en: {
    eyebrow: "Real media jobs",
    title: "Use the CLI to produce files, not just prompts",
    body: "Install once, run flatkey login, then batch images and videos from briefs, folders, CSVs, or agents.",
    items: [
      { kind: "Video", title: "9:16 UGC ad clips", body: "Tell your AI agent the product, audience, angle, and aspect ratio; let it use Flatkey CLI to produce short paid-social clips.", outcome: "Output: video clips, hooks, first frames" },
      { kind: "Image", title: "Campaign hero images", body: "Give the agent a launch brief and brand direction; it can create cover images, landing visuals, product scenes, and variants.", outcome: "Output: hero images, product scenes" },
      { kind: "Video", title: "Product reveal sequences", body: "Ask the agent to start from a product shot, plan reveal directions, generate clips, and keep the usable files together.", outcome: "Output: reveal clips, edit-ready files" },
      { kind: "Image", title: "Thumbnail test sets", body: "Let an agent explore thumbnail directions, generate options, rank what works, and write titles or overlays.", outcome: "Output: thumbnail sets, ranking notes" },
      { kind: "Video", title: "Localized market variants", body: "Give the agent markets and constraints; it can create localized visuals, clips, voiceover direction, captions, and copy.", outcome: "Output: localized image, video, audio, copy" },
      { kind: "Image + Video", title: "Storyboard to motion", body: "Ask the agent to draft scenes, create still frames, choose the best direction, and turn the storyboard into motion assets.", outcome: "Output: storyboard frames, motion assets" },
    ],
  },
  zh: {
    eyebrow: "真实媒体任务",
    title: "用 CLI 产出文件，而不只是提示词",
    body: "只需安装一次并运行 flatkey login，就能从 brief、文件夹、CSV 或 agent 批量生成图片和视频。",
    items: [
      { kind: "视频", title: "9:16 UGC 广告短片", body: "告诉 AI agent 产品、受众、角度和画幅，让它用 Flatkey CLI 生成适合付费社交投放的短片。", outcome: "输出：视频短片、hook、首帧" },
      { kind: "图片", title: "活动主视觉", body: "提供发布 brief 和品牌方向，agent 就能生成封面图、落地页视觉、产品场景和多版方案。", outcome: "输出：主视觉、产品场景" },
      { kind: "视频", title: "产品亮相序列", body: "让 agent 从产品图出发，规划亮相方式、生成短片，并把可用文件整理在一起。", outcome: "输出：亮相短片、可剪辑文件" },
      { kind: "图片", title: "缩略图测试组", body: "让 agent 探索缩略图方向、生成备选、排序效果，并撰写标题或画面文字。", outcome: "输出：缩略图组、排序说明" },
      { kind: "视频", title: "市场本地化版本", body: "给出目标市场和限制条件，agent 可生成本地化视觉、短片、配音方向、字幕和文案。", outcome: "输出：本地化图片、视频、音频、文案" },
      { kind: "图片 + 视频", title: "从分镜到动态素材", body: "让 agent 起草场景、生成静帧、选择最佳方向，再把分镜转成动态素材。", outcome: "输出：分镜帧、动态素材" },
    ],
  },
  es: {
    eyebrow: "Trabajos multimedia reales",
    title: "Usa la CLI para producir archivos, no solo prompts",
    body: "Instala una vez, ejecuta flatkey login y crea imágenes y videos por lotes desde briefs, carpetas, CSV o agentes.",
    items: [
      { kind: "Video", title: "Clips publicitarios UGC 9:16", body: "Indica al agente el producto, la audiencia, el enfoque y la proporción para que produzca clips cortos para redes de pago.", outcome: "Salida: clips, hooks y primeros fotogramas" },
      { kind: "Imagen", title: "Imágenes principales de campaña", body: "Entrega un brief de lanzamiento y la dirección de marca para crear portadas, visuales de landing, escenas de producto y variantes.", outcome: "Salida: imágenes principales y escenas de producto" },
      { kind: "Video", title: "Secuencias de presentación de producto", body: "Pide al agente que parta de una foto de producto, planifique la presentación, genere clips y agrupe los archivos utilizables.", outcome: "Salida: clips de presentación y archivos editables" },
      { kind: "Imagen", title: "Conjuntos de prueba de miniaturas", body: "Deja que el agente explore direcciones, genere opciones, ordene las mejores y escriba títulos o textos superpuestos.", outcome: "Salida: conjuntos de miniaturas y notas de ranking" },
      { kind: "Video", title: "Variantes localizadas por mercado", body: "Define mercados y restricciones para crear visuales, clips, pautas de voz, captions y copy localizados.", outcome: "Salida: imagen, video, audio y copy localizados" },
      { kind: "Imagen + video", title: "Del storyboard al movimiento", body: "Pide al agente que plantee escenas, cree fotogramas, elija la mejor dirección y convierta el storyboard en piezas animadas.", outcome: "Salida: fotogramas de storyboard y piezas animadas" },
    ],
  },
  fr: {
    eyebrow: "Tâches média réelles",
    title: "Utilisez le CLI pour produire des fichiers, pas seulement des prompts",
    body: "Installez une fois, lancez flatkey login, puis générez images et vidéos en lot depuis des briefs, dossiers, CSV ou agents.",
    items: [
      { kind: "Vidéo", title: "Clips publicitaires UGC 9:16", body: "Indiquez à l'agent le produit, l'audience, l'angle et le format afin qu'il produise des clips courts pour les réseaux payants.", outcome: "Sortie : clips vidéo, hooks, premières images" },
      { kind: "Image", title: "Visuels principaux de campagne", body: "Donnez un brief de lancement et une direction de marque pour créer couvertures, visuels de landing, scènes produit et variantes.", outcome: "Sortie : visuels principaux, scènes produit" },
      { kind: "Vidéo", title: "Séquences de révélation produit", body: "Partez d'une photo produit, planifiez les révélations, générez les clips et regroupez les fichiers exploitables.", outcome: "Sortie : clips de révélation, fichiers prêts au montage" },
      { kind: "Image", title: "Séries de tests de miniatures", body: "Laissez l'agent explorer des pistes, générer des options, classer les meilleures et rédiger titres ou textes incrustés.", outcome: "Sortie : séries de miniatures, notes de classement" },
      { kind: "Vidéo", title: "Variantes localisées par marché", body: "Définissez marchés et contraintes pour produire visuels, clips, direction voix, légendes et textes localisés.", outcome: "Sortie : image, vidéo, audio et texte localisés" },
      { kind: "Image + vidéo", title: "Du storyboard à l'animation", body: "Demandez à l'agent d'ébaucher les scènes, créer des images fixes, choisir la meilleure piste et produire les assets animés.", outcome: "Sortie : images de storyboard, assets animés" },
    ],
  },
  pt: {
    eyebrow: "Trabalhos reais de mídia",
    title: "Use a CLI para produzir arquivos, não apenas prompts",
    body: "Instale uma vez, execute flatkey login e gere imagens e vídeos em lote a partir de briefings, pastas, CSVs ou agentes.",
    items: [
      { kind: "Vídeo", title: "Clipes de anúncio UGC 9:16", body: "Informe produto, público, abordagem e proporção para o agente produzir clipes curtos para mídia paga.", outcome: "Saída: clipes, hooks e primeiros frames" },
      { kind: "Imagem", title: "Imagens principais de campanha", body: "Passe o briefing de lançamento e a direção da marca para criar capas, visuais de landing page, cenas de produto e variações.", outcome: "Saída: imagens principais e cenas de produto" },
      { kind: "Vídeo", title: "Sequências de revelação de produto", body: "Peça ao agente para partir de uma foto do produto, planejar as revelações, gerar clipes e reunir os arquivos aproveitáveis.", outcome: "Saída: clipes de revelação e arquivos para edição" },
      { kind: "Imagem", title: "Conjuntos de teste de thumbnails", body: "Deixe o agente explorar direções, gerar opções, classificar as melhores e escrever títulos ou textos sobrepostos.", outcome: "Saída: conjuntos de thumbnails e notas de ranking" },
      { kind: "Vídeo", title: "Variações localizadas por mercado", body: "Defina mercados e restrições para criar visuais, clipes, direção de voz, legendas e textos localizados.", outcome: "Saída: imagem, vídeo, áudio e texto localizados" },
      { kind: "Imagem + vídeo", title: "Do storyboard ao movimento", body: "Peça ao agente para rascunhar cenas, criar frames, escolher a melhor direção e transformar o storyboard em assets animados.", outcome: "Saída: frames de storyboard e assets animados" },
    ],
  },
  ru: {
    eyebrow: "Реальные медиазадачи",
    title: "Используйте CLI для создания файлов, а не только промптов",
    body: "Установите один раз, выполните flatkey login и пакетно создавайте изображения и видео из брифов, папок, CSV или через агентов.",
    items: [
      { kind: "Видео", title: "UGC-реклама 9:16", body: "Задайте агенту продукт, аудиторию, ракурс и формат, чтобы он создал короткие ролики для платных соцсетей.", outcome: "Результат: видеоклипы, хуки, первые кадры" },
      { kind: "Изображение", title: "Ключевые изображения кампании", body: "Передайте бриф запуска и направление бренда, чтобы создать обложки, визуалы лендинга, продуктовые сцены и варианты.", outcome: "Результат: ключевые изображения, продуктовые сцены" },
      { kind: "Видео", title: "Сценарии презентации продукта", body: "Начните с фото продукта, спланируйте раскрытие, создайте клипы и соберите пригодные файлы вместе.", outcome: "Результат: презентационные клипы, файлы для монтажа" },
      { kind: "Изображение", title: "Наборы тестовых миниатюр", body: "Позвольте агенту исследовать варианты, сгенерировать их, ранжировать лучшие и написать заголовки или наложения.", outcome: "Результат: наборы миниатюр, заметки о рейтинге" },
      { kind: "Видео", title: "Локализованные варианты для рынков", body: "Укажите рынки и ограничения, чтобы создать локализованные визуалы, клипы, озвучку, субтитры и тексты.", outcome: "Результат: локализованные изображения, видео, аудио и текст" },
      { kind: "Изображение + видео", title: "От раскадровки к движению", body: "Поручите агенту набросать сцены, создать стоп-кадры, выбрать направление и превратить раскадровку в анимацию.", outcome: "Результат: кадры раскадровки, анимированные материалы" },
    ],
  },
  ja: {
    eyebrow: "実際のメディア制作",
    title: "プロンプトだけでなく、CLIでファイルを制作",
    body: "一度インストールして flatkey login を実行すれば、brief、フォルダ、CSV、agentから画像や動画を一括生成できます。",
    items: [
      { kind: "動画", title: "9:16 UGC広告クリップ", body: "商品、対象者、切り口、アスペクト比をagentに伝え、SNS広告向けの短いクリップを制作します。", outcome: "出力：動画クリップ、hook、ファーストフレーム" },
      { kind: "画像", title: "キャンペーンのメイン画像", body: "ローンチbriefとブランド方針から、カバー、ランディング用画像、商品シーン、複数案を作成します。", outcome: "出力：メイン画像、商品シーン" },
      { kind: "動画", title: "商品リビールシーケンス", body: "商品写真を起点に見せ方を設計し、クリップを生成して利用可能なファイルをまとめます。", outcome: "出力：リビールクリップ、編集可能ファイル" },
      { kind: "画像", title: "サムネイルのテストセット", body: "agentが方向性を探索し、案を生成・評価して、タイトルやオーバーレイ文も作成します。", outcome: "出力：サムネイルセット、評価メモ" },
      { kind: "動画", title: "市場別ローカライズ版", body: "市場と制約を指定し、ローカライズした画像、クリップ、音声方針、caption、コピーを作成します。", outcome: "出力：ローカライズ画像、動画、音声、コピー" },
      { kind: "画像 + 動画", title: "絵コンテからモーションへ", body: "シーンを設計し、静止画を作成し、最良案を選んで絵コンテをモーション素材へ変換します。", outcome: "出力：絵コンテフレーム、モーション素材" },
    ],
  },
  vi: {
    eyebrow: "Tác vụ media thực tế",
    title: "Dùng CLI để tạo file, không chỉ tạo prompt",
    body: "Cài một lần, chạy flatkey login rồi tạo hàng loạt ảnh và video từ brief, thư mục, CSV hoặc agent.",
    items: [
      { kind: "Video", title: "Clip quảng cáo UGC 9:16", body: "Cho agent biết sản phẩm, đối tượng, góc tiếp cận và tỷ lệ để tạo clip ngắn cho quảng cáo mạng xã hội.", outcome: "Đầu ra: clip, hook và khung hình đầu" },
      { kind: "Hình ảnh", title: "Hình ảnh chủ đạo cho chiến dịch", body: "Cung cấp brief ra mắt và định hướng thương hiệu để tạo ảnh bìa, hình landing page, bối cảnh sản phẩm và biến thể.", outcome: "Đầu ra: hình chủ đạo và bối cảnh sản phẩm" },
      { kind: "Video", title: "Chuỗi giới thiệu sản phẩm", body: "Bắt đầu từ ảnh sản phẩm, lên kế hoạch cách hé lộ, tạo clip và gom các file có thể sử dụng.", outcome: "Đầu ra: clip giới thiệu và file sẵn sàng chỉnh sửa" },
      { kind: "Hình ảnh", title: "Bộ thử nghiệm thumbnail", body: "Để agent khám phá hướng thiết kế, tạo phương án, xếp hạng kết quả và viết tiêu đề hoặc chữ phủ.", outcome: "Đầu ra: bộ thumbnail và ghi chú xếp hạng" },
      { kind: "Video", title: "Biến thể bản địa hóa theo thị trường", body: "Cung cấp thị trường và ràng buộc để tạo hình, clip, hướng voiceover, caption và nội dung bản địa hóa.", outcome: "Đầu ra: hình, video, audio và nội dung bản địa hóa" },
      { kind: "Hình ảnh + video", title: "Từ storyboard đến chuyển động", body: "Yêu cầu agent phác thảo cảnh, tạo khung hình tĩnh, chọn hướng tốt nhất và biến storyboard thành asset chuyển động.", outcome: "Đầu ra: khung storyboard và asset chuyển động" },
    ],
  },
  de: {
    eyebrow: "Echte Medienaufträge",
    title: "Mit der CLI Dateien produzieren, nicht nur Prompts",
    body: "Einmal installieren, flatkey login ausführen und Bilder sowie Videos aus Briefings, Ordnern, CSVs oder Agents stapelweise erzeugen.",
    items: [
      { kind: "Video", title: "9:16-UGC-Werbeclips", body: "Nenne dem Agent Produkt, Zielgruppe, Ansatz und Seitenverhältnis, damit er kurze Clips für Paid Social produziert.", outcome: "Ausgabe: Videoclips, Hooks, erste Frames" },
      { kind: "Bild", title: "Kampagnen-Leitmotive", body: "Gib Launch-Briefing und Markenrichtung vor, um Cover, Landingpage-Visuals, Produktszenen und Varianten zu erstellen.", outcome: "Ausgabe: Leitmotive, Produktszenen" },
      { kind: "Video", title: "Produktenthüllungs-Sequenzen", body: "Starte mit einem Produktfoto, plane Enthüllungsrichtungen, erzeuge Clips und halte nutzbare Dateien zusammen.", outcome: "Ausgabe: Enthüllungsclips, schnittfertige Dateien" },
      { kind: "Bild", title: "Thumbnail-Testreihen", body: "Lass den Agent Richtungen erkunden, Optionen erzeugen, die besten bewerten und Titel oder Overlays schreiben.", outcome: "Ausgabe: Thumbnail-Reihen, Ranking-Notizen" },
      { kind: "Video", title: "Lokalisierte Marktvarianten", body: "Definiere Märkte und Vorgaben, um lokalisierte Visuals, Clips, Voiceover-Richtung, Captions und Texte zu erstellen.", outcome: "Ausgabe: lokalisierte Bilder, Videos, Audio und Texte" },
      { kind: "Bild + Video", title: "Vom Storyboard zur Bewegung", body: "Lass den Agent Szenen entwerfen, Standbilder erstellen, die beste Richtung wählen und das Storyboard animieren.", outcome: "Ausgabe: Storyboard-Frames, animierte Assets" },
    ],
  },
  id: {
    eyebrow: "Pekerjaan media nyata",
    title: "Gunakan CLI untuk menghasilkan file, bukan sekadar prompt",
    body: "Instal sekali, jalankan flatkey login, lalu buat gambar dan video secara massal dari brief, folder, CSV, atau agen.",
    items: [
      { kind: "Video", title: "Klip iklan UGC 9:16", body: "Beri tahu agen tentang produk, audiens, sudut pesan, dan rasio aspek agar menghasilkan klip pendek untuk iklan media sosial.", outcome: "Hasil: klip video, hook, frame pertama" },
      { kind: "Gambar", title: "Gambar utama kampanye", body: "Berikan brief peluncuran dan arahan merek untuk membuat gambar sampul, visual landing page, adegan produk, dan variasi.", outcome: "Hasil: gambar utama, adegan produk" },
      { kind: "Video", title: "Urutan pengungkapan produk", body: "Mulai dari foto produk, rencanakan cara pengungkapan, buat klip, dan kumpulkan file yang siap digunakan.", outcome: "Hasil: klip pengungkapan, file siap edit" },
      { kind: "Gambar", title: "Set pengujian thumbnail", body: "Biarkan agen menjelajahi arah thumbnail, membuat pilihan, memberi peringkat, dan menulis judul atau teks overlay.", outcome: "Hasil: set thumbnail, catatan peringkat" },
      { kind: "Video", title: "Variasi pasar yang dilokalkan", body: "Tentukan pasar dan batasan agar agen membuat visual, klip, arahan sulih suara, caption, dan copy yang dilokalkan.", outcome: "Hasil: gambar, video, audio, dan copy lokal" },
      { kind: "Gambar + video", title: "Dari storyboard ke gerak", body: "Minta agen menyusun adegan, membuat frame diam, memilih arah terbaik, dan mengubah storyboard menjadi aset bergerak.", outcome: "Hasil: frame storyboard, aset bergerak" },
    ],
  },
};

const baseCliLandingCopy: Record<Locale, CliLandingBaseCopy> = withIdFallback({
  en: {
    seo: {
      title: "Flatkey CLI for AI Media Teams",
      description:
        "Generate images, videos, audio, and text from one command-line workflow with one Flatkey API key, one balance, local outputs, and agent-ready JSON.",
    },
    navLabel: "CLI",
    hero: {
      eyebrow: "Flatkey CLI for media teams",
      title: "One CLI for every media generation job",
      accent: "from brief to files",
      body: "Generate images, videos, voiceovers, sound effects, music, and text from one Flatkey balance. Use it manually from the terminal, or wire it into Claude Code, Codex, Cursor, OpenClaw, and other agents.",
      primaryCta: "Install CLI",
      secondaryCta: "Get API key",
    },
    stats: [
      { value: "1", label: "API key for every command" },
      { value: "4", label: "media types from one workflow" },
      { value: "JSON", label: "clean output for agents" },
    ],
    codeSamples: [
      { label: "Install and create", code: installCode },
      { label: "Agent dry run", code: agentCode },
    ],
    sections: {
      workflow: {
        eyebrow: "Production workflow",
        title: "From creative brief to local files",
        body: "Flatkey CLI gives media teams a repeatable production surface. Generate stills, video clips, voiceover, music, SFX, and copy without switching between dashboards or rebuilding the same prompt by hand.",
        cards: [
          { title: "Video generation", body: "Create 9:16 clips, product reveals, first-frame/last-frame transitions, and reference-image video jobs from local files." },
          { title: "Image generation", body: "Make campaign stills, thumbnails, product concepts, covers, and visual options with saved local outputs." },
          { title: "Audio generation", body: "Generate voiceover, sound effects, and music beds from the same CLI workflow." },
          { title: "Text generation", body: "Draft hooks, titles, captions, scripts, and prompt variants before generating media." },
        ],
      },
      spend: {
        title: "One key. One balance. One ledger.",
        body: "Every command runs through Flatkey. Teams can see credits, model usage, request history, and cost behavior in one place instead of spreading media production across separate subscriptions.",
        bullets: ["Check credits before a run.", "Use dry-run before spending.", "Keep generated files and request output tied to the same job folder."],
      },
      agent: {
        title: "Human-friendly. Agent-ready.",
        body: "Run Flatkey directly when you want control. Add --json, --dry-run, and --output when an AI agent or script needs predictable behavior.",
        bullets: ["Predictable stdout for automation.", "Local outputs for editing and review.", "Model discovery before choosing a generation route."],
      },
      useCases: {
        title: "What media teams run with it",
        items: [
          { title: "Batch ad concepts", body: "Generate multiple hooks, thumbnails, clips, and voiceover options for a campaign folder." },
          { title: "Product launch assets", body: "Turn one brief into hero images, short videos, captions, and audio in one local workflow." },
          { title: "Localization", body: "Create region-specific prompts, voiceovers, captions, and creative variants for US, Brazil, Japan, and other markets." },
          { title: "AI agent production", body: "Let Claude Code, Codex, or another agent plan the creative, run Flatkey commands, save files, and report cost." },
        ],
      },
      faq: {
        title: "CLI questions",
        items: [
          { question: "Is Flatkey CLI only for developers?", answer: "No. It is a terminal workflow, but the job is media production: generate files, compare outputs, and keep costs visible." },
          { question: "Does it replace creative suites?", answer: "No. Use creative suites when you need their visual editor. Use Flatkey CLI when you need repeatable generation, local outputs, automation, and one balance across models." },
          { question: "Can it generate video from local images?", answer: "Yes. The CLI can upload local reference images and use image, first-frame, or last-frame inputs for supported video models." },
        ],
      },
      cta: {
        title: "Turn one brief into a production run",
        body: "Install Flatkey CLI, create a key, and start generating media files from one balance.",
        primaryCta: "Install CLI",
        secondaryCta: "Create API key",
      },
    },
  },
  zh: {
    seo: { title: "面向 AI 媒体团队的 Flatkey CLI", description: "用一个 Flatkey API key 和一个余额，在命令行生成图片、视频、音频和文本，并支持本地输出与 agent JSON。" },
    navLabel: "CLI",
    hero: { eyebrow: "媒体团队的 Flatkey CLI", title: "一个 CLI，跑完整媒体生成工作", accent: "从 brief 到文件", body: "用一个 Flatkey 余额生成图片、视频、配音、音效、音乐和文案。可以手动在终端运行，也可以接入 Claude Code、Codex、Cursor、OpenClaw 等 agent。", primaryCta: "安装 CLI", secondaryCta: "获取 API key" },
    stats: [{ value: "1", label: "一个 API key 跑所有命令" }, { value: "4", label: "四类媒体工作流" }, { value: "JSON", label: "适合 agent 的干净输出" }],
    codeSamples: [{ label: "安装并生成", code: installCode }, { label: "Agent dry run", code: agentCode }],
    sections: {
      workflow: { eyebrow: "生产工作流", title: "从创意 brief 到本地文件", body: "Flatkey CLI 给媒体团队一个可重复的生产入口。图片、视频、配音、音乐、音效、文案都能在同一套命令里生成，不必反复切后台或手工重建 prompt。", cards: [{ title: "视频生成", body: "生成 9:16 短片、产品 reveal、首尾帧转场，以及基于本地参考图的视频任务。" }, { title: "图片生成", body: "生成活动主视觉、缩略图、产品概念图、封面和多版视觉方案，并保存到本地。" }, { title: "音频生成", body: "同一条 CLI 工作流里生成配音、音效和音乐垫。" }, { title: "文本生成", body: "在生成媒体前先产出 hooks、标题、caption、脚本和 prompt 变体。" }] },
      spend: { title: "一个 key。一个余额。一本账。", body: "每条命令都走 Flatkey。团队可以在一个地方看 credits、模型用量、请求记录和成本，而不是散落在多个订阅里。", bullets: ["运行前检查余额。", "花钱前先 dry-run。", "生成文件和请求输出放进同一个任务目录。"] },
      agent: { title: "人能用，agent 也能用。", body: "需要控制时直接手动运行；agent 或脚本需要稳定行为时加 --json、--dry-run 和 --output。", bullets: ["适合自动化的稳定 stdout。", "本地输出方便剪辑和审核。", "生成前先发现可用模型。"] },
      useCases: { title: "媒体团队会拿它跑什么", items: [{ title: "批量广告概念", body: "为一个 campaign 文件夹生成多版 hook、缩略图、短片和配音。" }, { title: "产品发布素材", body: "把一条 brief 变成主视觉、短视频、caption 和音频。" }, { title: "本地化", body: "为美国、巴西、日本等市场生成地区化 prompt、配音、caption 和创意变体。" }, { title: "AI agent 生产", body: "让 Claude Code、Codex 或其它 agent 规划创意、运行命令、保存文件并汇报成本。" }] },
      faq: { title: "CLI 常见问题", items: [{ question: "Flatkey CLI 只给开发者用吗？", answer: "不是。它是终端工作流，但服务的是媒体生产：生成文件、比较输出、看清成本。" }, { question: "它会替代创意套件吗？", answer: "不会。需要可视化编辑器时继续用创意套件；需要可重复生成、本地输出、自动化和统一余额时用 Flatkey CLI。" }, { question: "能用本地图片生成视频吗？", answer: "可以。CLI 能上传本地参考图，并在支持的模型中使用 image、first-frame 或 last-frame 输入。" }] },
      cta: { title: "把一条 brief 变成一次生产 run", body: "安装 Flatkey CLI，创建 key，然后从一个余额开始生成媒体文件。", primaryCta: "安装 CLI", secondaryCta: "创建 API key" },
    },
  },
  es: {
    seo: { title: "Flatkey CLI para equipos de medios con IA", description: "Genera imágenes, videos, audio y texto desde un solo flujo de línea de comandos con una API key de Flatkey, un saldo, archivos locales y JSON para agentes." },
    navLabel: "CLI",
    hero: { eyebrow: "Flatkey CLI para equipos de medios", title: "Una CLI para cada trabajo de generación multimedia", accent: "del brief a los archivos", body: "Genera imágenes, videos, voces, efectos, música y texto desde un solo saldo de Flatkey. Úsala en la terminal o con Claude Code, Codex, Cursor, OpenClaw y otros agentes.", primaryCta: "Instalar CLI", secondaryCta: "Obtener API key" },
    stats: [{ value: "1", label: "API key para cada comando" }, { value: "4", label: "tipos de medios en un flujo" }, { value: "JSON", label: "salida limpia para agentes" }],
    codeSamples: [{ label: "Instalar y crear", code: installCode }, { label: "Dry run para agente", code: agentCode }],
    sections: {
      workflow: { eyebrow: "Flujo de producción", title: "Del brief creativo a archivos locales", body: "Flatkey CLI da a los equipos de medios una superficie de producción repetible. Genera imágenes, clips, voz, música, efectos y copy sin saltar entre paneles ni reconstruir prompts a mano.", cards: [{ title: "Generación de video", body: "Crea clips 9:16, revelados de producto, transiciones con primer/último frame y trabajos con imágenes locales." }, { title: "Generación de imagen", body: "Crea piezas de campaña, miniaturas, conceptos de producto, portadas y opciones visuales con salida local." }, { title: "Generación de audio", body: "Genera voz, efectos y música desde el mismo flujo CLI." }, { title: "Generación de texto", body: "Redacta hooks, títulos, captions, guiones y variantes de prompt antes de generar medios." }] },
      spend: { title: "Una key. Un saldo. Un ledger.", body: "Cada comando pasa por Flatkey. El equipo ve créditos, uso de modelos, historial y coste en un solo lugar.", bullets: ["Consulta créditos antes de correr.", "Usa dry-run antes de gastar.", "Conserva archivos y salida del request en la misma carpeta de trabajo."] },
      agent: { title: "Cómoda para humanos. Lista para agentes.", body: "Ejecuta Flatkey directamente cuando quieras control. Añade --json, --dry-run y --output cuando un agente o script necesite comportamiento predecible.", bullets: ["Stdout predecible para automatización.", "Salidas locales para edición y revisión.", "Descubrimiento de modelos antes de elegir ruta."] },
      useCases: { title: "Qué ejecutan los equipos de medios", items: [{ title: "Conceptos publicitarios en lote", body: "Genera hooks, miniaturas, clips y voces para una carpeta de campaña." }, { title: "Activos de lanzamiento", body: "Convierte un brief en hero images, videos cortos, captions y audio." }, { title: "Localización", body: "Crea prompts, voces, captions y variantes para Estados Unidos, Brasil, Japón y otros mercados." }, { title: "Producción con agentes IA", body: "Deja que Claude Code, Codex u otro agente planifique, ejecute comandos, guarde archivos y reporte coste." }] },
      faq: { title: "Preguntas sobre CLI", items: [{ question: "¿Flatkey CLI es solo para developers?", answer: "No. Es una terminal, pero el trabajo es producción de medios: generar archivos, comparar resultados y ver costes." }, { question: "¿Reemplaza suites creativas?", answer: "No. Usa suites cuando necesites editor visual. Usa Flatkey CLI para generación repetible, salidas locales, automatización y un saldo común." }, { question: "¿Puede generar video desde imágenes locales?", answer: "Sí. La CLI puede subir imágenes de referencia locales y usar image, first-frame o last-frame en modelos compatibles." }] },
      cta: { title: "Convierte un brief en una corrida de producción", body: "Instala Flatkey CLI, crea una key y empieza a generar archivos multimedia desde un saldo.", primaryCta: "Instalar CLI", secondaryCta: "Crear API key" },
    },
  },
  fr: {
    seo: { title: "Flatkey CLI pour équipes média IA", description: "Générez images, vidéos, audio et texte dans un seul workflow CLI avec une clé Flatkey, un solde, des sorties locales et du JSON pour agents." },
    navLabel: "CLI",
    hero: { eyebrow: "Flatkey CLI pour équipes média", title: "Un CLI pour chaque tâche de génération média", accent: "du brief aux fichiers", body: "Générez images, vidéos, voix off, effets, musique et texte depuis un seul solde Flatkey. Utilisez-le dans le terminal ou avec Claude Code, Codex, Cursor, OpenClaw et d'autres agents.", primaryCta: "Installer le CLI", secondaryCta: "Obtenir une clé API" },
    stats: [{ value: "1", label: "clé API pour toutes les commandes" }, { value: "4", label: "types média dans un workflow" }, { value: "JSON", label: "sortie propre pour agents" }],
    codeSamples: [{ label: "Installer et créer", code: installCode }, { label: "Dry run agent", code: agentCode }],
    sections: {
      workflow: { eyebrow: "Workflow de production", title: "Du brief créatif aux fichiers locaux", body: "Flatkey CLI donne aux équipes média une surface de production répétable. Générez visuels, clips, voix, musique, SFX et textes sans changer de tableau de bord ni refaire les prompts à la main.", cards: [{ title: "Génération vidéo", body: "Créez clips 9:16, reveals produit, transitions premier/dernier frame et jobs vidéo depuis des images locales." }, { title: "Génération image", body: "Créez visuels de campagne, miniatures, concepts produit, couvertures et variantes avec sortie locale." }, { title: "Génération audio", body: "Générez voix off, effets sonores et musiques dans le même workflow CLI." }, { title: "Génération texte", body: "Rédigez hooks, titres, captions, scripts et variantes de prompt avant de générer le média." }] },
      spend: { title: "Une clé. Un solde. Un registre.", body: "Chaque commande passe par Flatkey. Les équipes voient crédits, modèles, historique et coûts au même endroit.", bullets: ["Vérifiez les crédits avant l'exécution.", "Utilisez dry-run avant de dépenser.", "Gardez fichiers et sorties de requête dans le même dossier de job."] },
      agent: { title: "Simple pour humains. Prête pour agents.", body: "Lancez Flatkey directement pour garder le contrôle. Ajoutez --json, --dry-run et --output quand un agent ou script a besoin d'un comportement prévisible.", bullets: ["Stdout prévisible pour l'automatisation.", "Fichiers locaux pour montage et review.", "Découverte des modèles avant le choix de route."] },
      useCases: { title: "Ce que les équipes média lancent", items: [{ title: "Concepts pub en lot", body: "Générez hooks, miniatures, clips et voix pour un dossier de campagne." }, { title: "Assets de lancement", body: "Transformez un brief en hero images, vidéos courtes, captions et audio." }, { title: "Localisation", body: "Créez prompts, voix, captions et variantes pour les États-Unis, le Brésil, le Japon et d'autres marchés." }, { title: "Production par agent IA", body: "Laissez Claude Code, Codex ou un autre agent planifier, exécuter, sauvegarder et rapporter le coût." }] },
      faq: { title: "Questions CLI", items: [{ question: "Flatkey CLI est-il réservé aux développeurs ?", answer: "Non. C'est un workflow terminal, mais le travail est média : générer des fichiers, comparer les sorties et suivre les coûts." }, { question: "Remplace-t-il les suites créatives ?", answer: "Non. Utilisez une suite pour l'éditeur visuel. Utilisez Flatkey CLI pour génération répétable, sorties locales, automatisation et solde unique." }, { question: "Peut-il générer une vidéo depuis des images locales ?", answer: "Oui. Le CLI peut téléverser des images locales et utiliser image, first-frame ou last-frame avec les modèles compatibles." }] },
      cta: { title: "Transformez un brief en run de production", body: "Installez Flatkey CLI, créez une clé et générez des fichiers média depuis un seul solde.", primaryCta: "Installer le CLI", secondaryCta: "Créer une clé API" },
    },
  },
  pt: {
    seo: { title: "Flatkey CLI para equipes de mídia com IA", description: "Gere imagens, vídeos, áudio e texto em um fluxo de linha de comando com uma API key Flatkey, um saldo, arquivos locais e JSON para agentes." },
    navLabel: "CLI",
    hero: { eyebrow: "Flatkey CLI para equipes de mídia", title: "Uma CLI para cada trabalho de geração de mídia", accent: "do briefing aos arquivos", body: "Gere imagens, vídeos, locuções, efeitos, música e texto com um saldo Flatkey. Use no terminal ou conecte ao Claude Code, Codex, Cursor, OpenClaw e outros agentes.", primaryCta: "Instalar CLI", secondaryCta: "Obter API key" },
    stats: [{ value: "1", label: "API key para todos os comandos" }, { value: "4", label: "tipos de mídia em um fluxo" }, { value: "JSON", label: "saída limpa para agentes" }],
    codeSamples: [{ label: "Instalar e criar", code: installCode }, { label: "Dry run para agente", code: agentCode }],
    sections: {
      workflow: { eyebrow: "Fluxo de produção", title: "Do briefing criativo aos arquivos locais", body: "Flatkey CLI dá às equipes de mídia uma superfície repetível de produção. Gere imagens, vídeos, voz, música, efeitos e textos sem trocar de painéis nem refazer prompts à mão.", cards: [{ title: "Geração de vídeo", body: "Crie clips 9:16, reveals de produto, transições de primeiro/último frame e jobs com imagens locais." }, { title: "Geração de imagem", body: "Crie peças de campanha, thumbnails, conceitos de produto, capas e variações visuais com saída local." }, { title: "Geração de áudio", body: "Gere locução, efeitos sonoros e trilhas no mesmo fluxo CLI." }, { title: "Geração de texto", body: "Crie hooks, títulos, legendas, scripts e variantes de prompt antes de gerar mídia." }] },
      spend: { title: "Uma key. Um saldo. Um ledger.", body: "Cada comando passa pela Flatkey. A equipe vê créditos, uso de modelos, histórico e custo em um só lugar.", bullets: ["Verifique créditos antes de rodar.", "Use dry-run antes de gastar.", "Mantenha arquivos e saída da requisição na mesma pasta do job."] },
      agent: { title: "Boa para humanos. Pronta para agentes.", body: "Rode Flatkey diretamente quando quiser controle. Adicione --json, --dry-run e --output quando um agente ou script precisar de comportamento previsível.", bullets: ["Stdout previsível para automação.", "Arquivos locais para edição e revisão.", "Descoberta de modelos antes de escolher rota."] },
      useCases: { title: "O que equipes de mídia rodam", items: [{ title: "Conceitos de anúncio em lote", body: "Gere hooks, thumbnails, vídeos e locuções para uma pasta de campanha." }, { title: "Assets de lançamento", body: "Transforme um briefing em hero images, vídeos curtos, legendas e áudio." }, { title: "Localização", body: "Crie prompts, vozes, legendas e variações para EUA, Brasil, Japão e outros mercados." }, { title: "Produção com agente IA", body: "Deixe Claude Code, Codex ou outro agente planejar, rodar comandos, salvar arquivos e reportar custo." }] },
      faq: { title: "Perguntas sobre CLI", items: [{ question: "Flatkey CLI é só para desenvolvedores?", answer: "Não. É um fluxo de terminal, mas o trabalho é produção de mídia: gerar arquivos, comparar saídas e ver custos." }, { question: "Substitui suítes criativas?", answer: "Não. Use suítes quando precisar de editor visual. Use Flatkey CLI para geração repetível, saída local, automação e um saldo único." }, { question: "Gera vídeo a partir de imagens locais?", answer: "Sim. A CLI pode enviar imagens locais e usar image, first-frame ou last-frame em modelos compatíveis." }] },
      cta: { title: "Transforme um briefing em uma rodada de produção", body: "Instale Flatkey CLI, crie uma key e comece a gerar arquivos de mídia com um saldo.", primaryCta: "Instalar CLI", secondaryCta: "Criar API key" },
    },
  },
  ru: {
    seo: { title: "Flatkey CLI для AI-медиакоманд", description: "Генерируйте изображения, видео, аудио и текст из одного CLI с API-ключом Flatkey, единым балансом, локальными файлами и JSON для агентов." },
    navLabel: "CLI",
    hero: { eyebrow: "Flatkey CLI для медиакоманд", title: "Один CLI для всех задач генерации медиа", accent: "от брифа до файлов", body: "Генерируйте изображения, видео, озвучку, эффекты, музыку и текст из одного баланса Flatkey. Запускайте вручную в терминале или подключайте к Claude Code, Codex, Cursor, OpenClaw и другим агентам.", primaryCta: "Установить CLI", secondaryCta: "Получить API key" },
    stats: [{ value: "1", label: "API key для всех команд" }, { value: "4", label: "типа медиа в одном процессе" }, { value: "JSON", label: "чистый вывод для агентов" }],
    codeSamples: [{ label: "Установка и генерация", code: installCode }, { label: "Dry run для агента", code: agentCode }],
    sections: {
      workflow: { eyebrow: "Производственный процесс", title: "От креативного брифа к локальным файлам", body: "Flatkey CLI дает медиакомандам повторяемую производственную поверхность: картинки, клипы, голос, музыка, SFX и тексты без переключения панелей и ручного пересоздания prompt.", cards: [{ title: "Генерация видео", body: "Создавайте 9:16 клипы, product reveal, переходы first/last frame и задачи с локальными референсами." }, { title: "Генерация изображений", body: "Создавайте кампейн-визуалы, thumbnails, концепты продуктов, обложки и варианты с локальным сохранением." }, { title: "Генерация аудио", body: "Генерируйте озвучку, звуковые эффекты и музыку в одном CLI workflow." }, { title: "Генерация текста", body: "Пишите hooks, заголовки, captions, сценарии и варианты prompt перед созданием медиа." }] },
      spend: { title: "Один key. Один баланс. Один ledger.", body: "Каждая команда идет через Flatkey. Команда видит кредиты, модели, историю запросов и стоимость в одном месте.", bullets: ["Проверяйте кредиты перед запуском.", "Используйте dry-run перед расходом.", "Храните файлы и вывод запроса в одной папке задачи."] },
      agent: { title: "Удобно людям. Готово для агентов.", body: "Запускайте Flatkey напрямую для контроля. Добавляйте --json, --dry-run и --output, когда агенту или скрипту нужна предсказуемость.", bullets: ["Предсказуемый stdout для автоматизации.", "Локальные файлы для монтажа и проверки.", "Поиск моделей до выбора маршрута."] },
      useCases: { title: "Что запускают медиакоманды", items: [{ title: "Пакетные рекламные концепты", body: "Генерируйте hooks, thumbnails, клипы и озвучки для папки кампании." }, { title: "Материалы запуска продукта", body: "Превращайте бриф в hero images, короткие видео, captions и аудио." }, { title: "Локализация", body: "Создавайте prompt, голоса, captions и варианты для США, Бразилии, Японии и других рынков." }, { title: "AI-agent production", body: "Позвольте Claude Code, Codex или другому агенту планировать, запускать команды, сохранять файлы и считать стоимость." }] },
      faq: { title: "Вопросы о CLI", items: [{ question: "Flatkey CLI только для разработчиков?", answer: "Нет. Это терминальный workflow, но задача медийная: генерировать файлы, сравнивать результаты и видеть стоимость." }, { question: "Он заменяет креативные suites?", answer: "Нет. Для визуального редактора используйте suite. Для повторяемой генерации, локальных файлов, автоматизации и единого баланса используйте Flatkey CLI." }, { question: "Можно делать видео из локальных изображений?", answer: "Да. CLI может загрузить локальные референсы и использовать image, first-frame или last-frame в поддерживаемых моделях." }] },
      cta: { title: "Превратите бриф в production run", body: "Установите Flatkey CLI, создайте key и начните генерировать медиафайлы из одного баланса.", primaryCta: "Установить CLI", secondaryCta: "Создать API key" },
    },
  },
  ja: {
    seo: { title: "AIメディアチーム向け Flatkey CLI", description: "1つのFlatkey API keyと残高で、画像・動画・音声・テキストをCLIから生成。ローカル出力とagent向けJSONに対応。" },
    navLabel: "CLI",
    hero: { eyebrow: "メディアチーム向け Flatkey CLI", title: "メディア生成をまとめて動かすCLI", accent: "briefからファイルまで", body: "画像、動画、ナレーション、効果音、音楽、テキストを1つのFlatkey残高で生成。ターミナルから直接使うことも、Claude Code、Codex、Cursor、OpenClawなどのagentに接続することもできます。", primaryCta: "CLIをインストール", secondaryCta: "API keyを取得" },
    stats: [{ value: "1", label: "全コマンドに1つのAPI key" }, { value: "4", label: "1つのworkflowで複数メディア" }, { value: "JSON", label: "agent向けの安定した出力" }],
    codeSamples: [{ label: "インストールして生成", code: installCode }, { label: "Agent dry run", code: agentCode }],
    sections: {
      workflow: { eyebrow: "制作workflow", title: "クリエイティブbriefからローカルファイルへ", body: "Flatkey CLIは、メディアチームに繰り返し使える制作面を提供します。静止画、動画、音声、音楽、SFX、コピーを、複数の管理画面を行き来せずに生成できます。", cards: [{ title: "動画生成", body: "9:16動画、商品reveal、first-frame/last-frame遷移、ローカル参照画像を使った動画jobを作成。" }, { title: "画像生成", body: "キャンペーン画像、サムネイル、商品コンセプト、カバー、複数案をローカルに保存。" }, { title: "音声生成", body: "ナレーション、効果音、音楽ベッドを同じCLI workflowで生成。" }, { title: "テキスト生成", body: "メディア生成前にhooks、タイトル、caption、台本、prompt案を作成。" }] },
      spend: { title: "1つのkey。1つの残高。1つのledger。", body: "すべてのコマンドはFlatkeyを通ります。credits、モデル利用、リクエスト履歴、コストを1か所で確認できます。", bullets: ["実行前にcreditsを確認。", "消費前にdry-run。", "生成ファイルとrequest出力を同じjobフォルダに保存。"] },
      agent: { title: "人にも使いやすく、agentにも対応。", body: "制御したい時は直接実行。agentやscriptに安定した挙動が必要なら --json、--dry-run、--output を使います。", bullets: ["自動化向けの安定stdout。", "編集とレビューに使えるローカル出力。", "生成前にモデルを確認。"] },
      useCases: { title: "メディアチームでの使い方", items: [{ title: "広告案の一括生成", body: "campaignフォルダに複数のhook、thumbnail、clip、voiceoverを生成。" }, { title: "ローンチ素材", body: "1つのbriefからhero image、短尺動画、caption、音声を作成。" }, { title: "ローカライズ", body: "米国、ブラジル、日本など市場別のprompt、音声、caption、クリエイティブ案を作成。" }, { title: "AI agent制作", body: "Claude Code、Codexなどのagentが企画、コマンド実行、保存、コスト報告まで担当。" }] },
      faq: { title: "CLI FAQ", items: [{ question: "Flatkey CLIは開発者専用ですか？", answer: "いいえ。ターミナルworkflowですが、目的はメディア制作です。ファイル生成、比較、コスト確認に使います。" }, { question: "クリエイティブsuiteを置き換えますか？", answer: "いいえ。視覚編集が必要ならsuiteを使います。繰り返し生成、ローカル出力、自動化、統一残高が必要ならFlatkey CLIを使います。" }, { question: "ローカル画像から動画を生成できますか？", answer: "はい。CLIでローカル参照画像をアップロードし、対応モデルでimage、first-frame、last-frame入力を使えます。" }] },
      cta: { title: "1つのbriefをproduction runへ", body: "Flatkey CLIをインストールし、keyを作成して、1つの残高からメディアファイルを生成しましょう。", primaryCta: "CLIをインストール", secondaryCta: "API keyを作成" },
    },
  },
  vi: {
    seo: { title: "Flatkey CLI cho đội media AI", description: "Tạo ảnh, video, âm thanh và văn bản từ một workflow dòng lệnh với một API key Flatkey, một số dư, file local và JSON cho agent." },
    navLabel: "CLI",
    hero: { eyebrow: "Flatkey CLI cho đội media", title: "Một CLI cho mọi việc tạo media", accent: "từ brief đến file", body: "Tạo ảnh, video, voiceover, hiệu ứng âm thanh, nhạc và text từ một số dư Flatkey. Dùng trực tiếp trong terminal hoặc nối vào Claude Code, Codex, Cursor, OpenClaw và agent khác.", primaryCta: "Cài CLI", secondaryCta: "Lấy API key" },
    stats: [{ value: "1", label: "API key cho mọi lệnh" }, { value: "4", label: "loại media trong một workflow" }, { value: "JSON", label: "output sạch cho agent" }],
    codeSamples: [{ label: "Cài và tạo", code: installCode }, { label: "Agent dry run", code: agentCode }],
    sections: {
      workflow: { eyebrow: "Workflow sản xuất", title: "Từ creative brief đến file local", body: "Flatkey CLI cho đội media một bề mặt sản xuất lặp lại được. Tạo ảnh, clip, voice, nhạc, SFX và copy mà không phải đổi dashboard hay dựng lại prompt thủ công.", cards: [{ title: "Tạo video", body: "Tạo clip 9:16, product reveal, chuyển cảnh first/last-frame và job video từ ảnh local." }, { title: "Tạo ảnh", body: "Tạo campaign still, thumbnail, concept sản phẩm, cover và nhiều phương án hình ảnh với output local." }, { title: "Tạo audio", body: "Tạo voiceover, hiệu ứng âm thanh và nhạc nền trong cùng workflow CLI." }, { title: "Tạo text", body: "Viết hooks, tiêu đề, caption, script và biến thể prompt trước khi tạo media." }] },
      spend: { title: "Một key. Một số dư. Một ledger.", body: "Mọi lệnh đi qua Flatkey. Đội có thể xem credits, model usage, lịch sử request và cost trong một nơi.", bullets: ["Kiểm tra credits trước khi chạy.", "Dùng dry-run trước khi tiêu.", "Giữ file tạo ra và output request trong cùng thư mục job."] },
      agent: { title: "Dễ cho người. Sẵn cho agent.", body: "Chạy Flatkey trực tiếp khi cần kiểm soát. Thêm --json, --dry-run và --output khi agent hoặc script cần hành vi ổn định.", bullets: ["Stdout ổn định cho automation.", "Output local cho edit và review.", "Khám phá model trước khi chọn route."] },
      useCases: { title: "Đội media dùng để làm gì", items: [{ title: "Ý tưởng quảng cáo hàng loạt", body: "Tạo nhiều hook, thumbnail, clip và voiceover cho một folder campaign." }, { title: "Asset ra mắt sản phẩm", body: "Biến một brief thành hero image, video ngắn, caption và audio." }, { title: "Bản địa hóa", body: "Tạo prompt, voice, caption và biến thể sáng tạo cho Mỹ, Brazil, Nhật và thị trường khác." }, { title: "Sản xuất bằng AI agent", body: "Để Claude Code, Codex hoặc agent khác lên kế hoạch, chạy lệnh, lưu file và báo cost." }] },
      faq: { title: "Câu hỏi CLI", items: [{ question: "Flatkey CLI chỉ dành cho developer?", answer: "Không. Đây là workflow terminal, nhưng công việc là media production: tạo file, so sánh output và thấy cost." }, { question: "Có thay thế creative suite không?", answer: "Không. Dùng suite khi cần editor trực quan. Dùng Flatkey CLI khi cần tạo lặp lại, output local, automation và một số dư chung." }, { question: "Có tạo video từ ảnh local không?", answer: "Có. CLI có thể upload ảnh tham chiếu local và dùng image, first-frame hoặc last-frame với model hỗ trợ." }] },
      cta: { title: "Biến một brief thành production run", body: "Cài Flatkey CLI, tạo key và bắt đầu tạo file media từ một số dư.", primaryCta: "Cài CLI", secondaryCta: "Tạo API key" },
    },
  },
  de: {
    seo: { title: "Flatkey CLI für KI-Medienteams", description: "Erzeuge Bilder, Videos, Audio und Text in einem CLI-Workflow mit einem Flatkey API-Key, einem Guthaben, lokalen Dateien und JSON für Agents." },
    navLabel: "CLI",
    hero: { eyebrow: "Flatkey CLI für Medienteams", title: "Eine CLI für jede Mediengenerierung", accent: "vom Briefing zur Datei", body: "Erzeuge Bilder, Videos, Voiceovers, Soundeffekte, Musik und Text aus einem Flatkey-Guthaben. Nutze es im Terminal oder mit Claude Code, Codex, Cursor, OpenClaw und anderen Agents.", primaryCta: "CLI installieren", secondaryCta: "API key holen" },
    stats: [{ value: "1", label: "API key für alle Befehle" }, { value: "4", label: "Medientypen in einem Workflow" }, { value: "JSON", label: "saubere Ausgabe für Agents" }],
    codeSamples: [{ label: "Installieren und erstellen", code: installCode }, { label: "Agent dry run", code: agentCode }],
    sections: {
      workflow: { eyebrow: "Produktionsworkflow", title: "Vom kreativen Briefing zu lokalen Dateien", body: "Flatkey CLI gibt Medienteams eine wiederholbare Produktionsfläche. Erzeuge Stills, Clips, Voiceover, Musik, SFX und Copy ohne Dashboard-Wechsel oder manuelles Prompt-Neubauen.", cards: [{ title: "Videogenerierung", body: "Erstelle 9:16 Clips, Product Reveals, First/Last-Frame-Transitions und Videojobs mit lokalen Referenzbildern." }, { title: "Bildgenerierung", body: "Erstelle Kampagnenmotive, Thumbnails, Produktkonzepte, Cover und visuelle Varianten mit lokaler Ausgabe." }, { title: "Audiogenerierung", body: "Erzeuge Voiceover, Soundeffekte und Musikbetten im selben CLI-Workflow." }, { title: "Textgenerierung", body: "Schreibe Hooks, Titel, Captions, Skripte und Prompt-Varianten vor der Mediengenerierung." }] },
      spend: { title: "Ein key. Ein Guthaben. Ein ledger.", body: "Jeder Befehl läuft über Flatkey. Teams sehen Credits, Modellnutzung, Request-Historie und Kosten an einem Ort.", bullets: ["Credits vor dem Lauf prüfen.", "Dry-run vor Ausgaben nutzen.", "Dateien und Request-Ausgabe im selben Job-Ordner halten."] },
      agent: { title: "Gut für Menschen. Bereit für Agents.", body: "Starte Flatkey direkt für Kontrolle. Nutze --json, --dry-run und --output, wenn ein Agent oder Skript vorhersehbares Verhalten braucht.", bullets: ["Vorhersehbares stdout für Automation.", "Lokale Ausgaben für Schnitt und Review.", "Modell-Discovery vor der Routenauswahl."] },
      useCases: { title: "Was Medienteams damit ausführen", items: [{ title: "Ad-Konzepte in Serie", body: "Erzeuge mehrere Hooks, Thumbnails, Clips und Voiceover für einen Kampagnenordner." }, { title: "Launch-Assets", body: "Mache aus einem Briefing Hero Images, Kurzvideos, Captions und Audio." }, { title: "Lokalisierung", body: "Erstelle marktspezifische Prompts, Voices, Captions und Varianten für USA, Brasilien, Japan und weitere Märkte." }, { title: "AI-Agent-Produktion", body: "Lass Claude Code, Codex oder einen anderen Agent planen, Befehle ausführen, Dateien speichern und Kosten melden." }] },
      faq: { title: "CLI-Fragen", items: [{ question: "Ist Flatkey CLI nur für Entwickler?", answer: "Nein. Es ist ein Terminal-Workflow, aber die Aufgabe ist Medienproduktion: Dateien erzeugen, Outputs vergleichen und Kosten sichtbar halten." }, { question: "Ersetzt es Creative Suites?", answer: "Nein. Nutze Suites für visuelle Editorarbeit. Nutze Flatkey CLI für wiederholbare Generierung, lokale Outputs, Automation und ein gemeinsames Guthaben." }, { question: "Kann es Video aus lokalen Bildern erzeugen?", answer: "Ja. Die CLI kann lokale Referenzbilder hochladen und image, first-frame oder last-frame in unterstützten Modellen nutzen." }] },
      cta: { title: "Mache aus einem Briefing einen Produktionslauf", body: "Installiere Flatkey CLI, erstelle einen key und generiere Mediendateien aus einem Guthaben.", primaryCta: "CLI installieren", secondaryCta: "API key erstellen" },
    },
  },
  id: {
    seo: { title: "Flatkey CLI untuk tim media AI", description: "Buat gambar, video, audio, dan teks dari satu alur kerja CLI dengan satu API key Flatkey, satu saldo, file lokal, dan JSON untuk agen." },
    navLabel: "CLI",
    hero: { eyebrow: "Flatkey CLI untuk tim media", title: "Satu CLI untuk semua pekerjaan pembuatan media", accent: "dari brief menjadi file", body: "Buat gambar, video, sulih suara, efek suara, musik, dan teks dari satu saldo Flatkey. Jalankan langsung di terminal atau hubungkan ke Claude Code, Codex, Cursor, OpenClaw, dan agen lainnya.", primaryCta: "Instal CLI", secondaryCta: "Dapatkan API key" },
    stats: [{ value: "1", label: "API key untuk semua perintah" }, { value: "4", label: "jenis media dalam satu alur kerja" }, { value: "JSON", label: "output bersih untuk agen" }],
    codeSamples: [{ label: "Instal dan buat", code: installCode }, { label: "Dry run untuk agen", code: agentCode }],
    sections: {
      workflow: { eyebrow: "Alur kerja produksi", title: "Dari brief kreatif menjadi file lokal", body: "Flatkey CLI memberi tim media jalur produksi yang dapat diulang. Buat gambar, klip video, sulih suara, musik, efek suara, dan copy tanpa berpindah dashboard atau menyusun ulang prompt secara manual.", cards: [{ title: "Pembuatan video", body: "Buat klip 9:16, pengungkapan produk, transisi frame awal/akhir, dan tugas video dari gambar referensi lokal." }, { title: "Pembuatan gambar", body: "Buat visual kampanye, thumbnail, konsep produk, sampul, dan variasi visual dengan output lokal." }, { title: "Pembuatan audio", body: "Buat sulih suara, efek suara, dan musik latar dalam alur kerja CLI yang sama." }, { title: "Pembuatan teks", body: "Tulis hook, judul, caption, skrip, dan variasi prompt sebelum membuat media." }] },
      spend: { title: "Satu key. Satu saldo. Satu catatan.", body: "Setiap perintah berjalan melalui Flatkey. Tim dapat melihat kredit, penggunaan model, riwayat permintaan, dan biaya di satu tempat.", bullets: ["Periksa kredit sebelum menjalankan tugas.", "Gunakan dry-run sebelum memakai saldo.", "Simpan file hasil dan output permintaan dalam folder tugas yang sama."] },
      agent: { title: "Mudah untuk manusia. Siap untuk agen.", body: "Jalankan Flatkey langsung saat membutuhkan kendali. Tambahkan --json, --dry-run, dan --output saat agen atau skrip membutuhkan perilaku yang konsisten.", bullets: ["Stdout yang konsisten untuk otomatisasi.", "Output lokal untuk penyuntingan dan peninjauan.", "Temukan model sebelum memilih rute pembuatan."] },
      useCases: { title: "Yang dijalankan tim media", items: [{ title: "Konsep iklan massal", body: "Buat beberapa hook, thumbnail, klip, dan pilihan sulih suara untuk folder kampanye." }, { title: "Aset peluncuran produk", body: "Ubah satu brief menjadi gambar utama, video pendek, caption, dan audio dalam satu alur kerja lokal." }, { title: "Lokalisasi", body: "Buat prompt, sulih suara, caption, dan variasi kreatif khusus untuk AS, Brasil, Jepang, dan pasar lainnya." }, { title: "Produksi dengan agen AI", body: "Biarkan Claude Code, Codex, atau agen lain merencanakan materi, menjalankan perintah, menyimpan file, dan melaporkan biaya." }] },
      faq: { title: "Pertanyaan tentang CLI", items: [{ question: "Apakah Flatkey CLI hanya untuk developer?", answer: "Tidak. Ini adalah alur kerja terminal, tetapi pekerjaannya adalah produksi media: membuat file, membandingkan hasil, dan memantau biaya." }, { question: "Apakah ini menggantikan aplikasi kreatif?", answer: "Tidak. Gunakan aplikasi kreatif saat membutuhkan editor visual. Gunakan Flatkey CLI untuk pembuatan berulang, output lokal, otomatisasi, dan satu saldo lintas model." }, { question: "Bisakah membuat video dari gambar lokal?", answer: "Bisa. CLI dapat mengunggah gambar referensi lokal dan memakai input image, first-frame, atau last-frame pada model yang didukung." }] },
      cta: { title: "Ubah satu brief menjadi proses produksi", body: "Instal Flatkey CLI, buat key, lalu mulai menghasilkan file media dari satu saldo.", primaryCta: "Instal CLI", secondaryCta: "Buat API key" },
    },
  },
});

export const cliLandingCopy = Object.fromEntries(
  LOCALES.map((locale) => {
    const base = baseCliLandingCopy[locale];
    return [locale, { ...base, sections: { ...base.sections, media: mediaSectionCopy[locale] } }];
  }),
) as Record<Locale, CliLandingCopy>;

export const higgsfieldAlternativeCopy: Record<Locale, CompareCopy> = withIdFallback({
  en: {
    seo: { title: "Flatkey vs Higgsfield: CLI Workflows for AI Video Teams", description: "Compare Flatkey and Higgsfield for AI media teams that need transparent credits, multi-model generation, local outputs, and repeatable CLI workflows." },
    hero: { eyebrow: "Flatkey vs Higgsfield", title: "When AI video moves from demos to production, use a CLI you can control", body: "Higgsfield is strong for visual creator workflows and agent-based image/video creation. Flatkey is built for media teams that need one balance, transparent spend, multi-model routing, local files, and repeatable production runs.", primaryCta: "Try Flatkey CLI", secondaryCta: "Compare workflows" },
    position: { title: "Different tools for different jobs", body: "Use Higgsfield when you want a polished creative suite, visual templates, and creator-first workflows. Use Flatkey when your team needs to generate repeatedly, compare models, control spend, and connect media generation to scripts or AI agents." },
    comparison: { title: "Where each product fits", headers: ["Need", "Flatkey", "Higgsfield"], rows: [["CLI production", "Image, video, audio, text, credits, models, local outputs, JSON mode.", "Strong agent-facing image/video creation."], ["Spend control", "One prepaid balance, credits command, request visibility, dry-run support.", "Creator-plan and credit model depends on Higgsfield account flow."], ["Multi-modal workflow", "Images, videos, voice, SFX, music, text in one CLI.", "Strong image/video creative workflow."], ["Best fit", "Media teams, agencies, operators, AI-agent production.", "Creators who want visual tools, templates, and community workflows."], ["Workflow style", "Terminal, scripts, agents, repeatable folders.", "Creative suite, MCP, visual generation experience."]] },
    pains: { eyebrow: "Research-backed pains", title: "Built around the pains AI video teams talk about", body: "In user research across US Reddit and Brazil/Japan YouTube discussions, the repeated pains were not only model quality. Teams struggled with credit trust, queue time, tool switching, failed generations, and turning short clips into usable production assets.", items: [{ title: "Credits are hard to trust", body: "Flatkey makes cost visible through one balance, credits checks, JSON output, and dry-run inspection before a job spends credits." }, { title: "Waiting breaks iteration", body: "CLI workflows make retries, saved outputs, and model switching easier to automate when a single generation path gets slow or unsuitable." }, { title: "Generation is only one step", body: "Media teams need prompts, images, videos, voiceover, music, captions, and local asset folders. Flatkey keeps those jobs behind one command surface." }, { title: "Quality means usable files", body: "The real metric is not one impressive demo. It is cost per usable clip, failed attempts, and whether the output can move into editing or publishing." }] },
    migration: { title: "Start with the workflow you already wanted from Higgsfield CLI", body: "If the promise that attracted you was creating media from inside an AI tool, Flatkey gives you that same direction with broader production controls: local output paths, JSON mode, dry runs, model discovery, and one shared Flatkey balance.", code: compareCode },
    cta: { title: "Make AI media generation repeatable", body: "Use Flatkey when the job is bigger than one prompt: compare models, generate variants, save files, inspect cost, and let agents run the workflow without hiding the bill.", primaryCta: "Install Flatkey CLI", secondaryCta: "Create API key" },
  },
  zh: {
    seo: { title: "Flatkey vs Higgsfield：AI 视频团队的 CLI 工作流", description: "比较 Flatkey 与 Higgsfield：面向需要透明 credits、多模型生成、本地输出和可重复 CLI 工作流的 AI 媒体团队。" },
    hero: { eyebrow: "Flatkey vs Higgsfield", title: "当 AI 视频从 demo 进入生产，选择你能控制的 CLI", body: "Higgsfield 擅长可视化创作套件和 agent 生图/生视频。Flatkey 面向需要统一余额、透明成本、多模型路由、本地文件和可重复生产 run 的媒体团队。", primaryCta: "试用 Flatkey CLI", secondaryCta: "比较工作流" },
    position: { title: "不同工具，服务不同任务", body: "需要精致创作套件、视觉模板和 creator-first 工作流时，用 Higgsfield。需要反复生成、比较模型、控制成本，并把媒体生成接进脚本或 AI agent 时，用 Flatkey。" },
    comparison: { title: "两者适合的位置", headers: ["需求", "Flatkey", "Higgsfield"], rows: [["CLI 生产", "图片、视频、音频、文本、credits、模型、本地输出、JSON mode。", "强在 agent 里的图片/视频生成。"], ["成本控制", "一个预付余额、credits 命令、请求可见、dry-run。", "创作者 plan 和 credits 取决于 Higgsfield 账号流程。"], ["多模态流程", "图片、视频、配音、音效、音乐、文本在一个 CLI。", "强在图片/视频创作流程。"], ["最适合", "媒体团队、agency、运营者、AI-agent production。", "需要视觉工具、模板和社区工作流的创作者。"], ["工作流形态", "终端、脚本、agent、可重复文件夹。", "创作套件、MCP、视觉生成体验。"]] },
    pains: { eyebrow: "基于调研的痛点", title: "围绕 AI 视频团队真实讨论的痛点设计", body: "US Reddit 与巴西/日本 YouTube 讨论里，反复出现的不只是模型质量。用户痛在 credits 信任、排队、工具切换、失败生成，以及把短片变成可交付素材。", items: [{ title: "Credits 不好信", body: "Flatkey 用一个余额、credits 查询、JSON 输出和 dry-run，让任务花钱前就更透明。" }, { title: "等待会打断迭代", body: "CLI 工作流更容易自动重试、保存输出、切模型；当单一路径慢或不合适时，迭代不中断。" }, { title: "生成只是其中一步", body: "媒体团队还需要 prompt、图片、视频、配音、音乐、caption 和本地素材目录。Flatkey 把这些放到同一个命令入口后面。" }, { title: "质量等于可用文件", body: "真正指标不是一个 demo 多惊艳，而是每条可用片的成本、失败次数，以及能否进入剪辑或发布。" }] },
    migration: { title: "从你期待 Higgsfield CLI 的工作流开始", body: "如果吸引你的是“在 AI 工具里直接创作媒体”，Flatkey 也走这个方向，但加上本地输出路径、JSON mode、dry run、模型发现和共享余额。", code: compareCode },
    cta: { title: "让 AI 媒体生成变成可重复生产", body: "当任务不止一个 prompt：比较模型、生成变体、保存文件、查看成本，并让 agent 跑完整流程但不隐藏账单。", primaryCta: "安装 Flatkey CLI", secondaryCta: "创建 API key" },
  },
  es: {
    seo: { title: "Flatkey vs Higgsfield: workflows CLI para equipos de video IA", description: "Compara Flatkey e Higgsfield para equipos de medios IA que necesitan créditos transparentes, generación multimodelo, archivos locales y workflows CLI repetibles." },
    hero: { eyebrow: "Flatkey vs Higgsfield", title: "Cuando el video IA pasa de demos a producción, usa una CLI que controles", body: "Higgsfield es fuerte en flujos visuales para creadores y generación image/video con agentes. Flatkey está hecho para equipos de medios que necesitan un saldo, gasto transparente, routing multimodelo, archivos locales y producción repetible.", primaryCta: "Probar Flatkey CLI", secondaryCta: "Comparar workflows" },
    position: { title: "Herramientas distintas para trabajos distintos", body: "Usa Higgsfield si quieres una suite creativa pulida, plantillas visuales y workflows creator-first. Usa Flatkey si tu equipo necesita generar repetidamente, comparar modelos, controlar gasto y conectar generación de medios a scripts o agentes IA." },
    comparison: { title: "Dónde encaja cada producto", headers: ["Necesidad", "Flatkey", "Higgsfield"], rows: [["Producción CLI", "Imagen, video, audio, texto, créditos, modelos, salidas locales, modo JSON.", "Fuerte creación image/video con agentes."], ["Control de gasto", "Un saldo prepago, comando credits, visibilidad de requests, dry-run.", "Planes y créditos dependen del flujo de cuenta Higgsfield."], ["Workflow multimodal", "Imágenes, videos, voz, SFX, música y texto en una CLI.", "Fuerte workflow creativo image/video."], ["Mejor fit", "Equipos de medios, agencias, operadores, producción con agentes IA.", "Creadores que quieren herramientas visuales, plantillas y comunidad."], ["Estilo de workflow", "Terminal, scripts, agentes, carpetas repetibles.", "Suite creativa, MCP, experiencia visual."]] },
    pains: { eyebrow: "Dolores investigados", title: "Diseñado alrededor de lo que los equipos de video IA comentan", body: "En investigación con Reddit de EE.UU. y YouTube de Brasil/Japón, los dolores no eran solo calidad del modelo. Aparecen confianza en créditos, colas, cambio de herramientas, generaciones fallidas y convertir clips cortos en assets útiles.", items: [{ title: "Los créditos son difíciles de confiar", body: "Flatkey muestra coste con un saldo, checks de credits, JSON y dry-run antes de gastar." }, { title: "La espera rompe la iteración", body: "Los workflows CLI hacen más fácil automatizar reintentos, guardar salidas y cambiar modelos cuando una ruta está lenta o no sirve." }, { title: "Generar es solo un paso", body: "Los equipos necesitan prompts, imágenes, videos, voz, música, captions y carpetas locales. Flatkey los mantiene detrás de una superficie de comandos." }, { title: "Calidad significa archivos utilizables", body: "La métrica real no es una demo bonita. Es coste por clip usable, intentos fallidos y si el output puede pasar a edición o publicación." }] },
    migration: { title: "Empieza con el workflow que querías de Higgsfield CLI", body: "Si te atrajo crear medios desde una herramienta IA, Flatkey sigue esa dirección con más controles de producción: rutas locales, JSON, dry runs, discovery de modelos y un saldo compartido.", code: compareCode },
    cta: { title: "Haz repetible la generación de medios IA", body: "Usa Flatkey cuando el trabajo es más que un prompt: comparar modelos, generar variantes, guardar archivos, inspeccionar coste y dejar que agentes corran el flujo sin ocultar la factura.", primaryCta: "Instalar Flatkey CLI", secondaryCta: "Crear API key" },
  },
  fr: {
    seo: { title: "Flatkey vs Higgsfield : workflows CLI pour équipes vidéo IA", description: "Comparez Flatkey et Higgsfield pour les équipes média IA qui veulent crédits transparents, génération multi-modèle, sorties locales et workflows CLI répétables." },
    hero: { eyebrow: "Flatkey vs Higgsfield", title: "Quand la vidéo IA passe des demos à la production, utilisez un CLI contrôlable", body: "Higgsfield est fort pour les workflows visuels créateur et la génération image/vidéo avec agents. Flatkey vise les équipes média qui veulent un solde, des coûts visibles, du routage multi-modèle, des fichiers locaux et des runs répétables.", primaryCta: "Essayer Flatkey CLI", secondaryCta: "Comparer les workflows" },
    position: { title: "Des outils différents pour des jobs différents", body: "Utilisez Higgsfield pour une suite créative polie, des templates visuels et un workflow creator-first. Utilisez Flatkey pour générer souvent, comparer des modèles, contrôler les coûts et connecter la génération média à des scripts ou agents IA." },
    comparison: { title: "Où chaque produit s'insère", headers: ["Besoin", "Flatkey", "Higgsfield"], rows: [["Production CLI", "Image, vidéo, audio, texte, crédits, modèles, sorties locales, mode JSON.", "Création image/vidéo forte côté agents."], ["Contrôle des coûts", "Un solde prépayé, commande credits, visibilité request, dry-run.", "Plans et crédits dépendent du flux de compte Higgsfield."], ["Workflow multimodal", "Images, vidéos, voix, SFX, musique, texte dans un CLI.", "Workflow créatif image/vidéo solide."], ["Meilleur usage", "Équipes média, agences, opérateurs, production par agents IA.", "Créateurs qui veulent outils visuels, templates et communauté."], ["Style de workflow", "Terminal, scripts, agents, dossiers répétables.", "Suite créative, MCP, expérience visuelle."]] },
    pains: { eyebrow: "Douleurs issues de la recherche", title: "Conçu autour des douleurs réelles des équipes vidéo IA", body: "Dans les discussions Reddit US et YouTube Brésil/Japon, les douleurs récurrentes ne se limitent pas à la qualité modèle : confiance crédits, files d'attente, outils éclatés, générations ratées et transformation de courts clips en assets utilisables.", items: [{ title: "Les crédits inspirent peu confiance", body: "Flatkey rend le coût visible avec un solde, des checks credits, du JSON et un dry-run avant dépense." }, { title: "L'attente casse l'itération", body: "Les workflows CLI facilitent retries, sauvegardes et changement de modèle quand une route devient lente ou inadaptée." }, { title: "Générer n'est qu'une étape", body: "Les équipes ont besoin de prompts, images, vidéos, voix, musique, captions et dossiers locaux. Flatkey les garde derrière une seule surface de commande." }, { title: "La qualité signifie fichiers utilisables", body: "La vraie métrique n'est pas une demo impressionnante. C'est le coût par clip exploitable, les échecs et le passage vers montage ou publication." }] },
    migration: { title: "Commencez par le workflow que vous attendiez de Higgsfield CLI", body: "Si l'attrait était de créer des médias depuis un outil IA, Flatkey suit cette direction avec plus de contrôles de production : chemins locaux, JSON, dry runs, découverte de modèles et solde partagé.", code: compareCode },
    cta: { title: "Rendez la génération média IA répétable", body: "Utilisez Flatkey quand le job dépasse un prompt : comparer, générer des variantes, sauver les fichiers, voir le coût et laisser les agents exécuter sans cacher la facture.", primaryCta: "Installer Flatkey CLI", secondaryCta: "Créer une clé API" },
  },
  pt: {
    seo: { title: "Flatkey vs Higgsfield: workflows CLI para equipes de vídeo IA", description: "Compare Flatkey e Higgsfield para equipes de mídia IA que precisam de créditos transparentes, geração multimodelo, arquivos locais e workflows CLI repetíveis." },
    hero: { eyebrow: "Flatkey vs Higgsfield", title: "Quando vídeo IA sai do demo e entra em produção, use uma CLI que você controla", body: "Higgsfield é forte em workflows visuais para criadores e geração image/video com agentes. Flatkey foi feito para equipes de mídia que precisam de um saldo, gasto transparente, roteamento multimodelo, arquivos locais e produção repetível.", primaryCta: "Testar Flatkey CLI", secondaryCta: "Comparar workflows" },
    position: { title: "Ferramentas diferentes para trabalhos diferentes", body: "Use Higgsfield quando quiser uma suíte criativa polida, templates visuais e workflow creator-first. Use Flatkey quando sua equipe precisa gerar repetidamente, comparar modelos, controlar gasto e conectar geração de mídia a scripts ou agentes IA." },
    comparison: { title: "Onde cada produto se encaixa", headers: ["Necessidade", "Flatkey", "Higgsfield"], rows: [["Produção CLI", "Imagem, vídeo, áudio, texto, créditos, modelos, saídas locais, modo JSON.", "Forte criação image/video com agentes."], ["Controle de gasto", "Um saldo pré-pago, comando credits, visibilidade de requests, dry-run.", "Planos e créditos dependem do fluxo de conta Higgsfield."], ["Workflow multimodal", "Imagens, vídeos, voz, SFX, música e texto em uma CLI.", "Forte workflow criativo image/video."], ["Melhor fit", "Equipes de mídia, agências, operadores, produção com agentes IA.", "Criadores que querem ferramentas visuais, templates e comunidade."], ["Estilo de workflow", "Terminal, scripts, agentes, pastas repetíveis.", "Suíte criativa, MCP, experiência visual."]] },
    pains: { eyebrow: "Dores baseadas em pesquisa", title: "Construído em torno das dores que equipes de vídeo IA comentam", body: "Em pesquisas com Reddit dos EUA e YouTube do Brasil/Japão, as dores não eram só qualidade do modelo. Equipes sofrem com confiança em créditos, fila, troca de ferramentas, gerações falhas e transformar clips em assets usáveis.", items: [{ title: "Créditos são difíceis de confiar", body: "Flatkey deixa o custo visível com um saldo, checks de credits, JSON e dry-run antes de gastar." }, { title: "Espera quebra a iteração", body: "Workflows CLI facilitam retries, salvamento de outputs e troca de modelos quando uma rota fica lenta ou inadequada." }, { title: "Geração é só uma etapa", body: "Equipes precisam de prompts, imagens, vídeos, voz, música, captions e pastas locais. Flatkey mantém tudo atrás de uma superfície de comando." }, { title: "Qualidade significa arquivos usáveis", body: "A métrica real não é um demo impressionante. É custo por clip usável, tentativas falhas e se o output vai para edição ou publicação." }] },
    migration: { title: "Comece com o workflow que você queria do Higgsfield CLI", body: "Se a promessa era criar mídia dentro de uma ferramenta IA, Flatkey segue essa direção com mais controles de produção: caminhos locais, JSON, dry runs, descoberta de modelos e um saldo compartilhado.", code: compareCode },
    cta: { title: "Torne a geração de mídia IA repetível", body: "Use Flatkey quando o trabalho é maior que um prompt: comparar modelos, gerar variações, salvar arquivos, ver custo e deixar agentes rodarem sem esconder a conta.", primaryCta: "Instalar Flatkey CLI", secondaryCta: "Criar API key" },
  },
  ru: {
    seo: { title: "Flatkey vs Higgsfield: CLI workflow для AI-видеокоманд", description: "Сравните Flatkey и Higgsfield для медиакоманд, которым нужны прозрачные кредиты, multi-model генерация, локальные файлы и повторяемые CLI workflow." },
    hero: { eyebrow: "Flatkey vs Higgsfield", title: "Когда AI-видео переходит от демо к производству, нужен CLI под вашим контролем", body: "Higgsfield силен в визуальных creator workflow и agent-based image/video. Flatkey создан для медиакоманд, которым нужны единый баланс, прозрачные расходы, multi-model routing, локальные файлы и повторяемые production runs.", primaryCta: "Попробовать Flatkey CLI", secondaryCta: "Сравнить workflow" },
    position: { title: "Разные инструменты для разных задач", body: "Используйте Higgsfield для polished creative suite, визуальных templates и creator-first workflow. Используйте Flatkey, когда нужно генерировать повторно, сравнивать модели, контролировать расходы и подключать media generation к скриптам или AI agents." },
    comparison: { title: "Где подходит каждый продукт", headers: ["Потребность", "Flatkey", "Higgsfield"], rows: [["CLI production", "Image, video, audio, text, credits, models, local outputs, JSON mode.", "Сильная image/video генерация через agents."], ["Spend control", "Один prepaid balance, credits command, request visibility, dry-run.", "Plans и credits зависят от account flow Higgsfield."], ["Multi-modal workflow", "Images, videos, voice, SFX, music, text в одном CLI.", "Сильный image/video creative workflow."], ["Best fit", "Media teams, agencies, operators, AI-agent production.", "Creators, которым нужны visual tools, templates и community workflow."], ["Workflow style", "Terminal, scripts, agents, repeatable folders.", "Creative suite, MCP, visual generation experience."]] },
    pains: { eyebrow: "Боли из исследования", title: "Собрано вокруг болей AI-видеокоманд", body: "В обсуждениях US Reddit и Brazil/Japan YouTube повторялись не только проблемы качества моделей. Команды жалуются на доверие к credits, queue time, переключение tools, failed generations и превращение коротких clips в usable assets.", items: [{ title: "Credits трудно доверять", body: "Flatkey показывает cost через один balance, credits checks, JSON output и dry-run до расхода credits." }, { title: "Ожидание ломает итерации", body: "CLI workflow проще автоматизирует retries, saved outputs и model switching, когда один путь медленный или неподходящий." }, { title: "Generation только один шаг", body: "Командам нужны prompts, images, videos, voiceover, music, captions и local asset folders. Flatkey держит это за одной command surface." }, { title: "Quality = usable files", body: "Реальная метрика не impressive demo, а cost per usable clip, failed attempts и готовность output к edit/publish." }] },
    migration: { title: "Начните с workflow, который вы ждали от Higgsfield CLI", body: "Если вас привлекла идея creating media inside an AI tool, Flatkey дает тот же вектор плюс production controls: local output paths, JSON mode, dry runs, model discovery и shared balance.", code: compareCode },
    cta: { title: "Сделайте AI media generation повторяемой", body: "Используйте Flatkey, когда задача больше одного prompt: compare models, generate variants, save files, inspect cost и let agents run workflow without hiding bill.", primaryCta: "Установить Flatkey CLI", secondaryCta: "Создать API key" },
  },
  ja: {
    seo: { title: "Flatkey vs Higgsfield：AI動画チーム向けCLI workflow", description: "透明なcredits、multi-model生成、ローカル出力、繰り返し可能なCLI workflowが必要なAIメディアチーム向けにFlatkeyとHiggsfieldを比較。" },
    hero: { eyebrow: "Flatkey vs Higgsfield", title: "AI動画がdemoからproductionへ進むなら、制御できるCLIを", body: "Higgsfieldはビジュアルなcreator workflowとagentによる画像/動画生成に強みがあります。Flatkeyは、1つの残高、透明なコスト、multi-model routing、ローカルファイル、繰り返し可能なproduction runが必要なメディアチーム向けです。", primaryCta: "Flatkey CLIを試す", secondaryCta: "workflowを比較" },
    position: { title: "仕事が違えば、使う道具も違う", body: "洗練されたcreative suite、visual template、creator-first workflowが必要ならHiggsfield。繰り返し生成、モデル比較、コスト制御、scriptやAI agentへの接続が必要ならFlatkeyです。" },
    comparison: { title: "それぞれの適性", headers: ["ニーズ", "Flatkey", "Higgsfield"], rows: [["CLI production", "画像、動画、音声、テキスト、credits、models、local outputs、JSON mode。", "agent向け画像/動画生成に強い。"], ["コスト制御", "1つのprepaid balance、credits command、request visibility、dry-run。", "planとcreditsはHiggsfield account flowに依存。"], ["マルチモーダルworkflow", "画像、動画、voice、SFX、music、textを1つのCLIで。", "画像/動画creative workflowに強い。"], ["最適な用途", "メディアチーム、agency、operator、AI-agent production。", "visual tools、templates、community workflowを求めるcreator。"], ["workflow style", "Terminal、scripts、agents、repeatable folders。", "Creative suite、MCP、visual generation experience。"]] },
    pains: { eyebrow: "調査で見えた痛点", title: "AI動画チームが話している痛点から設計", body: "US Redditとブラジル/日本のYouTube調査では、課題はモデル品質だけではありません。creditsへの不信、待ち時間、ツール切替、失敗生成、短いclipを使える素材にする苦労が繰り返し出ています。", items: [{ title: "Creditsを信じにくい", body: "Flatkeyは1つの残高、credits確認、JSON output、dry-runで、消費前にコストを見える化します。" }, { title: "待ち時間がiterationを壊す", body: "CLI workflowならretry、保存、model switchingを自動化しやすく、1つの経路が遅くても止まりにくい。" }, { title: "生成は1ステップにすぎない", body: "メディアチームにはprompt、画像、動画、voiceover、music、caption、local foldersが必要です。Flatkeyはそれを1つのcommand surfaceにまとめます。" }, { title: "品質とは使えるファイル", body: "本当の指標はdemoの見栄えではなく、usable clipあたりのコスト、失敗回数、編集や公開へ進めるかです。" }] },
    migration: { title: "Higgsfield CLIに期待したworkflowから始める", body: "AIツール内でmediaを作ることに惹かれたなら、Flatkeyも同じ方向です。さらにlocal output paths、JSON mode、dry runs、model discovery、shared Flatkey balanceを提供します。", code: compareCode },
    cta: { title: "AIメディア生成を繰り返し可能に", body: "1つのpromptを超える仕事にFlatkeyを。modelsを比較し、variantsを生成し、filesを保存し、costを確認し、agentにworkflowを走らせても請求を隠しません。", primaryCta: "Flatkey CLIをインストール", secondaryCta: "API keyを作成" },
  },
  vi: {
    seo: { title: "Flatkey vs Higgsfield: workflow CLI cho đội video AI", description: "So sánh Flatkey và Higgsfield cho đội media AI cần credits minh bạch, tạo nhiều model, output local và workflow CLI lặp lại được." },
    hero: { eyebrow: "Flatkey vs Higgsfield", title: "Khi video AI đi từ demo sang sản xuất, dùng CLI bạn kiểm soát được", body: "Higgsfield mạnh ở workflow sáng tạo trực quan và tạo ảnh/video qua agent. Flatkey được xây cho đội media cần một số dư, chi phí rõ, routing nhiều model, file local và production run lặp lại.", primaryCta: "Thử Flatkey CLI", secondaryCta: "So sánh workflow" },
    position: { title: "Công cụ khác nhau cho việc khác nhau", body: "Dùng Higgsfield khi cần creative suite bóng bẩy, template trực quan và workflow creator-first. Dùng Flatkey khi đội cần tạo lặp lại, so sánh model, kiểm soát chi phí và nối media generation vào script hoặc AI agent." },
    comparison: { title: "Mỗi sản phẩm hợp ở đâu", headers: ["Nhu cầu", "Flatkey", "Higgsfield"], rows: [["CLI production", "Ảnh, video, audio, text, credits, models, output local, JSON mode.", "Mạnh về tạo image/video qua agent."], ["Kiểm soát chi phí", "Một prepaid balance, lệnh credits, thấy request, dry-run.", "Plan và credits phụ thuộc account flow của Higgsfield."], ["Workflow đa modal", "Ảnh, video, voice, SFX, nhạc, text trong một CLI.", "Mạnh về workflow sáng tạo image/video."], ["Phù hợp nhất", "Đội media, agency, operator, AI-agent production.", "Creator cần visual tools, templates và community workflow."], ["Kiểu workflow", "Terminal, scripts, agents, folder lặp lại.", "Creative suite, MCP, trải nghiệm visual generation."]] },
    pains: { eyebrow: "Pain từ nghiên cứu", title: "Xây quanh những pain đội video AI đang nói", body: "Trong nghiên cứu Reddit US và YouTube Brazil/Nhật, pain không chỉ là chất lượng model. Đội gặp vấn đề với niềm tin credits, queue time, đổi tool, generation lỗi và biến clip ngắn thành asset dùng được.", items: [{ title: "Credits khó tin", body: "Flatkey làm cost rõ hơn bằng một balance, credits check, JSON output và dry-run trước khi tiêu credits." }, { title: "Chờ đợi phá iteration", body: "CLI workflow giúp tự động retry, lưu output và đổi model dễ hơn khi một route chậm hoặc không phù hợp." }, { title: "Generation chỉ là một bước", body: "Đội media cần prompts, ảnh, video, voiceover, nhạc, captions và folder local. Flatkey gom chúng sau một command surface." }, { title: "Quality nghĩa là file dùng được", body: "Metric thật không phải demo đẹp. Đó là cost trên clip dùng được, số lần fail và output có đi vào edit/publish được không." }] },
    migration: { title: "Bắt đầu từ workflow bạn đã muốn ở Higgsfield CLI", body: "Nếu điều hấp dẫn là tạo media trong AI tool, Flatkey đi cùng hướng đó nhưng thêm control sản xuất: local output paths, JSON mode, dry runs, model discovery và một Flatkey balance chung.", code: compareCode },
    cta: { title: "Biến AI media generation thành việc lặp lại được", body: "Dùng Flatkey khi job lớn hơn một prompt: so sánh model, tạo variants, lưu file, xem cost và để agent chạy workflow mà không giấu hóa đơn.", primaryCta: "Cài Flatkey CLI", secondaryCta: "Tạo API key" },
  },
  de: {
    seo: { title: "Flatkey vs Higgsfield: CLI-Workflows für KI-Videoteams", description: "Vergleiche Flatkey und Higgsfield für KI-Medienteams, die transparente Credits, Multi-Model-Generierung, lokale Outputs und wiederholbare CLI-Workflows brauchen." },
    hero: { eyebrow: "Flatkey vs Higgsfield", title: "Wenn KI-Video von Demos zu Produktion wird, nutze eine CLI unter deiner Kontrolle", body: "Higgsfield ist stark bei visuellen Creator-Workflows und agentbasierter Bild/Video-Erstellung. Flatkey ist für Medienteams gebaut, die ein Guthaben, transparente Kosten, Multi-Model-Routing, lokale Dateien und wiederholbare Produktionsläufe brauchen.", primaryCta: "Flatkey CLI testen", secondaryCta: "Workflows vergleichen" },
    position: { title: "Verschiedene Tools für verschiedene Jobs", body: "Nutze Higgsfield für eine polierte Creative Suite, visuelle Templates und Creator-first Workflows. Nutze Flatkey, wenn dein Team wiederholt generieren, Modelle vergleichen, Kosten kontrollieren und Media Generation mit Scripts oder AI Agents verbinden muss." },
    comparison: { title: "Wo jedes Produkt passt", headers: ["Bedarf", "Flatkey", "Higgsfield"], rows: [["CLI-Produktion", "Bild, Video, Audio, Text, Credits, Modelle, lokale Outputs, JSON mode.", "Starke agent-facing Bild/Video-Erstellung."], ["Kostenkontrolle", "Ein Prepaid-Guthaben, credits command, request visibility, dry-run.", "Creator-plan und credits hängen vom Higgsfield account flow ab."], ["Multimodaler Workflow", "Bilder, Videos, Voice, SFX, Musik, Text in einer CLI.", "Starker Bild/Video-Creative-Workflow."], ["Best fit", "Medienteams, Agenturen, Operators, AI-agent production.", "Creator, die Visual Tools, Templates und Community Workflows wollen."], ["Workflow-Stil", "Terminal, Scripts, Agents, wiederholbare Ordner.", "Creative Suite, MCP, Visual Generation Experience."]] },
    pains: { eyebrow: "Research-backed pains", title: "Gebaut um die Schmerzen, über die AI-Videoteams sprechen", body: "In US Reddit und Brazil/Japan YouTube Research waren die Schmerzen nicht nur Modellqualität. Teams kämpfen mit Credit-Vertrauen, Warteschlangen, Tool-Wechsel, fehlgeschlagenen Generierungen und der Frage, wie kurze Clips zu nutzbaren Assets werden.", items: [{ title: "Credits sind schwer zu vertrauen", body: "Flatkey macht Kosten sichtbar über ein Guthaben, credits checks, JSON output und dry-run, bevor ein Job Credits ausgibt." }, { title: "Warten bricht Iteration", body: "CLI-Workflows machen retries, gespeicherte Outputs und Modellwechsel leichter zu automatisieren, wenn eine Route langsam oder ungeeignet ist." }, { title: "Generierung ist nur ein Schritt", body: "Medienteams brauchen Prompts, Bilder, Videos, Voiceover, Musik, Captions und lokale Asset-Ordner. Flatkey hält das hinter einer Command Surface." }, { title: "Qualität bedeutet nutzbare Dateien", body: "Die echte Metrik ist nicht eine beeindruckende Demo, sondern Kosten pro usable clip, failed attempts und ob Output in Editing oder Publishing gehen kann." }] },
    migration: { title: "Starte mit dem Workflow, den du von Higgsfield CLI erwartet hast", body: "Wenn dich creating media inside an AI tool angezogen hat, gibt Flatkey dieselbe Richtung plus mehr Produktionskontrolle: lokale Output-Pfade, JSON mode, dry runs, model discovery und ein gemeinsames Flatkey-Guthaben.", code: compareCode },
    cta: { title: "Mache KI-Mediengenerierung wiederholbar", body: "Nutze Flatkey, wenn der Job größer ist als ein Prompt: Modelle vergleichen, Varianten erzeugen, Dateien speichern, Kosten prüfen und Agents den Workflow ausführen lassen, ohne die Rechnung zu verstecken.", primaryCta: "Flatkey CLI installieren", secondaryCta: "API key erstellen" },
  },
});
