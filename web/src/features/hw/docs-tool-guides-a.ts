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
/** Guides: Claude Code, OpenAI Codex, OpenCode, Zed. */
import {
  ANTHROPIC_BASE_URL,
  block,
  KEY_ENV_NAME,
  KEY_PLACEHOLDER,
  LISTED_MODELS,
  MODEL_CODEX,
  MODEL_DEFAULT,
  MODEL_HAIKU,
  MODEL_OPUS,
  OPENAI_BASE_URL,
  type GuideShot,
  type GuideStep,
  type ToolGuide,
} from './docs-tool-guides-base'
import { KEY_ENV_STEPS, OPEN_TERMINAL_STEPS } from './docs-tool-guides-shared'

/** One of our own screenshots for the Claude Code guide (webp, cropped to the readable part). */
function shot(
  name: string,
  height: number,
  tr: string,
  en: string,
  width = 1100
): GuideShot {
  return {
    src: `/rehber/gids/claude-code/${name}.webp`,
    alt: { tr, en },
    width,
    height,
  }
}

export const CLAUDE_SETTINGS = `{
  "env": {
    "ANTHROPIC_BASE_URL": "${ANTHROPIC_BASE_URL}",
    "ANTHROPIC_AUTH_TOKEN": "${KEY_PLACEHOLDER}",
    "ANTHROPIC_MODEL": "${MODEL_DEFAULT}",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "${MODEL_DEFAULT}",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "${MODEL_OPUS}",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "${MODEL_HAIKU}"
  }
}`

/** The same settings for the VS Code extension, which keeps them in VS Code. */
const CLAUDE_VSCODE_SETTINGS = `{
  "claudeCode.disableLoginPrompt": true,
  "claudeCode.environmentVariables": [
    { "name": "ANTHROPIC_BASE_URL", "value": "${ANTHROPIC_BASE_URL}" },
    { "name": "ANTHROPIC_AUTH_TOKEN", "value": "${KEY_PLACEHOLDER}" },
    { "name": "ANTHROPIC_MODEL", "value": "${MODEL_DEFAULT}" },
    { "name": "ANTHROPIC_DEFAULT_SONNET_MODEL", "value": "${MODEL_DEFAULT}" },
    { "name": "ANTHROPIC_DEFAULT_OPUS_MODEL", "value": "${MODEL_OPUS}" },
    { "name": "ANTHROPIC_DEFAULT_HAIKU_MODEL", "value": "${MODEL_HAIKU}" }
  ]
}`

const CLAUDE_INSTALL_STEPS: readonly GuideStep[] = [
  {
    only: ['windows'],
    text: {
      tr: 'Claude Code’u kurmak için bu komutu PowerShell’e yapıştırıp Enter’a basın.',
      en: 'To install Claude Code, paste this command into PowerShell and press Enter.',
    },
    blocks: [
      block('command', 'powershell', 'irm https://claude.ai/install.ps1 | iex'),
    ],
    see: {
      tr: 'Komut bitince PowerShell yeniden komut beklemeye başlar.',
      en: 'When the command finishes, PowerShell waits for a new command.',
    },
  },
  {
    only: ['macos', 'linux'],
    text: {
      tr: 'Claude Code’u kurmak için bu komutu terminale yapıştırıp Enter’a basın.',
      en: 'To install Claude Code, paste this command into the terminal and press Enter.',
    },
    blocks: [
      block(
        'command',
        'bash',
        'curl -fsSL https://claude.ai/install.sh | bash'
      ),
    ],
    see: {
      tr: 'Komut bitince terminal yeniden komut beklemeye başlar.',
      en: 'When the command finishes, the terminal waits for a new command.',
    },
  },
  {
    text: {
      tr: 'Terminal penceresini kapatıp yeni bir tane açın, sonra kurulumu kontrol edin.',
      en: 'Close the terminal window, open a new one and check the installation.',
    },
    blocks: [block('command', 'bash', 'claude --version')],
    shots: [
      shot(
        'win-versie',
        170,
        'Windows PowerShell’de claude --version komutu ve altında sürüm numarası.',
        'claude --version in Windows PowerShell with the version number below it.',
        666
      ),
    ],
    see: {
      tr: 'Bir sürüm numarası görünür, örneğin 2.1.x. “Tanınmıyor” gibi bir hata görürseniz pencereyi kapatıp yeniden açın.',
      en: 'A version number appears, for example 2.1.x. If you see a “not recognized” style error, close the window and open it again.',
    },
  },
]

