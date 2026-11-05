/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { fillHwText, useHwLanguage, type HwTextVars } from './texts'

/**
 * Texts of the `/vibe-kodlama` page and of its teaser on the landing page.
 * They live in their own dictionary (Turkish first, English next to it) so the
 * long page does not bloat the shared `texts.ts`. Plain words for beginners:
 * no em-dash, no emoji, no jargon without a short explanation.
 */
const tr = {
  title:
    'Vibe coding için akıllı düzen: düşünmeyi abonelik yapar, işi HisarWeb AI yapar',
  lead: 'Yapay zekayla konuşarak uygulama ya da site yapıyorsanız bu sayfa sizin için. Aboneliğinizi bitirmeden haftayı çıkarmanın basit bir yolunu anlatıyoruz.',

  forWhoTitle: 'Bu sayfa kimin için?',
  forWhoBody:
    'Kod yazmayı bilmeden ya da yeni öğrenirken yapay zekayla uygulama, site ya da otomasyon geliştiriyorsunuz. Buna vibe coding denir. Bir Claude ya da ChatGPT aboneliğiniz var, ancak 5 saatlik oturum limitiniz doluyor ya da haftalık kullanım hakkınız haftanın ortasında bitiyor ve yenilenmesini beklemek zorunda kalıyorsunuz.',

  ruleTitle: 'Kural tek cümle',
  ruleSentence: 'Düşünmeyi abonelik yapar, işi HisarWeb AI yapar.',
  ruleBody:
    'İşi iki katmana bölün. Abonelikli Claude Code’u (ya da ChatGPT aboneliğinizdeki Codex’i) yalnızca yüksek düşünme gücü gerektiren görevlerde kullanın. Diğer tüm işler için HisarWeb AI anahtarınızı kullanın. Böylece aboneliğinizin kullanım kotası korunur, gereksiz tüketim önlenir ve 5 saatlik oturum limitiniz ya da haftalık kullanım hakkınız dolduğunda da işinize devam edebilirsiniz.',
  expertTitle: 'Uzman katman: aboneliğiniz',
  expertBody: 'Aboneliğinizi şu işler için saklayın:',
  expertItem1: 'Proje planı ve mimari (neyi nasıl kuracağınız)',
  expertItem2: 'Kodu daha iyi ve daha hızlı hale getirmek',
  expertItem3: 'Yapılan işin gözden geçirilmesi (inceleme)',
  expertItem4: 'Zor hata ya da karmaşık analiz',
  workTitle: 'Çalışma katmanı: HisarWeb AI anahtarı',
  workBody: 'HisarWeb AI anahtarınız şu işleri yapar:',
  workItem1: 'Kod, test ve belge yazmak',
  workItem2: 'Tekrar eden ve toplu işler',
  workItem3: 'Gün boyu çalışan ajanlar ve iş akışları',
  workItem4: 'Otomasyonlar (n8n, Make gibi)',
  diagramLabel:
    'Şema: göreviniz iki katmana ayrılır. Plan, mimari, inceleme ve zor hata aboneliğinize gider. Kod, test, tekrar eden iş ve ajanlar HisarWeb AI anahtarınıza gider.',
  diagramTask: 'Göreviniz',
  diagramExpert: 'Aboneliğiniz',
  diagramExpert1: 'Plan',
  diagramExpert2: 'Mimari',
  diagramExpert3: 'İnceleme',
  diagramExpert4: 'Zor hata',
  diagramWork: 'HisarWeb AI anahtarı',
  diagramWork1: 'Kod',
  diagramWork2: 'Test',
  diagramWork3: 'Tekrar eden iş',
  diagramWork4: 'Ajanlar',
  priceTitle: 'Abonelik fiyatları',
  priceBody:
    'Claude ve ChatGPT abonelik ücretleri bölgeye, vergi uygulamalarına ve para birimine göre değişebilir. En güncel fiyat bilgilerini resmî fiyatlandırma sayfalarından kontrol edebilirsiniz:',
  priceLinkClaude: 'Claude: claude.com/pricing',
  priceLinkChatgpt: 'ChatGPT: chatgpt.com/pricing',

  oneKeyTitle: 'Tek anahtar, bütün modeller',
  oneKeyBody:
    'Her istekte hangi modeli istediğinizi adıyla yazarsınız. Yeni anahtar almadan başka bir modele geçebilirsiniz. Örneğin zor iş için claude-opus-5-5, günlük iş için claude-sonnet-5-5, küçük ve çok sayıda iş için claude-haiku-5-5. Kullanılabilir modeller listesi için /docs sayfasına bakın.',
  oneKeyCaption: 'Aynı anahtar, iki istek, iki model:',
  warnTitle: 'Önemli: oturumun ortasında model değiştirmeyin',
  warnBody:
    'Bir sohbet ya da oturum sürerken modeli değiştirirseniz yeni model bütün konuşmayı baştan okumak zorunda kalır ve önbellekten (cache) yararlanamaz. Bu da hem yavaş hem pahalıdır. Her rol için sabit bir model seçin. Başka bir model gerekiyorsa yeni bir oturum açın.',

  cacheTitle: 'Önbellek ve token tasarrufu',
  cacheBody:
    'Yapay zeka her istekte konuşmanın başından beri yazılanları yeniden okur. Konuşma uzadıkça maliyet artar. Şu alışkanlıklar maliyeti düşürür:',
  cacheTip1:
    'Sabit kuralları (proje açıklaması, stil, yasaklar) isteğin en başına koyun ve sık değiştirmeyin. Başlangıç aynı kalırsa sağlayıcı önbelleği kullanabilir.',
  cacheTip2: 'Bir oturumda tek iş yapın.',
  cacheTip3:
    'İşler arasında yeni oturum açın (Claude Code ve benzerlerinde /clear).',
  cacheTip4:
    'Konuşmayı sıkıştırmayı (compact) sadece iş bitince, bir kırılma noktasında yapın.',
  cacheTip5: 'Görevleri kısa tutun: bir görev, bir sonuç.',
  cacheNote:
    'Önbellekleme (prompt caching) model sağlayıcısı tarafından uygulanır. Gerçek indirim oranı sağlayıcıya ve modele göre değişir; bu nedenle sabit bir oran belirtmiyoruz.',

  toolsTitle: 'Araç Ayarları',
  toolsBody:
    'Aşağıdaki araçlar kendi API adresinizi ve anahtarınızı kullanacak şekilde yapılandırılabilir. HisarWeb AI rehberlerinde yer alan kurulumlar gerçek API anahtarlarıyla test edilmiştir.',
  toolsBody2:
    'Adım adım kurulum talimatları için /docs sayfasındaki rehberlere bakın. Bu bölüm yalnızca araçların rol dağılımını ve kullanım şeklini açıklamaktadır.',
  toolsDocsLink: 'Adım adım kurulum rehberleri',
  toolClaudeName: 'Claude Code',
  toolClaudeBody:
    'Abonelikle giriş yaptığınız pencerede planlayın. İşi yapacak ikinci bir terminal penceresinde aşağıdaki ayarı kullanın. Böylece planlama aboneliği, çalışma anahtarı kullanır ve ikisi karışmaz. Alt ajanlar (subagent) daha ucuz modelle çalışır.',
  toolClaudeShellBash: 'macOS ve Linux',
  toolClaudeShellPowershell: 'Windows (PowerShell)',
  toolClineName: 'Cline',
  toolClineBody:
    'Plan modunda güçlü model (claude-opus-5-5), Act modunda orta model (claude-sonnet-5-5) seçin. Ayarlar: sağlayıcı olarak OpenAI uyumlu, adres ve anahtar sizin.',
  toolKiloName: 'Kilo Code',
  toolKiloBody:
    'Planlama modunda güçlü model, kodlama modunda claude-sonnet-5-5 ya da claude-haiku-5-5 seçin. Roo Code 15 Mayıs 2026’da kapandı, onun yerine Kilo Code ya da Cline kullanın.',
  toolOpencodeName: 'opencode',
  toolOpencodeBody:
    'Ana modeli claude-sonnet-5-5, küçük işler için olan modeli claude-haiku-5-5 yapın. Planlama için güçlü modeli ayrı bir ajan olarak tanımlayın.',
  toolAiderName: 'Aider',
  toolAiderBody:
    'Aider iki modelli çalışabilir: biri düşünür (architect), diğeri yazar (editor). Aider kendi anahtarınızla çalışır, bu yüzden iki model de HisarWeb AI anahtarınızdan gelir.',
  toolCursorName: 'Cursor',
  toolCursorBody:
    'Cursor’da kendi anahtarınızı kullanmak ücretli bir Cursor planı ister (rehberde böyle belirtilmiştir). Ücretsiz planda çalışmaz.',
  toolRouteNote:
    'Bütün araçlarda kural aynı: her rol için sabit bir model seçin, oturumun ortasında değiştirmeyin.',

  aiHelpTitle: 'Kod bilmiyor musunuz? Kurulumu yapay zekaya yaptırın',
  aiHelpBody:
    'Ayarları kendiniz yapmanız gerekmez. /docs sayfasında Claude Code ve Codex için hazır bir prompt var: anahtarınızı ekleyip aracınıza yapıştırırsınız, kurulumu araç kendisi yapar. Hangi modeli seçeceğinizi ve izin ayarını da orada adım adım anlatıyoruz.',
  aiHelpLink: 'Kurulumu yapay zekaya yaptırma rehberi',

  promptTitle: 'Yönlendirme promptu',
  promptBody:
    'Aşağıdaki metni projenizin CLAUDE.md ya da AGENTS.md dosyasının en başına yapıştırın. Yapay zekaya işi nasıl bölüştüreceğini söyler ve önbellek için sabit kuralları başta tutar.',
  promptText: `# Çalışma düzeni (sabit kurallar, bu bölümü değiştirmeyin)

Rol dağılımı:
- Planlama, mimari, inceleme ve zor hata analizi güçlü modelle yapılır.
- Kod yazma, test, tekrar eden iş ve toplu iş alt ajanlara verilir. Alt ajanlar HisarWeb AI anahtarıyla daha ucuz bir modelle çalışır.
- Bir oturumun ortasında model değiştirme. Başka model gerekiyorsa yeni oturum aç ve önce planı oku.

Çalışma kuralları:
1. Önce kısa bir plan yaz (PLAN.md), sonra işi küçük görevlere böl.
2. Her görev kısa olsun: bir görev, bir sonuç.
3. İşler arasında yeni oturum aç, aynı oturumda ilgisiz işlere geçme.
4. Her iş bitince güçlü model sonucu kontrol eder: testler geçiyor mu, plana uyuyor mu.
5. Emin olmadığın şeyi uydurma, açıkça söyle.`,

  fitTitle: 'HisarWeb AI hangi durumlarda avantaj sağlar?',
  fitIntro:
    'HisarWeb AI; yapay zeka uygulamaları, otomasyonlar ve dijital ürünler geliştiren kişi ve ekipler için tasarlanmıştır. API maliyetlerini optimize etmek, farklı modelleri tek noktadan kullanmak ve mevcut iş akışlarını yapay zeka ile güçlendirmek isteyenler için uygundur.',
  fitUsesTitle: 'Örnek kullanım alanları',
  fitUse1: 'Web siteleri ve açılış sayfaları',
  fitUse2: 'SaaS ürünleri ve MVP geliştirme',
  fitUse3: 'OpenClaw ve benzeri AI çalışma alanları',
  fitUse4: 'Çok ajanlı (multi-agent) sistemler',
  fitUse5: 'Kurumsal AI platformları',
  fitUse6: 'AI destekli operasyon merkezleri',
  fitUse7: 'AI sohbet botları ve sanal asistanlar',
  fitUse8: 'WhatsApp ve Telegram botları',
  fitUse9: 'n8n ve Make otomasyonları',
  fitUse10: 'Otonom AI ajanları',
  fitUse11: 'İçerik üretimi ve belge işleme',
  fitUse12: 'Toplu metin, veri ve dosya işleme süreçleri',
  fitUse13: 'API tabanlı AI entegrasyonları',
  fitPlatformsTitle: 'Uyumlu Platformlar',
  fitPlatforms:
    'HisarWeb AI; n8n, Make, Dify, Flowise, Open WebUI, LibreChat ve OpenAI uyumlu API desteği sunan diğer platformlarla kullanılabilir.',
  fitPlatforms2:
    'Kullandığınız aracın özel API adresi (Custom API Base URL) ya da harici sağlayıcı desteği sunması yeterlidir. Böylece mevcut iş akışlarınızı değiştirmeden HisarWeb AI altyapısını mevcut sistemlerinize bağlayabilirsiniz.',
  fitPlatforms3:
    'Örneğin OpenClaw gibi özel API adresi kabul eden AI çalışma alanları, ajan sistemleri ve şirket içi AI çözümleri, HisarWeb AI altyapısı üzerinden birden fazla modeli tek noktadan kullanabilir.',
  fitDocs:
    'Kurulum ve entegrasyon adımları için /docs sayfasındaki rehberleri inceleyebilirsiniz.',
  fitNoTitle: 'Gerek olmayabilir',
  fitNo1:
    'Yapay zekayı sadece ara sıra, abonelik kotanızın içinde sohbet için kullanıyorsanız ayrı bir anahtara ihtiyacınız yok.',
  fitNo2:
    'Aracınız kendi anahtarınızı kabul etmiyorsa kullanamazsınız. Lovable, Bolt.new, v0 ve Replit Agent kendi kredileriyle çalışır. Bunları ölçmedik, kendi aracınızın ayarlarına bakın.',

  filmTitle: 'Kısa film: aboneliğiniz düşünsün, HisarWeb AI işi yapsın',
  filmBody:
    'Yeni başlayanlar için kısa bir film. Sayfanın diline göre Türkçe ya da İngilizce seslendirilir, ekrandaki yazılar da aynı dildedir; görseller yapay zekâ ile üretilmiştir.',
  filmLabel: 'HisarWeb AI vibe kodlama tanıtım filmi',

  ctaTitle: 'Önce ücretsiz deneyin',
  ctaBody:
    'Hesap açın, deneme bakiyesiyle yukarıdaki düzeni küçük bir işte deneyin.',
  ctaButton: 'Ücretsiz hesap aç',
  ctaDocs: 'Kurulum rehberleri',

  landingTitle: 'Yeni başlayanlar için vibe coding düzeni',
  landingBody:
    'Aboneliğiniz haftanın ortasında mı bitiyor? Düşünme işini aboneliğe, yazma ve tekrar işlerini HisarWeb AI anahtarına verin. Resmî fiyatın yarısına çalışır, abonelik haftanın sonuna kadar yeter.',
  landingButton: 'Vibe coding rehberini oku',
}