const claudeCode: ToolGuide = {
  id: 'claude-code',
  name: 'Claude Code',
  status: 'works',
  protocol: 'anthropic',
  testedWith: {
    tr: 'Claude Code 2.1.283 ile 23 Ekim 2026’da gerçek bir anahtarla denendi',
    en: 'Tried with Claude Code 2.1.283 and a real key on 23 Oct 2026',
  },
  summary: {
    tr: 'Claude Code, Anthropic’in kodlama yardımcısıdır. Anthropic hesabına ya da aboneliğine gerek yoktur: HisarWeb AI anahtarınız yeterlidir.',
    en: 'Claude Code is Anthropic’s coding assistant. You do not need an Anthropic account or subscription: your HisarWeb AI key is enough.',
  },
  notice: {
    tr: 'Claude Code yalnızca Claude modelleriyle çalışır. Temel adres sonunda /v1 olmadan yazılır.',
    en: 'Claude Code only works with Claude models. The base URL is written without /v1 at the end.',
  },
  variants: [
    {
      id: 'cli',
      label: { tr: 'Komut satırı (CLI)', en: 'Command line (CLI)' },
      steps: [
        ...OPEN_TERMINAL_STEPS,
        ...CLAUDE_INSTALL_STEPS,
        {
          only: ['windows'],
          text: {
            tr: 'Ayar dosyasını açın. Bu iki komut, klasör yoksa oluşturur ve dosyayı Not Defteri’nde açar. Dosya şu yerdedir: %USERPROFILE%\\.claude\\settings.json',
            en: 'Open the settings file. These two commands create the folder if it is missing and open the file in Notepad. The file lives at: %USERPROFILE%\\.claude\\settings.json',
          },
          blocks: [
            block(
              'command',
              'powershell',
              String.raw`New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude" | Out-Null
notepad "$env:USERPROFILE\.claude\settings.json"`
            ),
          ],
          see: {
            tr: 'Not Defteri “dosya bulunamadı, yeni dosya oluşturulsun mu?” diye sorabilir; Evet’e basın.',
            en: 'Notepad may ask whether to create a new file because it was not found; press Yes.',
          },
        },
        {
          only: ['macos', 'linux'],
          text: {
            tr: 'Ayar dosyasını açın. Bu iki komut, klasör yoksa oluşturur ve dosyayı nano adlı basit düzenleyicide açar. Dosya şu yerdedir: ~/.claude/settings.json',
            en: 'Open the settings file. These two commands create the folder if it is missing and open the file in a simple editor called nano. The file lives at: ~/.claude/settings.json',
          },
          blocks: [
            block(
              'command',
              'bash',
              'mkdir -p ~/.claude\nnano ~/.claude/settings.json'
            ),
          ],
          see: {
            tr: 'Boş bir düzenleyici ekranı. Kaydetmek için Ctrl + O ve Enter, çıkmak için Ctrl + X tuşlarına basacaksınız.',
            en: 'An empty editor screen. To save you will press Ctrl + O and Enter, to leave Ctrl + X.',
          },
        },
        {
          text: {
            tr: 'Aşağıdaki metni dosyaya yapıştırın, BURAYA_ANAHTARINIZ yerine 3. adımda kopyaladığınız anahtarı yazın ve dosyayı kaydedin.',
            en: 'Paste the text below into the file, replace BURAYA_ANAHTARINIZ with the key you copied in step 3, and save the file.',
          },
          blocks: [block('config', 'json', CLAUDE_SETTINGS)],
          shots: [
            shot(
              'win-instellingen',
              230,
              'Not Defteri’nde bitmiş settings.json; anahtar yıldızlarla gizlenmiştir.',
              'The finished settings.json in Notepad; the key is hidden with stars.',
              490
            ),
          ],
          note: {
            tr: 'Adres https://api.hisarweb.be olmalı, sonuna /v1 eklemeyin; Claude Code gerisini kendisi ekler. Ücretsiz deneme anahtarı yalnızca haiku sınıfı modelleri çalıştırır: o durumda model satırlarının hepsine claude-haiku-5-5 yazın. Dosyada zaten başka ayarlar varsa yalnızca "env" bölümünü ekleyin.',
            en: 'The address must be https://api.hisarweb.be without /v1 at the end; Claude Code adds the rest. A free trial key only runs haiku-class models: in that case write claude-haiku-5-5 on every model line. If the file already has other settings, add only the "env" part.',
          },
        },
        {
          text: {
            tr: 'Bir proje klasöründe terminali açıp claude yazın. Anthropic hesabıyla giriş yapmanız gerekmez.',
            en: 'Open a terminal in a project folder and type claude. You do not need to sign in with an Anthropic account.',
          },
          blocks: [block('command', 'bash', 'claude')],
          see: {
            tr: 'İlk açılışta bir renk teması sorulur. Aşağı ok ile istediğiniz temayı seçip Enter’a basın.',
            en: 'The first time, it asks for a colour theme. Pick one with the Down arrow and press Enter.',
          },
          shots: [
            shot(
              'win-tema',
              767,
              'Claude Code’un ilk açılışta gösterdiği tema seçimi.',
              'The theme choice Claude Code shows on first start.',
              744
            ),
          ],
        },
        {
          text: {
            tr: 'Claude Code klasöre güvenip güvenmediğinizi sorar. Kendi klasörünüzse aşağı oku ve ardından Enter’ı kullanarak “Yes, I trust this folder” seçeneğini onaylayın.',
            en: 'Claude Code asks whether you trust the folder. If it is your own folder, use the Down arrow and then Enter to confirm “Yes, I trust this folder”.',
          },
          see: {
            tr: 'Varsayılan seçenek “No, exit”tir; Enter’a basmadan önce aşağı okla “Yes”e geçin, yoksa Claude Code kapanır.',
            en: 'The default is “No, exit”; move to “Yes” with the Down arrow before pressing Enter, or Claude Code closes.',
          },
          shots: [
            shot(
              'win-vertrouwen',
              690,
              'Klasöre güvenme sorusu; varsayılan “No, exit” seçili.',
              'The folder trust question; “No, exit” is selected by default.',
              744
            ),
          ],
        },
        {
          text: {
            tr: 'Karşılama ekranı açılır. Kutuya bir soru yazıp Enter’a basın.',
            en: 'The welcome screen opens. Type a question in the box and press Enter.',
          },
          see: {
            tr: 'Soru kutusu, altında kullandığınız model adı görünür. “Model listesinde yok” türünde bir uyarı çıkabilir; bu zararsızdır, model çalışır.',
            en: 'A question box with your model name under it. A notice that the model is not in its list may appear; that is harmless and the model works.',
          },
          shots: [
            shot(
              'win-start',
              340,
              'Claude Code karşılama ekranı ve boş soru kutusu.',
              'The Claude Code welcome screen with an empty question box.',
              744
            ),
            shot(
              'win-vraag',
              340,
              'Soru kutusuna yazılmış bir soru.',
              'A question typed into the box.',
              744
            ),
            shot(
              'win-antwoord',
              750,
              'Gelen yanıt; giriş ekranı çıkmadı.',
              'The answer that came back; no sign-in screen appeared.',
              744
            ),
          ],
        },
        {
          text: {
            tr: 'Doğru adrese bağlandığınızı görmek için Claude Code içinde /status yazın.',
            en: 'To see that you are connected to the right address, type /status inside Claude Code.',
          },
          blocks: [block('command', 'text', '/status')],
          see: {
            tr: 'Anthropic base URL satırında https://api.hisarweb.be yazmalıdır.',
            en: 'The “Anthropic base URL” line must read https://api.hisarweb.be.',
          },
          shots: [
            shot(
              'win-status',
              951,
              '/status ekranı; Anthropic base URL satırında api.hisarweb.be görünür.',
              'The /status screen; the Anthropic base URL line shows api.hisarweb.be.',
              698
            ),
          ],
        },
      ],
    },
    {
      id: 'vscode',
      label: { tr: 'VS Code eklentisi', en: 'VS Code extension' },
      intro: {
        tr: 'Eklenti, komut satırı sürümüyle aynı Claude Code’u kullanır; ayarları VS Code’un kendi ayar dosyasında tutar.',
        en: 'The extension uses the same Claude Code as the command line version; it keeps its settings in VS Code’s own settings file.',
      },
      steps: [
        {
          text: {
            tr: 'VS Code’da Ctrl + Shift + X (macOS’ta Cmd + Shift + X) ile Eklentiler panelini açın, Claude Code yazın ve yayıncısı Anthropic olan eklentiyi (anthropic.claude-code) yükleyin.',
            en: 'In VS Code press Ctrl + Shift + X (Cmd + Shift + X on macOS) to open Extensions, type Claude Code and install the extension published by Anthropic (anthropic.claude-code).',
          },
          see: {
            tr: 'Eklentinin yanında “Yükle” yerine bir dişli simgesi görünür; yüklü demektir.',
            en: 'A gear icon replaces the Install button next to the extension; that means it is installed.',
          },
          shots: [
            shot(
              'vsc-uitbreiding',
              650,
              'VS Code Eklentiler paneli; Anthropic’in Claude Code eklentisi yüklü.',
              'The VS Code Extensions view; the Claude Code extension from Anthropic is installed.',
              340
            ),
          ],
        },
        {
          text: {
            tr: 'Ctrl + Shift + P (macOS’ta Cmd + Shift + P) ile komut paletini açın, “Preferences: Open User Settings (JSON)” yazın ve çıkan satıra Enter’a basın.',
            en: 'Press Ctrl + Shift + P (Cmd + Shift + P on macOS) to open the command palette, type “Preferences: Open User Settings (JSON)” and press Enter on that line.',
          },
          see: {
            tr: 'settings.json adlı bir dosya açılır.',
            en: 'A file called settings.json opens.',
          },
        },
        {
          text: {
            tr: 'Aşağıdaki satırları dosyadaki dış { } işaretlerinin içine yapıştırın (dosya boşsa tamamını yapıştırın), BURAYA_ANAHTARINIZ yerine anahtarınızı yazın ve kaydedin.',
            en: 'Paste the lines below inside the outer { } of the file (paste all of it if the file is empty), replace BURAYA_ANAHTARINIZ with your key, and save.',
          },
          blocks: [block('config', 'json', CLAUDE_VSCODE_SETTINGS)],
          note: {
            tr: 'Dosyada başka ayarlar varsa önceki satırın sonuna virgül koymayı unutmayın.',
            en: 'If the file has other settings, remember the comma at the end of the line before.',
          },
        },
        {
          text: {
            tr: 'VS Code’u kapatıp yeniden açın. Claude Code panelini kenar çubuğundaki Claude simgesinden ya da komut paletinde “Claude Code” yazarak açın ve bir soru yazın.',
            en: 'Close and reopen VS Code. Open the Claude Code panel from the Claude icon in the sidebar, or type “Claude Code” in the command palette, and ask a question.',
          },
          see: {
            tr: 'Giriş ekranı çıkmaz ve yanıt gelir. Giriş ekranı çıkarsa ayarın kaydedildiğinden ve VS Code’un yeniden başladığından emin olun.',
            en: 'No sign-in screen appears and an answer comes back. If a sign-in screen appears, check that the setting was saved and VS Code restarted.',
          },
          shots: [
            shot(
              'vsc-paneel',
              380,
              'Claude Code paneli açık; giriş istemi yok, “New session” hazır.',
              'The Claude Code panel open with no sign-in prompt and “New session” ready.',
              400
            ),
            shot(
              'vsc-antwoord',
              160,
              'Panelde yazılan soru ve gelen yanıt.',
              'The question typed in the panel and the answer that came back.',
              390
            ),
          ],
        },
      ],
    },
    {
      id: 'jetbrains',
      label: { tr: 'JetBrains eklentisi', en: 'JetBrains plugin' },
      intro: {
        tr: 'JetBrains eklentisi kendi başına bağlanmaz: yüklü komut satırı sürümünü kullanır. Bu yüzden önce “Komut satırı (CLI)” sekmesindeki adımları tamamlayın.',
        en: 'The JetBrains plugin does not connect by itself: it uses the installed command line version. So first finish the steps on the “Command line (CLI)” tab.',
      },
      steps: [
        {
          text: {
            tr: 'Önce “Komut satırı (CLI)” sekmesindeki kurulumu ve ayar dosyasını tamamlayın; terminalde claude --version çalışmalı.',
            en: 'First finish the install and settings file on the “Command line (CLI)” tab; claude --version must work in a terminal.',
          },
        },
        {
          unverified: true,
          text: {
            tr: 'IDE’nizde Settings, Plugins, Marketplace yolundan Claude Code eklentisini yükleyin ve IDE’yi yeniden başlatın.',
            en: 'In your IDE open Settings, Plugins, Marketplace, install the Claude Code plugin and restart the IDE.',
          },
        },
        {
          unverified: true,
          text: {
            tr: 'Eklenti panelini açıp bir soru yazın. Eklenti ayar dosyanızı komut satırı sürümünden alır.',
            en: 'Open the plugin panel and ask a question. The plugin takes your settings from the command line version.',
          },
          see: {
            tr: 'Giriş ekranı çıkmadan yanıt gelir.',
            en: 'An answer comes back without a sign-in screen.',
          },
        },
      ],
    },
    {
      id: 'desktop',
      label: { tr: 'Masaüstü uygulaması', en: 'Desktop app' },
      intro: {
        tr: 'Claude’un masaüstü uygulaması kendi ağ geçidinize “üçüncü taraf çıkarım” modu ile bağlanır. Adımlar Claude’un resmî belgesinden alınmıştır.',
        en: 'The Claude desktop app connects to your own gateway through its “third-party inference” mode. The steps come from Claude’s official documentation.',
      },
      steps: [
        {
          text: {
            tr: 'Claude masaüstü uygulamasını claude.com/download adresinden kurun ve açın; Anthropic hesabıyla giriş yapmayın.',
            en: 'Install the Claude desktop app from claude.com/download and open it; do not sign in with an Anthropic account.',
          },
        },
        {
          text: {
            tr: 'Yardım, Sorun giderme, Geliştirici modunu etkinleştir yolunu izleyin.',
            en: 'Follow Help, Troubleshooting, Enable Developer Mode.',
          },
        },
        {
          text: {
            tr: 'Geliştirici, Üçüncü taraf çıkarımı yapılandır menüsünü açın.',
            en: 'Open Developer, Configure Third-Party Inference.',
          },
        },
        {
          text: {
            tr: 'Sağlayıcı olarak Gateway’i seçin. Gateway base URL alanına şu adresi yazın; çalışmazsa sonuna /v1 ekleyip tekrar deneyin.',
            en: 'Choose Gateway as the provider. Type this address in Gateway base URL; if that fails, add /v1 at the end and try again.',
          },
          blocks: [block('settings', 'text', ANTHROPIC_BASE_URL)],
        },
        {
          text: {
            tr: 'Gateway API key alanına anahtarınızı yapıştırın. Credential kind olarak Static API key, kimlik doğrulama için Bearer seçin.',
            en: 'Paste your key into Gateway API key. Choose Static API key as the credential kind and Bearer as the authentication.',
          },
        },
        {
          text: {
            tr: 'Model listesine şu iki adı ekleyin; ilk yazılan varsayılan olur.',
            en: 'Add these two names to the model list; the first one becomes the default.',
          },
          blocks: [
            block('settings', 'text', `${MODEL_DEFAULT}\n${MODEL_HAIKU}`),
          ],
        },
        {
          text: {
            tr: 'Apply Changes’e, sonra Save & Restart’a basın. Uygulama yeniden açılınca üçüncü taraf modunda başlatmayı seçin.',
            en: 'Press Apply Changes, then Save & Restart. When the app reopens, choose to start in third-party mode.',
          },
        },
      ],
    },
  ],
  works: [
    {
      tr: 'claude yazınca Claude Code açılır ve Anthropic hesabıyla giriş istemez.',
      en: 'Typing claude opens Claude Code and it does not ask you to sign in with an Anthropic account.',
    },
    {
      tr: '/status ekranındaki adres https://api.hisarweb.be olarak görünür.',
      en: 'The /status screen shows the address https://api.hisarweb.be.',
    },
    {
      tr: 'Bir soru yazdığınızda yanıt gelir ve HisarWeb AI bakiyenizden kullanım düşer.',
      en: 'When you type a question, an answer comes back and the use is deducted from your HisarWeb AI balance.',
    },
  ],
  problems: [
    {
      message: { tr: '401 Unauthorized', en: '401 Unauthorized' },
      cause: {
        tr: 'Anahtar yanlış kopyalanmış ya da Claude Code anahtarı beklediğiniz yerden okumuyor.',
        en: 'The key was copied wrongly, or Claude Code does not read the key from where you expect.',
      },
      fix: {
        tr: 'Anahtarı baştan sona yeniden kopyalayın. Hâlâ 401 alırsanız ayar dosyasında ANTHROPIC_AUTH_TOKEN yerine ANTHROPIC_API_KEY yazıp deneyin.',
        en: 'Copy the key again from start to end. If you still get 401, write ANTHROPIC_API_KEY instead of ANTHROPIC_AUTH_TOKEN in the settings file and try again.',
      },
    },
    {
      message: {
        tr: '400 Extra inputs are not permitted',
        en: '400 Extra inputs are not permitted',
      },
      cause: {
        tr: 'Claude Code, ağ geçidinin tanımadığı deneysel bir alan gönderiyor.',
        en: 'Claude Code sends an experimental field that the gateway does not know.',
      },
      fix: {
        tr: 'Ayar dosyasındaki "env" bölümüne "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS": "1" satırını ekleyin.',
        en: 'Add the line "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS": "1" to the "env" part of the settings file.',
      },
    },
    {
      message: {
        tr: '403 ve içinde HTML görünen bir yanıt',
        en: '403 with an HTML page as the answer',
      },
      cause: {
        tr: 'İstek ağ geçidine ulaşmadan bir güvenlik duvarı (örneğin şirket ağı) tarafından durdurulmuş.',
        en: 'A firewall (for example a company network) stopped the request before it reached the gateway.',
      },
      fix: {
        tr: 'Farklı bir ağdan (örneğin telefonunuzun internet paylaşımı) deneyin.',
        en: 'Try from another network (for example your phone’s hotspot).',
      },
    },
    {
      message: {
        tr: 'Model listesinde yok / bağlam 200k varsayıldı',
        en: 'Model not recognized / context assumed to be 200k',
      },
      cause: {
        tr: 'Claude Code bu model adını kendi listesinde bulamıyor.',
        en: 'Claude Code does not find this model name in its own list.',
      },
      fix: {
        tr: 'Yapmanız gereken bir şey yok; uyarı zararsızdır.',
        en: 'Nothing to do; the notice is harmless.',
      },
    },
    {
      message: {
        tr: 'claude tanınmıyor / command not found',
        en: 'claude is not recognized / command not found',
      },
      cause: {
        tr: 'Kurulumdan sonra terminal penceresi yenilenmedi.',
        en: 'The terminal window was not refreshed after the install.',
      },
      fix: {
        tr: 'Terminal penceresini kapatıp yeni bir tane açın ve claude --version yazın.',
        en: 'Close the terminal window, open a new one and type claude --version.',
      },
    },
  ],
}

/** The provider table on its own; the AI setup prompt appends only this part. */
export const CODEX_PROVIDER_TABLE = `[model_providers.hisarweb]
name = "HisarWeb AI"
base_url = "${OPENAI_BASE_URL}"
wire_api = "responses"
env_key = "${KEY_ENV_NAME}"`

const CODEX_CONFIG = `model = "${MODEL_CODEX}"
model_provider = "hisarweb"

${CODEX_PROVIDER_TABLE}`

const CODEX_CONFIG_STEPS: readonly GuideStep[] = [
  {
    only: ['windows'],
    text: {
      tr: 'Codex ayar dosyasını açın. Bu iki komut, klasör yoksa oluşturur ve dosyayı Not Defteri’nde açar. Dosya şu yerdedir: %USERPROFILE%\\.codex\\config.toml',
      en: 'Open the Codex settings file. These two commands create the folder if it is missing and open the file in Notepad. The file lives at: %USERPROFILE%\\.codex\\config.toml',
    },
    blocks: [
      block(
        'command',
        'powershell',
        String.raw`New-Item -ItemType Directory -Force "$env:USERPROFILE\.codex" | Out-Null
notepad "$env:USERPROFILE\.codex\config.toml"`
      ),
    ],
    see: {
      tr: 'Not Defteri yeni dosya oluşturmak isteyip istemediğinizi sorarsa Evet’e basın.',
      en: 'If Notepad asks whether to create a new file, press Yes.',
    },
  },
  {
    only: ['macos', 'linux'],
    text: {
      tr: 'Codex ayar dosyasını açın. Bu iki komut, klasör yoksa oluşturur ve dosyayı nano düzenleyicisinde açar. Dosya şu yerdedir: ~/.codex/config.toml',
      en: 'Open the Codex settings file. These two commands create the folder if it is missing and open the file in the nano editor. The file lives at: ~/.codex/config.toml',
    },
    blocks: [
      block('command', 'bash', 'mkdir -p ~/.codex\nnano ~/.codex/config.toml'),
    ],
    see: {
      tr: 'Kaydetmek için Ctrl + O ve Enter, çıkmak için Ctrl + X.',
      en: 'To save press Ctrl + O and Enter, to leave Ctrl + X.',
    },
  },
  {
    text: {
      tr: 'Aşağıdaki metni dosyaya yapıştırıp kaydedin. Bu dosyada anahtar yoktur: Codex anahtarı az önce kaydettiğiniz HISARWEB_API_KEY değişkeninden okur.',
      en: 'Paste the text below into the file and save it. The key is not in this file: Codex reads it from the HISARWEB_API_KEY variable you just stored.',
    },
    blocks: [block('settings', 'toml', CODEX_CONFIG)],
    note: {
      tr: 'model ve model_provider satırları [model_providers.hisarweb] başlığından önce gelmelidir. Dosyada zaten satırlar varsa bu iki satırı en üste, kalan satırları en alta koyun.',
      en: 'The model and model_provider lines must come before the [model_providers.hisarweb] heading. If the file already has lines, put these two lines at the very top and the rest at the bottom.',
    },
  },
]