const en: Record<keyof typeof tr, string> = {
  title:
    'A smart setup for vibe coding: the subscription thinks, HisarWeb AI does the work',
  lead: 'If you build apps or sites by talking to an AI, this page is for you. It explains a simple way to make your subscription last the whole week.',

  forWhoTitle: 'Who is this page for?',
  forWhoBody:
    'You build apps, sites or automations with AI without knowing how to code, or while you are still learning. This is called vibe coding. You have a Claude or ChatGPT subscription, but your 5-hour session limit fills up or your weekly usage runs out halfway through the week, and you have to wait for it to renew.',

  ruleTitle: 'The rule in one sentence',
  ruleSentence: 'The subscription thinks, HisarWeb AI does the work.',
  ruleBody:
    'Split the work into two layers. Use Claude Code on your subscription (or Codex in your ChatGPT subscription) only for tasks that need a lot of thinking power. Use your HisarWeb AI key for all other work. That way the usage quota of your subscription is protected, needless use is avoided, and you can keep working when your 5-hour session limit or your weekly usage runs out.',
  expertTitle: 'Expert layer: your subscription',
  expertBody: 'Keep your subscription for these jobs:',
  expertItem1: 'The project plan and architecture (what you build and how)',
  expertItem2: 'Making the code better and faster',
  expertItem3: 'Reviewing the work that was done',
  expertItem4: 'A hard bug or a complex analysis',
  workTitle: 'Work layer: the HisarWeb AI key',
  workBody: 'Your HisarWeb AI key does these jobs:',
  workItem1: 'Writing code, tests and documents',
  workItem2: 'Repeat and batch work',
  workItem3: 'Agents and workflows that run all day',
  workItem4: 'Automations (such as n8n or Make)',
  diagramLabel:
    'Diagram: your task is split into two layers. Planning, architecture, review and hard bugs go to your subscription. Code, tests, repeat work and agents go to your HisarWeb AI key.',
  diagramTask: 'Your task',
  diagramExpert: 'Your subscription',
  diagramExpert1: 'Plan',
  diagramExpert2: 'Architecture',
  diagramExpert3: 'Review',
  diagramExpert4: 'Hard bug',
  diagramWork: 'HisarWeb AI key',
  diagramWork1: 'Code',
  diagramWork2: 'Tests',
  diagramWork3: 'Repeat work',
  diagramWork4: 'Agents',
  priceTitle: 'Subscription prices',
  priceBody:
    'Claude and ChatGPT subscription prices can vary by region, tax rules and currency. Check the official pricing pages for the most current prices:',
  priceLinkClaude: 'Claude: claude.com/pricing',
  priceLinkChatgpt: 'ChatGPT: chatgpt.com/pricing',

  oneKeyTitle: 'One key, every model',
  oneKeyBody:
    'In every request you write the model you want by name. You can move to another model without a new key. For example claude-opus-5-5 for hard work, claude-sonnet-5-5 for everyday work, claude-haiku-5-5 for small jobs in large numbers. The /docs page lists the models you can use.',
  oneKeyCaption: 'The same key, two requests, two models:',
  warnTitle: 'Important: do not switch model in the middle of a session',
  warnBody:
    'If you change the model while a chat or session is running, the new model has to read the whole conversation again and cannot use the cache. That is both slower and more expensive. Choose one fixed model per role. If you need another model, start a new session.',

  cacheTitle: 'Cache and saving tokens',
  cacheBody:
    'On every request the AI reads everything written so far again. The longer the conversation, the higher the cost. These habits lower it:',
  cacheTip1:
    'Put your fixed rules (project description, style, do-nots) at the very start of the request and do not change them often. If the start stays the same, the provider can use its cache.',
  cacheTip2: 'Do one job per session.',
  cacheTip3:
    'Start a new session between jobs (/clear in Claude Code and similar tools).',
  cacheTip4:
    'Compact the conversation only when a job is done, at a breakpoint.',
  cacheTip5: 'Keep tasks short: one task, one result.',
  cacheNote:
    'Prompt caching is applied by the model provider. The actual discount depends on the provider and the model, so we do not state a fixed rate.',

  toolsTitle: 'Tool settings',
  toolsBody:
    'The tools below can be configured to use your own API address and key. The setups in the HisarWeb AI guides have been tested with real API keys.',
  toolsBody2:
    'For step-by-step setup instructions, see the guides on the /docs page. This section only explains how the roles are split between the tools and how to use them.',
  toolsDocsLink: 'Step-by-step setup guides',
  toolClaudeName: 'Claude Code',
  toolClaudeBody:
    'Plan in the window where you are signed in with your subscription. In a second terminal window that does the work, use the setting below. That way planning uses the subscription, work uses the key, and the two do not mix. Subagents run on the cheaper model.',
  toolClaudeShellBash: 'macOS and Linux',
  toolClaudeShellPowershell: 'Windows (PowerShell)',
  toolClineName: 'Cline',
  toolClineBody:
    'Pick the strong model (claude-opus-5-5) in Plan mode and the middle model (claude-sonnet-5-5) in Act mode. Settings: OpenAI compatible provider, your own address and key.',
  toolKiloName: 'Kilo Code',
  toolKiloBody:
    'Pick the strong model for the planning mode and claude-sonnet-5-5 or claude-haiku-5-5 for the coding mode. Roo Code shut down on 15 May 2026, use Kilo Code or Cline instead.',
  toolOpencodeName: 'opencode',
  toolOpencodeBody:
    'Make claude-sonnet-5-5 the main model and claude-haiku-5-5 the model for small jobs. Define the strong model as a separate agent for planning.',
  toolAiderName: 'Aider',
  toolAiderBody:
    'Aider can work with two models: one thinks (architect), the other writes (editor). Aider works with your own key, so both models come from your HisarWeb AI key.',
  toolCursorName: 'Cursor',
  toolCursorBody:
    'Using your own key in Cursor needs a paid Cursor plan (as the guide states). It does not work on the free plan.',
  toolRouteNote:
    'The rule is the same in every tool: pick one fixed model per role and do not change it in the middle of a session.',

  aiHelpTitle: 'Do not know how to code? Let the AI do the setup',
  aiHelpBody:
    'You do not have to change the settings yourself. The /docs page has a ready prompt for Claude Code and Codex: you add your key, paste it into your tool and the tool does the setup itself. It also explains step by step which model to pick and which permission setting to use.',
  aiHelpLink: 'Guide: let the AI do the setup',

  promptTitle: 'Routing prompt',
  promptBody:
    'Paste the text below at the very top of your project’s CLAUDE.md or AGENTS.md file. It tells the AI how to split the work and keeps the fixed rules at the start for the cache.',
  promptText: `# Working setup (fixed rules, do not change this section)

Roles:
- Planning, architecture, review and hard bug analysis are done by the strong model.
- Writing code, tests, repeat work and batch work go to subagents. Subagents run on a cheaper model through the HisarWeb AI key.
- Never switch model in the middle of a session. If another model is needed, open a new session and read the plan first.

Working rules:
1. Write a short plan first (PLAN.md), then split the work into small tasks.
2. Keep every task short: one task, one result.
3. Open a new session between jobs, do not jump to unrelated jobs in the same session.
4. When each job is done, the strong model checks the result: do the tests pass, does it follow the plan.
5. Do not make up what you are unsure about, say so openly.`,

  fitTitle: 'When does HisarWeb AI give you an advantage?',
  fitIntro:
    'HisarWeb AI is designed for people and teams who build AI applications, automations and digital products. It suits anyone who wants to optimise API costs, use different models from one place and strengthen existing workflows with AI.',
  fitUsesTitle: 'Example use cases',
  fitUse1: 'Websites and landing pages',
  fitUse2: 'SaaS products and MVP development',
  fitUse3: 'OpenClaw and similar AI workspaces',
  fitUse4: 'Multi-agent systems',
  fitUse5: 'Enterprise AI platforms',
  fitUse6: 'AI-assisted operations centres',
  fitUse7: 'AI chatbots and virtual assistants',
  fitUse8: 'WhatsApp and Telegram bots',
  fitUse9: 'n8n and Make automations',
  fitUse10: 'Autonomous AI agents',
  fitUse11: 'Content creation and document processing',
  fitUse12: 'Batch processing of text, data and files',
  fitUse13: 'API-based AI integrations',
  fitPlatformsTitle: 'Compatible platforms',
  fitPlatforms:
    'HisarWeb AI works with n8n, Make, Dify, Flowise, Open WebUI, LibreChat and other platforms that support an OpenAI compatible API.',
  fitPlatforms2:
    'It is enough that your tool offers a custom API address (Custom API Base URL) or support for an external provider. That way you connect the HisarWeb AI infrastructure to your existing systems without changing your workflows.',
  fitPlatforms3:
    'For example, AI workspaces that accept a custom API address such as OpenClaw, agent systems and in-house AI solutions can use several models from one place through the HisarWeb AI infrastructure.',
  fitDocs:
    'See the guides on the /docs page for the setup and integration steps.',
  fitNoTitle: 'You may not need it',
  fitNo1:
    'If you only chat with the AI now and then, inside your subscription quota, you do not need a separate key.',
  fitNo2:
    'If your tool does not accept your own key, you cannot use it. Lovable, Bolt.new, v0 and Replit Agent work on their own credit. We did not measure them, check the settings of your own tool.',

  filmTitle:
    'Short film: let your subscription think, let HisarWeb AI do the work',
  filmBody:
    'A short film for new vibecoders. Voice and on-screen text follow the page language (Turkish or English); the images are AI-generated.',
  filmLabel: 'HisarWeb AI film for new vibecoders',

  ctaTitle: 'Try it for free first',
  ctaBody:
    'Open an account and try the setup above on a small job with the trial balance.',
  ctaButton: 'Open a free account',
  ctaDocs: 'Setup guides',

  landingTitle: 'A vibe coding setup for beginners',
  landingBody:
    'Does your subscription run out halfway through the week? Give the thinking to the subscription, and the writing and repeat work to your HisarWeb AI key. It runs at half the official price, so the subscription lasts the whole week.',
  landingButton: 'Read the vibe coding guide',
}

export type VibeTextKey = keyof typeof tr

export const vibeTexts = { tr, en } as const

export type VibeFilmFiles = { src: string; poster: string }

/**
 * One film per page language, each with its own voice and on-screen text, so
 * there is no subtitle track on top of the words already in the picture. The
 * poster is the frame shown before play. The file names carry a version
 * because browsers cache the mp4 for a week. The landing page and
 * `/vibe-kodlama` share these files.
 */
export const VIBE_FILMS: Record<'tr' | 'en', VibeFilmFiles> = {
  tr: {
    src: '/film/hisarweb-ai-vibe-kodlama-v3.mp4',
    poster: '/film/hisarweb-ai-vibe-kodlama-v3.jpg',
  },
  en: {
    src: '/film/hisarweb-ai-vibe-kodlama-en-v3.mp4',
    poster: '/film/hisarweb-ai-vibe-kodlama-en-v3.jpg',
  },
}

/** Returns the vibe coding text of the active interface language. */
export function useVibeText(): (key: VibeTextKey, vars?: HwTextVars) => string {
  const language = useHwLanguage()
  return (key, vars) => fillHwText(vibeTexts[language][key], vars)
}