const codex: ToolGuide = {
  id: 'codex',
  name: 'OpenAI Codex',
  status: 'works',
  protocol: 'openai',
  testedWith: {
    tr: 'Codex 0.163.0 ile 22 Ekim 2026’da gerçek bir anahtarla denendi',
    en: 'Tried with Codex 0.163.0 and a real key on 22 Oct 2026',
  },
  summary: {
    tr: 'Codex, OpenAI’nin kodlama yardımcısıdır. Komut satırında ve VS Code eklentisi olarak çalışır; ChatGPT aboneliği olmadan HisarWeb AI anahtarıyla kullanılabilir.',
    en: 'Codex is OpenAI’s coding assistant. It runs in the command line and as a VS Code extension; with a HisarWeb AI key you can use it without a ChatGPT subscription.',
  },
  notice: {
    tr: 'Codex ağ geçidinin /v1/responses ucunu kullanır. Bu uç açık değilse aşağıdaki sorun listesindeki 404 satırına bakın.',
    en: 'Codex uses the /v1/responses endpoint of the gateway. If that endpoint is not open, see the 404 line in the problem list below.',
  },
  variants: [
    {
      id: 'cli',
      label: { tr: 'Komut satırı (CLI)', en: 'Command line (CLI)' },
      steps: [
        ...OPEN_TERMINAL_STEPS,
        {
          only: ['windows'],
          text: {
            tr: 'Codex’i kurmak için bu komutu PowerShell’e yapıştırıp Enter’a basın.',
            en: 'To install Codex, paste this command into PowerShell and press Enter.',
          },
          blocks: [
            block(
              'command',
              'powershell',
              'powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"'
            ),
          ],
        },
        {
          only: ['macos', 'linux'],
          text: {
            tr: 'Codex’i kurmak için bu komutu terminale yapıştırıp Enter’a basın.',
            en: 'To install Codex, paste this command into the terminal and press Enter.',
          },
          blocks: [
            block(
              'command',
              'bash',
              'curl -fsSL https://chatgpt.com/codex/install.sh | sh'
            ),
          ],
          note: {
            tr: 'Bilgisayarınızda Node.js varsa şu komut da olur: npm install -g @openai/codex',
            en: 'If your computer has Node.js, this command also works: npm install -g @openai/codex',
          },
        },
        {
          text: {
            tr: 'Terminal penceresini kapatıp yeni bir tane açın, sonra kurulumu kontrol edin.',
            en: 'Close the terminal window, open a new one and check the installation.',
          },
          blocks: [block('command', 'bash', 'codex --version')],
          see: {
            tr: 'Bir sürüm numarası görünür.',
            en: 'A version number appears.',
          },
        },
        ...KEY_ENV_STEPS,
        ...CODEX_CONFIG_STEPS,
        {
          unverified: true,
          text: {
            tr: 'Bir proje klasöründe codex yazın. Codex “ChatGPT ile giriş yap” ekranı gösterirse, kendi API anahtarınızı kullanma seçeneğini seçin ya da bu ekranı atlayın.',
            en: 'In a project folder type codex. If Codex shows a “Sign in with ChatGPT” screen, choose the option to use your own API key, or skip that screen.',
          },
          blocks: [block('command', 'bash', 'codex')],
          see: {
            tr: 'Codex açılır ve bir soru sormanızı bekler.',
            en: 'Codex opens and waits for a question.',
          },
        },
        {
          text: {
            tr: 'Bağlantıyı denetlemek için Codex içinde /status yazın, ya da Codex’ten çıkıp codex doctor çalıştırın.',
            en: 'To check the connection, type /status inside Codex, or leave Codex and run codex doctor.',
          },
          blocks: [block('command', 'text', '/status')],
        },
      ],
    },
    {
      id: 'vscode',
      label: { tr: 'VS Code eklentisi', en: 'VS Code extension' },
      intro: {
        tr: 'Eklenti, komut satırı sürümüyle aynı ayar dosyasını (config.toml) kullanır.',
        en: 'The extension uses the same settings file (config.toml) as the command line version.',
      },
      steps: [
        {
          text: {
            tr: 'VS Code’da Ctrl + Shift + X (macOS’ta Cmd + Shift + X) ile Eklentiler panelini açın, Codex yazın ve yayıncısı OpenAI olan eklentiyi (openai.chatgpt) yükleyin.',
            en: 'In VS Code press Ctrl + Shift + X (Cmd + Shift + X on macOS) to open Extensions, type Codex and install the extension published by OpenAI (openai.chatgpt).',
          },
        },
        ...OPEN_TERMINAL_STEPS,
        ...KEY_ENV_STEPS,
        ...CODEX_CONFIG_STEPS,
        {
          unverified: true,
          text: {
            tr: 'VS Code’u tamamen kapatıp yeniden açın (Windows’ta anahtar değişkenini yeni pencereler görür). Kenar çubuğundaki Codex simgesinden paneli açın ve bir soru yazın.',
            en: 'Close VS Code completely and reopen it (on Windows only new windows see the key variable). Open the panel from the Codex icon in the sidebar and ask a question.',
          },
          see: {
            tr: 'Yanıt gelir. Bir giriş ekranı çıkarsa kendi API anahtarınızı kullanma seçeneğini arayın.',
            en: 'An answer comes back. If a sign-in screen appears, look for the option to use your own API key.',
          },
        },
      ],
    },
  ],
  works: [
    {
      tr: 'codex --version bir sürüm numarası yazar ve /status ekranı yapılandırdığınız modeli gösterir.',
      en: 'codex --version prints a version number and the /status screen shows the model you configured.',
    },
    {
      tr: 'Bir soru yazdığınızda yanıt gelir ve kullanım HisarWeb AI bakiyenizden düşer.',
      en: 'When you type a question, an answer comes back and the use is deducted from your HisarWeb AI balance.',
    },
  ],
  problems: [
    {
      message: {
        tr: 'Missing environment variable: HISARWEB_API_KEY',
        en: 'Missing environment variable: HISARWEB_API_KEY',
      },
      cause: {
        tr: 'Codex anahtar değişkenini göremiyor. Windows’ta setx yalnızca sonradan açılan pencerelere yansır.',
        en: 'Codex cannot see the key variable. On Windows setx only reaches windows opened afterwards.',
      },
      fix: {
        tr: 'Terminali (VS Code kullanıyorsanız VS Code’u) kapatıp yeniden açın. Hâlâ görünmüyorsa anahtar adımını yeniden çalıştırın.',
        en: 'Close and reopen the terminal (or VS Code if you use it). If it is still missing, run the key step again.',
      },
    },
    {
      message: { tr: '401 Unauthorized', en: '401 Unauthorized' },
      cause: {
        tr: 'Anahtar yanlış kopyalanmış.',
        en: 'The key was copied wrongly.',
      },
      fix: {
        tr: 'Anahtarı baştan sona yeniden kopyalayıp anahtar adımını tekrarlayın, sonra yeni bir terminal açın.',
        en: 'Copy the key again from start to end, repeat the key step, then open a new terminal.',
      },
    },
    {
      message: {
        tr: '404 Not Found (/v1/responses)',
        en: '404 Not Found (/v1/responses)',
      },
      cause: {
        tr: 'Ağ geçidinin Responses ucu henüz açık değil.',
        en: 'The Responses endpoint of the gateway is not open yet.',
      },
      fix: {
        tr: 'Biraz sonra yeniden deneyin. Beklemek istemezseniz Cline ya da OpenCode sekmesini kullanın.',
        en: 'Try again a little later. If you do not want to wait, use the Cline or OpenCode tab.',
      },
    },
    {
      message: {
        tr: 'Model unknown / model metadata not found uyarısı',
        en: 'Model unknown / model metadata not found warning',
      },
      cause: {
        tr: 'Codex bu model adını kendi listesinde bulamıyor.',
        en: 'Codex does not find this model name in its own list.',
      },
      fix: {
        tr: 'Yanıt geliyorsa uyarıyı yok sayabilirsiniz.',
        en: 'If answers come back you can ignore the warning.',
      },
    },
    {
      message: {
        tr: 'Ayarlar çalışmıyor, proje klasöründe .codex/config.toml var',
        en: 'Settings are ignored and the project folder has a .codex/config.toml',
      },
      cause: {
        tr: 'model_provider satırı proje içindeki ayar dosyasında yok sayılır.',
        en: 'The model_provider line is ignored in a settings file inside a project.',
      },
      fix: {
        tr: 'model ve model_provider satırlarını kullanıcı klasörünüzdeki ~/.codex/config.toml dosyasına koyun.',
        en: 'Put the model and model_provider lines in the file in your user folder, ~/.codex/config.toml.',
      },
    },
  ],
}

const OPENCODE_V1_MODELS = LISTED_MODELS.map(
  (model) => `        "${model.id}": { "name": "${model.name}" }`
)

const OPENCODE_V1_CONFIG = `{
  "provider": {
    "hisarweb": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "HisarWeb AI",
      "options": {
        "baseURL": "${OPENAI_BASE_URL}",
        "apiKey": "${KEY_PLACEHOLDER}"
      },
      "models": {
${OPENCODE_V1_MODELS.join(',\n')}
      }
    }
  }
}`

const OPENCODE_V2_MODELS = LISTED_MODELS.map(
  (model) => `        "${model.id}": { "name": "${model.name}" }`
)

const OPENCODE_V2_CONFIG = `{
  "providers": {
    "hisarweb": {
      "name": "HisarWeb AI",
      "env": ["${KEY_ENV_NAME}"],
      "package": "@opencode/ai/providers/openai-compatible",
      "settings": {
        "baseURL": "${OPENAI_BASE_URL}"
      },
      "models": {
${OPENCODE_V2_MODELS.join(',\n')}
      }
    }
  }
}`

const opencode: ToolGuide = {
  id: 'opencode',
  name: 'OpenCode',
  status: 'works',
  protocol: 'openai',
  testedWith: {
    tr: 'OpenCode 1.19.4 ve 2.1.3 ile 22 Ekim 2026’da gerçek bir anahtarla denendi',
    en: 'Tried with OpenCode 1.19.4 and 2.1.3 and a real key on 22 Oct 2026',
  },
  summary: {
    tr: 'OpenCode, açık kaynaklı ve ücretsiz bir kodlama yardımcısıdır; hesap ya da abonelik istemez. Başlangıç için iyi bir seçimdir.',
    en: 'OpenCode is a free, open source coding assistant; it asks for no account or subscription. It is a good first choice.',
  },
  notice: {
    tr: 'OpenCode’un iki sürüm hattı var ve ayar dosyaları farklı. Hangisinde olduğunuzu görmek için terminalde opencode --version yazın: 1 ile başlıyorsa “Sürüm 1”, 2 ile başlıyorsa “Sürüm 2” sekmesini kullanın.',
    en: 'OpenCode has two version lines and their settings files differ. To see which you have, type opencode --version in a terminal: if it starts with 1 use the “Version 1” tab, if it starts with 2 use the “Version 2” tab.',
  },
  variants: [
    {
      id: 'v1',
      label: { tr: 'Sürüm 1 (opencode.json)', en: 'Version 1 (opencode.json)' },
      steps: [
        ...OPEN_TERMINAL_STEPS,
        {
          only: ['windows'],
          text: {
            tr: 'OpenCode’u kurmak için bu komutu PowerShell’e yapıştırın. (Bilgisayarınızda Node.js kurulu olmalı; yoksa nodejs.org adresinden kurun.)',
            en: 'To install OpenCode, paste this command into PowerShell. (Node.js must be installed on your computer; if not, install it from nodejs.org.)',
          },
          blocks: [
            block('command', 'powershell', 'npm install -g opencode-ai'),
          ],
        },
        {
          only: ['macos', 'linux'],
          text: {
            tr: 'OpenCode’u kurmak için bu komutu terminale yapıştırıp Enter’a basın.',
            en: 'To install OpenCode, paste this command into the terminal and press Enter.',
          },
          blocks: [
            block(
              'command',
              'bash',
              'curl -fsSL https://opencode.ai/install | bash'
            ),
          ],
        },
        {
          text: {
            tr: 'Terminal penceresini kapatıp yeni bir tane açın, sürümü kontrol edin.',
            en: 'Close the terminal window, open a new one and check the version.',
          },
          blocks: [block('command', 'bash', 'opencode --version')],
          see: {
            tr: 'Sürüm 1 ile başlayan bir numara görünür, örneğin 1.19.4.',
            en: 'A version number starting with 1 appears, for example 1.19.4.',
          },
        },
        {
          only: ['windows'],
          unverified: true,
          text: {
            tr: 'Ayar dosyasını açın. Bu iki komut, klasör yoksa oluşturur ve dosyayı Not Defteri’nde açar. Dosya büyük olasılıkla şu yerdedir: %USERPROFILE%\\.config\\opencode\\opencode.json',
            en: 'Open the settings file. These two commands create the folder if it is missing and open the file in Notepad. The file most likely lives at: %USERPROFILE%\\.config\\opencode\\opencode.json',
          },
          blocks: [
            block(
              'command',
              'powershell',
              String.raw`New-Item -ItemType Directory -Force "$env:USERPROFILE\.config\opencode" | Out-Null
notepad "$env:USERPROFILE\.config\opencode\opencode.json"`
            ),
          ],
          note: {
            tr: 'Bu yolu Windows’ta henüz kendi makinemizde doğrulamadık. OpenCode başladığında ayarı görmezse klasör yolunu OpenCode’un belgelerinden kontrol edin.',
            en: 'We have not confirmed this path on Windows on our own machine yet. If OpenCode does not see the setting at start, check the folder path in the OpenCode documentation.',
          },
        },
        {
          only: ['macos', 'linux'],
          text: {
            tr: 'Ayar dosyasını açın. Bu iki komut, klasör yoksa oluşturur ve dosyayı nano düzenleyicisinde açar. Dosya şu yerdedir: ~/.config/opencode/opencode.json',
            en: 'Open the settings file. These two commands create the folder if it is missing and open the file in the nano editor. The file lives at: ~/.config/opencode/opencode.json',
          },
          blocks: [
            block(
              'command',
              'bash',
              'mkdir -p ~/.config/opencode\nnano ~/.config/opencode/opencode.json'
            ),
          ],
        },
        {
          text: {
            tr: 'Aşağıdaki metni dosyaya yapıştırın, BURAYA_ANAHTARINIZ yerine anahtarınızı yazın ve kaydedin.',
            en: 'Paste the text below into the file, replace BURAYA_ANAHTARINIZ with your key, and save.',
          },
          blocks: [block('config', 'json', OPENCODE_V1_CONFIG)],
          note: {
            tr: 'Ücretsiz deneme anahtarı yalnızca claude-haiku-5-5 modelini kullanabilir. Anahtarı dosyada tutmak istemezseniz "apiKey" değeri olarak "{env:HISARWEB_API_KEY}" yazıp anahtarı bir ortam değişkenine koyabilirsiniz.',
            en: 'A free trial key can only use claude-haiku-5-5. If you do not want to keep the key in the file, write "{env:HISARWEB_API_KEY}" as the "apiKey" value and put the key in an environment variable.',
          },
        },
        {
          text: {
            tr: 'Bir proje klasöründe opencode yazın. Sonra /models yazıp Enter’a basın ve listeden “HisarWeb AI” altındaki bir modeli seçin.',
            en: 'In a project folder type opencode. Then type /models, press Enter, and choose a model under “HisarWeb AI” from the list.',
          },
          blocks: [block('command', 'bash', 'opencode')],
          see: {
            tr: 'Model listesinde “HisarWeb AI” başlığı ve model adları görünür.',
            en: 'The model list shows the “HisarWeb AI” heading and the model names.',
          },
        },
      ],
    },
    {
      id: 'v2',
      label: {
        tr: 'Sürüm 2 (opencode.jsonc)',
        en: 'Version 2 (opencode.jsonc)',
      },
      intro: {
        tr: 'Sürüm 2 ayar yapısını değiştirdi. Aşağıdaki dosya biçimini 22 Ekim 2026’da kendi makinemizde denedik ve çalıştı; sizde çalışmazsa Sürüm 1’i kurmayı ya da Cline sekmesini deneyin.',
        en: 'Version 2 changed the settings layout. We tried the file format below on our own machine on 22 Oct 2026 and it worked; if it does not work for you, try installing Version 1 or use the Cline tab.',
      },
      steps: [
        ...OPEN_TERMINAL_STEPS,
        {
          only: ['windows', 'macos', 'linux'],
          unverified: true,
          text: {
            tr: 'OpenCode Sürüm 2’yi kurmak için komutu çalıştırın.',
            en: 'To install OpenCode Version 2, run the command.',
          },
          blocks: [
            block(
              'command',
              'bash',
              'curl -fsSL https://opencode.ai/v2/install | bash'
            ),
          ],
          note: {
            tr: 'Windows’ta bu komut PowerShell’de değil, WSL ya da Git Bash gibi bir Bash penceresinde çalışır. Node.js varsa şu da olur: npm install -g @opencode/cli',
            en: 'On Windows this command runs in a Bash window such as WSL or Git Bash, not in PowerShell. If you have Node.js this also works: npm install -g @opencode/cli',
          },
        },
        {
          text: {
            tr: 'Sürümü kontrol edin.',
            en: 'Check the version.',
          },
          blocks: [block('command', 'bash', 'opencode --version')],
          see: {
            tr: 'Sürüm 2 ile başlayan bir numara görünür, örneğin 2.1.3.',
            en: 'A version number starting with 2 appears, for example 2.1.3.',
          },
        },
        ...KEY_ENV_STEPS,
        {
          text: {
            tr: 'OpenCode’un ayar klasörünü bulmak için opencode debug paths yazın. Yazdığı ayar klasörüne opencode.jsonc adında bir dosya oluşturun (genelde ~/.config/opencode).',
            en: 'To find the OpenCode settings folder type opencode debug paths. Create a file called opencode.jsonc in the settings folder it prints (usually ~/.config/opencode).',
          },
          blocks: [block('command', 'bash', 'opencode debug paths')],
        },
        {
          text: {
            tr: 'Aşağıdaki metni opencode.jsonc dosyasına yapıştırıp kaydedin. Anahtar bu dosyada değil, az önce kaydettiğiniz HISARWEB_API_KEY değişkenindedir.',
            en: 'Paste the text below into opencode.jsonc and save. The key is not in this file but in the HISARWEB_API_KEY variable you just stored.',
          },
          blocks: [block('settings', 'json', OPENCODE_V2_CONFIG)],
        },
        {
          text: {
            tr: 'Bir proje klasöründe opencode yazın, sonra /models ile “HisarWeb AI” altındaki bir modeli seçin.',
            en: 'In a project folder type opencode, then choose a model under “HisarWeb AI” with /models.',
          },
          blocks: [block('command', 'bash', 'opencode')],
        },
      ],
    },
  ],
  works: [
    {
      tr: 'opencode --version, kullandığınız sekmeyle uyumlu bir numara yazar (1.x ya da 2.x).',
      en: 'opencode --version prints a number that matches the tab you use (1.x or 2.x).',
    },
    {
      tr: '/models listesinde “HisarWeb AI” başlığı görünür ve seçtiğiniz modele yazdığınız soruya yanıt gelir.',
      en: 'The /models list shows the “HisarWeb AI” heading, and a question you type gets an answer from the model you picked.',
    },
  ],
  problems: [
    {
      message: {
        tr: '/models listesinde HisarWeb AI yok',
        en: 'HisarWeb AI is not in the /models list',
      },
      cause: {
        tr: 'Ayar dosyası yanlış klasörde ya da JSON’da bir virgül/ tırnak hatası var.',
        en: 'The settings file is in the wrong folder, or the JSON has a comma or quote mistake.',
      },
      fix: {
        tr: 'Dosyanın doğru klasörde olduğunu ve metnin eksiksiz yapıştırıldığını kontrol edin. OpenCode’u kapatıp yeniden açın.',
        en: 'Check that the file is in the right folder and that the text was pasted completely. Close and reopen OpenCode.',
      },
    },
    {
      message: { tr: '401 Unauthorized', en: '401 Unauthorized' },
      cause: {
        tr: 'Anahtar yanlış kopyalanmış.',
        en: 'The key was copied wrongly.',
      },
      fix: {
        tr: 'Anahtarı baştan sona yeniden kopyalayın. Sürüm 2’de değişkenin yeni bir terminalde tanımlı olduğundan emin olun.',
        en: 'Copy the key again from start to end. On Version 2 make sure the variable is defined in a new terminal.',
      },
    },
    {
      message: {
        tr: 'Model bulunamadı / model not found',
        en: 'model not found',
      },
      cause: {
        tr: 'Seçilen model adı ağ geçidinde yok ya da ücretsiz anahtar yalnızca haiku modellerini kullanabiliyor.',
        en: 'The chosen model name is not on the gateway, or a free key can only use the haiku models.',
      },
      fix: {
        tr: 'claude-haiku-5-5 modelini seçin.',
        en: 'Choose claude-haiku-5-5.',
      },
    },
  ],
}

const ZED_SETTINGS = `{
  "language_models": {
    "openai_compatible": {
      "HisarWeb AI": {
        "api_url": "${OPENAI_BASE_URL}",
        "available_models": [
${LISTED_MODELS.map(
  (model) =>
    `          { "name": "${model.id}", "display_name": "${model.name}", "max_tokens": 200000 }`
).join(',\n')}
        ]
      }
    }
  }
}`

const zed: ToolGuide = {
  id: 'zed',
  name: 'Zed',
  status: 'works',
  protocol: 'openai',
  testedWith: {
    tr: 'Zed 1.25.2, 22 Ekim 2026’da incelendi',
    en: 'Zed 1.25.2, researched 22 Oct 2026',
  },
  summary: {
    tr: 'Zed, hızlı ve ücretsiz bir kod editörüdür. Zed hesabı gerekmez; kendi sağlayıcınızı ayar dosyasına eklersiniz.',
    en: 'Zed is a fast, free code editor. No Zed account is needed; you add your own provider in the settings file.',
  },
  variants: [
    {
      id: 'editor',
      label: { tr: 'Zed editörü', en: 'Zed editor' },
      steps: [
        {
          only: ['windows'],
          text: {
            tr: 'Zed’i kurmak için bu komutu PowerShell’e yapıştırıp Enter’a basın (ya da zed.dev adresinden indirin).',
            en: 'To install Zed, paste this command into PowerShell and press Enter (or download it from zed.dev).',
          },
          blocks: [
            block(
              'command',
              'powershell',
              'winget install -e --id ZedIndustries.Zed'
            ),
          ],
        },
        {
          only: ['macos'],
          text: {
            tr: 'Zed’i kurmak için bu komutu Terminal’e yapıştırıp Enter’a basın (ya da zed.dev adresinden indirin).',
            en: 'To install Zed, paste this command into Terminal and press Enter (or download it from zed.dev).',
          },
          blocks: [block('command', 'bash', 'brew install --cask zed')],
        },
        {
          only: ['linux'],
          text: {
            tr: 'Zed’i kurmak için bu komutu terminale yapıştırıp Enter’a basın.',
            en: 'To install Zed, paste this command into the terminal and press Enter.',
          },
          blocks: [
            block('command', 'bash', 'curl -f https://zed.dev/install.sh | sh'),
          ],
        },
        {
          text: {
            tr: 'Zed’i açın. Giriş yapmanız gerekmez; giriş istenirse bu adımı atlayın.',
            en: 'Open Zed. You do not need to sign in; if it asks you to sign in, skip that step.',
          },
          see: {
            tr: 'Boş bir editör penceresi.',
            en: 'An empty editor window.',
          },
        },
        {
          text: {
            tr: 'Ctrl + Shift + P (macOS’ta Cmd + Shift + P) ile komut paletini açın, “zed: open settings file” yazın ve Enter’a basın.',
            en: 'Press Ctrl + Shift + P (Cmd + Shift + P on macOS) to open the command palette, type “zed: open settings file” and press Enter.',
          },
          see: {
            tr: 'settings.json dosyası açılır. Windows’ta yeri %APPDATA%\\Zed\\settings.json, macOS ve Linux’ta ~/.config/zed/settings.json olur.',
            en: 'The settings.json file opens. On Windows it lives at %APPDATA%\\Zed\\settings.json, on macOS and Linux at ~/.config/zed/settings.json.',
          },
        },
        {
          text: {
            tr: 'Aşağıdaki metni dosyadaki dış { } işaretlerinin içine yapıştırıp kaydedin (dosya boşsa tamamını yapıştırın). Bu dosyada anahtar yoktur; anahtarı sonraki adımda ekranda gireceksiniz.',
            en: 'Paste the text below inside the outer { } of the file and save (paste all of it if the file is empty). The key is not in this file; you enter it on screen in the next step.',
          },
          blocks: [block('settings', 'json', ZED_SETTINGS)],
          note: {
            tr: 'max_tokens değerleri bizim tahminimizdir (modelin okuyabileceği metin miktarı). Dosyada başka ayarlar varsa önceki satırın sonuna virgül koyun.',
            en: 'The max_tokens values are our estimate (how much text the model can read). If the file has other settings, put a comma at the end of the line before.',
          },
        },
        {
          unverified: true,
          text: {
            tr: 'Komut paletinde “agent: open settings” yazıp Enter’a basın. LLM Providers bölümünde “HisarWeb AI” satırını bulun, API anahtarı alanına 3. adımda kopyaladığınız anahtarı yapıştırın ve Enter’a basın.',
            en: 'In the command palette type “agent: open settings” and press Enter. In the LLM Providers section find the “HisarWeb AI” row, paste the key you copied in step 3 into the API key field and press Enter.',
          },
          see: {
            tr: 'Alanın altında anahtarın ayarlandığını belirten bir yazı görünür.',
            en: 'A line under the field says the key is set.',
          },
          note: {
            tr: 'Anahtarı settings.json dosyasına yazmayın; Zed onu güvenli bir yerde saklar.',
            en: 'Do not write the key in settings.json; Zed stores it in a safe place.',
          },
        },
        {
          text: {
            tr: 'Agent panelini açın (komut paletinde “agent: toggle focus” yazın), model listesinden “HisarWeb AI” altındaki Claude Sonnet 5.5’i seçip bir soru yazın.',
            en: 'Open the Agent panel (type “agent: toggle focus” in the command palette), pick Claude Sonnet 5.5 under “HisarWeb AI” from the model list and type a question.',
          },
          see: {
            tr: 'Yanıt gelir.',
            en: 'An answer comes back.',
          },
        },
      ],
    },
  ],
  works: [
    {
      tr: 'Agent panelinin model listesinde “HisarWeb AI” başlığı ve Claude Sonnet 5.5 görünür.',
      en: 'The Agent panel’s model list shows the “HisarWeb AI” heading and Claude Sonnet 5.5.',
    },
    {
      tr: 'Bir soru yazdığınızda yanıt gelir.',
      en: 'When you type a question, an answer comes back.',
    },
  ],
  problems: [
    {
      message: {
        tr: 'Ayar dosyasında kırmızı hata çizgisi',
        en: 'A red error line in the settings file',
      },
      cause: {
        tr: 'JSON’da eksik ya da fazla bir virgül ya da süslü parantez var.',
        en: 'The JSON has a missing or extra comma or brace.',
      },
      fix: {
        tr: 'Yapıştırdığınız metni ve önceki satırın sonundaki virgülü kontrol edin.',
        en: 'Check the text you pasted and the comma at the end of the line before it.',
      },
    },
    {
      message: {
        tr: 'LLM Providers listesinde HisarWeb AI yok',
        en: 'HisarWeb AI is not in the LLM Providers list',
      },
      cause: {
        tr: 'Ayar kaydedilmemiş ya da dosyada "language_models" bölümü iki kez geçiyor.',
        en: 'The setting was not saved, or "language_models" appears twice in the file.',
      },
      fix: {
        tr: 'Dosyayı kaydedin; "language_models" yalnızca bir kez geçmeli, varsa içeriklerini birleştirin.',
        en: 'Save the file; "language_models" must appear only once, merge the contents if it appears twice.',
      },
    },
    {
      message: { tr: '401 Unauthorized', en: '401 Unauthorized' },
      cause: {
        tr: 'Anahtar yanlış kopyalanmış ya da ekrandaki alana girilmemiş.',
        en: 'The key was copied wrongly or was not entered in the field on screen.',
      },
      fix: {
        tr: 'Anahtarı “agent: open settings” ekranında yeniden yapıştırın.',
        en: 'Paste the key again on the “agent: open settings” screen.',
      },
    },
  ],
}

export const TOOL_GUIDES_A: readonly ToolGuide[] = [
  claudeCode,
  codex,
  opencode,
  zed,
]
