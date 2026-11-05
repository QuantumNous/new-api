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
/** Guides: Cline, VS Code with Copilot Chat, Kilo Code, Aider, Continue. */
import {
  block,
  KEY_ENV_NAME,
  KEY_PLACEHOLDER,
  MODEL_DEFAULT,
  MODEL_HAIKU,
  OPENAI_BASE_URL,
  type GuideStep,
  type ToolGuide,
} from './docs-tool-guides-base'
import { KEY_ENV_STEPS, OPEN_TERMINAL_STEPS } from './docs-tool-guides-shared'

/** Opens the Extensions panel in VS Code and installs one extension. */
function installVsCodeExtension(
  extensionName: string,
  extensionId: string
): GuideStep {
  return {
    text: {
      tr: `VS Code’da Ctrl + Shift + X (macOS’ta Cmd + Shift + X) ile Eklentiler panelini açın, ${extensionName} yazın ve ${extensionId} kimlikli eklentiyi yükleyin.`,
      en: `In VS Code press Ctrl + Shift + X (Cmd + Shift + X on macOS) to open Extensions, type ${extensionName} and install the extension with the id ${extensionId}.`,
    },
    see: {
      tr: 'Eklentinin yanında “Yüklendi” görünür ve kenar çubuğuna yeni bir simge eklenir.',
      en: 'The extension shows as installed and a new icon is added to the sidebar.',
    },
  }
}

const UNAUTHORIZED_PROBLEM = {
  message: { tr: '401 Unauthorized', en: '401 Unauthorized' },
  cause: {
    tr: 'Anahtar yanlış kopyalanmış ya da başında/sonunda boşluk kalmış.',
    en: 'The key was copied wrongly or has a space at the start or end.',
  },
  fix: {
    tr: 'Anahtarı baştan sona yeniden kopyalayıp yapıştırın.',
    en: 'Copy the key again from start to end and paste it.',
  },
} as const

const cline: ToolGuide = {
  id: 'cline',
  name: 'Cline',
  status: 'works',
  protocol: 'openai',
  testedWith: {
    tr: 'Cline VS Code eklentisi 4.1.25 (incelendi) ve CLI 3.0.73 (22 Ekim 2026’da gerçek bir anahtarla denendi)',
    en: 'Cline VS Code extension 4.1.25 (researched) and CLI 3.0.73 (tried with a real key on 22 Oct 2026)',
  },
  summary: {
    tr: 'Cline, VS Code içinde çalışan açık kaynaklı bir kodlama yardımcısıdır. Kendi anahtarınızı kullanabilirsiniz; başlangıç için en kolay seçeneklerden biridir.',
    en: 'Cline is an open source coding assistant that runs inside VS Code. You can use your own key; it is one of the easiest choices to start with.',
  },
  notice: {
    tr: 'Adresin sonuna /v1 yazmayı unutmayın. Cline 4.1.25 sürümünden beri adresi tam yazdığınız gibi kullanır ve kendisi /v1 eklemez; eksik olursa 404 hatası alırsınız.',
    en: 'Do not forget to write /v1 at the end of the address. Since version 4.1.25 Cline uses the address exactly as you type it and no longer adds /v1 itself; if it is missing you get a 404 error.',
  },
  variants: [
    {
      id: 'vscode',
      label: { tr: 'VS Code eklentisi', en: 'VS Code extension' },
      steps: [
        installVsCodeExtension('Cline', 'saoudrizwan.claude-dev'),
        {
          text: {
            tr: 'Kenar çubuğundaki Cline simgesine tıklayarak Cline panelini açın, sonra panelin üstündeki dişli simgesine (Settings) tıklayın.',
            en: 'Click the Cline icon in the sidebar to open the Cline panel, then click the gear icon (Settings) at the top of the panel.',
          },
          unverified: true,
          see: {
            tr: 'Bir ayarlar ekranı ve “API Provider” alanı. İlk açılışta Cline kendi hesabıyla giriş yapmanızı isteyebilir; kendi anahtarınızı kullanma seçeneğini seçin.',
            en: 'A settings screen with an “API Provider” field. On the first start Cline may ask you to sign in with its own account; choose the option to use your own key.',
          },
        },
        {
          text: {
            tr: 'API Provider listesinden “OpenAI Compatible” seçeneğini seçin.',
            en: 'Choose “OpenAI Compatible” from the API Provider list.',
          },
          see: {
            tr: 'Altında Base URL, API Key ve Model ID alanları belirir.',
            en: 'Base URL, API Key and Model ID fields appear below it.',
          },
        },
        {
          text: {
            tr: 'Base URL alanına şu adresi yapıştırın. “Basis-URL” (temel adres), programın isteklerini gönderdiği internet adresidir.',
            en: 'Paste this address into the Base URL field. The “base URL” is the internet address the program sends its requests to.',
          },
          blocks: [block('settings', 'text', OPENAI_BASE_URL)],
          note: {
            tr: 'Sonunda /v1 olmalı.',
            en: 'It must end with /v1.',
          },
        },
        {
          text: {
            tr: 'API Key alanına 3. adımda kopyaladığınız anahtarı yapıştırın. Model ID alanına model adını aynen yazın.',
            en: 'Paste the key you copied in step 3 into the API Key field. Type the model name exactly into the Model ID field.',
          },
          blocks: [
            block('config', 'text', `API Key: ${KEY_PLACEHOLDER}`),
            block('settings', 'text', MODEL_DEFAULT),
          ],
          note: {
            tr: `Ücretsiz deneme anahtarı yalnızca haiku modellerini kullanabilir: o durumda Model ID olarak ${MODEL_HAIKU} yazın. Model adında boşluk bırakmayın.`,
            en: `A free trial key can only use the haiku models: in that case type ${MODEL_HAIKU} as the Model ID. Do not leave spaces in the model name.`,
          },
        },
        {
          text: {
            tr: 'Ayarları kaydedin ya da “Done” düğmesine basın, sonra Cline panelinde bir soru yazın.',
            en: 'Save the settings or press the “Done” button, then type a question in the Cline panel.',
          },
          see: {
            tr: 'Cline yanıt yazmaya başlar. Hata görürseniz aşağıdaki sorun listesine bakın.',
            en: 'Cline starts writing an answer. If you see an error, look at the problem list below.',
          },
        },
      ],
    },
    {
      id: 'cli',
      label: { tr: 'Komut satırı (CLI)', en: 'Command line (CLI)' },
      intro: {
        tr: 'Cline’ın komut satırı sürümü, VS Code kullanmadan terminalde çalışır. Node.js 20 ya da daha yenisi gerekir (nodejs.org).',
        en: 'The command line version of Cline runs in a terminal without VS Code. It needs Node.js 20 or newer (nodejs.org).',
      },
      steps: [
        ...OPEN_TERMINAL_STEPS,
        {
          text: {
            tr: 'Cline’ı kurmak için bu komutu terminale yapıştırıp Enter’a basın, sonra sürümü kontrol edin.',
            en: 'To install Cline, paste this command into the terminal and press Enter, then check the version.',
          },
          blocks: [
            block('command', 'bash', 'npm install -g cline\ncline version'),
          ],
          see: {
            tr: 'Bir sürüm numarası görünür.',
            en: 'A version number appears.',
          },
        },
        {
          text: {
            tr: 'Kendi API anahtarınızı tek komutla kaydedin: BURAYA_ANAHTARINIZ yerine anahtarınızı yazın.',
            en: 'Store your own API key with one command: replace BURAYA_ANAHTARINIZ with your key.',
          },
          blocks: [
            block(
              'command',
              'bash',
              `cline auth -p openai -k ${KEY_PLACEHOLDER} -b ${OPENAI_BASE_URL} -m ${MODEL_DEFAULT}`
            ),
          ],
          see: {
            tr: '“Provider configured: openai-compatible” yazısı görünür.',
            en: 'The text “Provider configured: openai-compatible” appears.',
          },
          note: {
            tr: 'Anahtar ~/.cline klasörüne (Windows’ta %USERPROFILE%\\.cline) düz metin olarak kaydedilir; bu klasörü kimseyle paylaşmayın. Cline bir görev verdiğinizde dosyaları kendiliğinden değiştirebilir; önemli projelerde önce bir kopya alın.',
            en: 'The key is stored as plain text in the ~/.cline folder (on Windows %USERPROFILE%\\.cline); do not share that folder. Cline may change files on its own when you give it a task; make a copy of important projects first.',
          },
        },
        {
          text: {
            tr: 'Bir proje klasöründe terminali açıp cline yazın ve bir soru sorun.',
            en: 'Open a terminal in a project folder, type cline and ask a question.',
          },
          blocks: [block('command', 'bash', 'cline')],
          see: {
            tr: 'Cline yanıt yazmaya başlar.',
            en: 'Cline starts writing an answer.',
          },
        },
      ],
    },
  ],
  works: [
    {
      tr: 'Cline panelinde bir soru yazdığınızda yanıt akmaya başlar ve “401” ya da “404” hatası görünmez.',
      en: 'When you type a question in the Cline panel, an answer starts to flow and no “401” or “404” error appears.',
    },
    {
      tr: 'Kullanımınız HisarWeb AI bakiyenizden düşer.',
      en: 'Your use is deducted from your HisarWeb AI balance.',
    },
  ],
  problems: [
    {
      message: { tr: '404 Not Found', en: '404 Not Found' },
      cause: {
        tr: 'Base URL’nin sonunda /v1 yok.',
        en: 'The Base URL does not end with /v1.',
      },
      fix: {
        tr: `Base URL’yi ${OPENAI_BASE_URL} olarak düzeltin.`,
        en: `Correct the Base URL to ${OPENAI_BASE_URL}.`,
      },
    },
    UNAUTHORIZED_PROBLEM,
    {
      message: {
        tr: 'Model bulunamadı / model not found',
        en: 'model not found',
      },
      cause: {
        tr: 'Model ID yanlış yazılmış ya da ücretsiz deneme anahtarıyla haiku dışı bir model seçilmiş.',
        en: 'The Model ID is misspelled, or a non-haiku model was chosen with a free trial key.',
      },
      fix: {
        tr: 'Model ID olarak claude-sonnet-5-5 (ücretli anahtar) ya da claude-haiku-5-5 (deneme anahtarı) yazın.',
        en: 'Use claude-sonnet-5-5 (paid key) or claude-haiku-5-5 (trial key) as the Model ID.',
      },
    },
    {
      message: {
        tr: 'max_tokens hatası',
        en: 'max_tokens error',
      },
      cause: {
        tr: 'Araç eski bir model adı ya da eski bir alan adı kullanıyor.',
        en: 'The tool uses an old model name or an old field name.',
      },
      fix: {
        tr: 'Listedeki bir modeli seçin ve aracınızı güncelleyin.',
        en: 'Pick a model from the list and update your tool.',
      },
    },
  ],
}

/** Settings file of VS Code for the own-endpoint models of Copilot Chat. */
const COPILOT_MODELS = `[
  {
    "name": "HisarWeb AI",
    "vendor": "customendpoint",
    "apiType": "chat-completions",
    "models": [
      {
        "id": "${MODEL_DEFAULT}",
        "name": "Claude Sonnet 5.5 (HisarWeb AI)",
        "url": "${OPENAI_BASE_URL}/chat/completions",
        "toolCalling": true,
        "vision": false,
        "maxInputTokens": 200000,
        "maxOutputTokens": 16000
      }
    ]
  }
]`

const copilot: ToolGuide = {
  id: 'copilot',
  name: 'VS Code Copilot Chat',
  tabLabel: {
    tr: 'VS Code + Copilot Chat',
    en: 'VS Code + Copilot Chat',
  },
  status: 'works',
  protocol: 'openai',
  testedWith: {
    tr: 'VS Code belgeleri, 21 Ekim 2026 sürümü; 22 Ekim 2026’da incelendi',
    en: 'VS Code documentation of 21 Oct 2026; researched 22 Oct 2026',
  },
  summary: {
    tr: 'VS Code’un Copilot Chat sohbeti, kendi anahtarınızla çalışabilir. Resmî belgeye göre bunun için GitHub hesabı ve Copilot aboneliği gerekmez.',
    en: 'The Copilot Chat panel of VS Code can work with your own key. According to the official documentation you need neither a GitHub account nor a Copilot plan for this.',
  },
  notice: {
    tr: 'Sınırlama: kodu yazarken çıkan satır içi öneriler (inline suggestions) GitHub hesabı ister ve kendi anahtarınızla çalışmaz. Sohbet ve ajan kipi çalışır; ajan kipi için modelin araç çağırmayı (tool calling) desteklemesi gerekir.',
    en: 'Limit: the inline suggestions that appear while you type need a GitHub account and do not work with your own key. Chat and agent mode work; agent mode needs a model that supports tool calling.',
  },
  variants: [
    {
      id: 'vscode',
      label: { tr: 'VS Code', en: 'VS Code' },
      steps: [
        {
          text: {
            tr: 'VS Code’u güncel sürüme getirin (Yardım, Güncellemeleri denetle). Sohbet panelini Ctrl + Alt + I (macOS’ta Ctrl + Cmd + I) ile açın.',
            en: 'Update VS Code to the current version (Help, Check for Updates). Open the chat panel with Ctrl + Alt + I (Ctrl + Cmd + I on macOS).',
          },
          see: {
            tr: 'Sağ tarafta bir sohbet paneli. GitHub ile giriş yapmanız istenirse yok sayabilirsiniz.',
            en: 'A chat panel on the right. If it asks you to sign in with GitHub you can ignore that.',
          },
        },
        {
          text: {
            tr: 'Ctrl + Shift + P (macOS’ta Cmd + Shift + P) ile komut paletini açın, “Chat: Manage Language Models” yazın ve Enter’a basın.',
            en: 'Press Ctrl + Shift + P (Cmd + Shift + P on macOS) to open the command palette, type “Chat: Manage Language Models” and press Enter.',
          },
          see: {
            tr: 'Model yönetimi ekranı açılır.',
            en: 'The model management screen opens.',
          },
        },
        {
          text: {
            tr: '“Add Models” düğmesine, sonra listeden “Custom Endpoint” seçeneğine tıklayın.',
            en: 'Click “Add Models”, then choose “Custom Endpoint” from the list.',
          },
        },
        {
          text: {
            tr: 'Grup adı olarak HisarWeb AI yazın. API Key sorulunca 3. adımda kopyaladığınız anahtarı yapıştırın. API türü olarak “Chat Completions” seçin.',
            en: 'Type HisarWeb AI as the group name. When asked for the API key, paste the key you copied in step 3. Choose “Chat Completions” as the API type.',
          },
          note: {
            tr: 'Anahtarı bu ekranda girin, dosyaya elle yazmayın: VS Code onu güvenli bir yerde saklar ve dosyada yalnızca bir yer tutucu bırakır.',
            en: 'Enter the key on this screen and do not type it into the file by hand: VS Code stores it in a safe place and leaves only a placeholder in the file.',
          },
        },
        {
          text: {
            tr: 'VS Code chatLanguageModels.json dosyasını açar. Dosyada model satırını aşağıdaki gibi olacak şekilde düzeltip kaydedin. “apiKey” satırına dokunmayın: VS Code onu kendisi doldurmuştur.',
            en: 'VS Code opens the file chatLanguageModels.json. Change the model lines in the file so they look like the text below and save. Do not touch the “apiKey” line: VS Code filled it in itself.',
          },
          blocks: [block('settings', 'json', COPILOT_MODELS)],
          note: {
            tr: 'max_tokens gibi sayılar bizim tahminimizdir. Ücretsiz deneme anahtarı için "id" olarak claude-haiku-5-5 yazın. "url" tam uç adresi olmalıdır: sonunda /chat/completions bulunur.',
            en: 'The numbers such as the token limits are our estimate. For a free trial key write claude-haiku-5-5 as the "id". The "url" must be the full endpoint address: it ends with /chat/completions.',
          },
        },
        {
          unverified: true,
          text: {
            tr: 'Sohbet panelinde model seçiciyi açın, “HisarWeb AI” altındaki modeli seçin ve bir soru yazın.',
            en: 'In the chat panel open the model picker, choose the model under “HisarWeb AI” and type a question.',
          },
          see: {
            tr: 'Seçtiğiniz model adı sohbetin altında görünür ve yanıt gelir.',
            en: 'The model name you picked shows below the chat and an answer comes back.',
          },
        },
      ],
    },
  ],
  works: [
    {
      tr: 'Sohbet panelinin model seçicisinde “HisarWeb AI” grubu ve modelin adı görünür.',
      en: 'The model picker of the chat panel shows the “HisarWeb AI” group and the model name.',
    },
    {
      tr: 'Bir soru yazdığınızda yanıt gelir; GitHub girişi istenmez.',
      en: 'When you type a question an answer comes back; no GitHub sign-in is asked.',
    },
  ],
  problems: [
    {
      message: {
        tr: 'Model seçicide HisarWeb AI görünmüyor',
        en: 'HisarWeb AI does not show in the model picker',
      },
      cause: {
        tr: 'Dosyada "toolCalling": true yok ya da VS Code güncellemesinden sonra özel uç noktalar kapanmış (bilinen bir hata).',
        en: 'The file lacks "toolCalling": true, or custom endpoints were switched off after a VS Code update (a known bug).',
      },
      fix: {
        tr: 'Dosyada "toolCalling": true olduğundan emin olun. Hâlâ yoksa ayarlara "chat.agentHost.byokModels.enabled": true ekleyip VS Code’u yeniden yükleyin.',
        en: 'Make sure the file has "toolCalling": true. If it is still missing, add "chat.agentHost.byokModels.enabled": true to the settings and reload VS Code.',
      },
    },
    UNAUTHORIZED_PROBLEM,
    {
      message: { tr: '404 Not Found', en: '404 Not Found' },
      cause: {
        tr: '"url" alanı tam uç adresi değil.',
        en: 'The "url" field is not the full endpoint address.',
      },
      fix: {
        tr: `"url" değerini ${OPENAI_BASE_URL}/chat/completions olarak yazın.`,
        en: `Write the "url" value as ${OPENAI_BASE_URL}/chat/completions.`,
      },
    },
    {
      message: {
        tr: 'Başlık ve commit mesajı üretilemiyor',
        en: 'Titles and commit messages cannot be generated',
      },
      cause: {
        tr: 'GitHub girişi olmadan yardımcı modeller seçilmemiş.',
        en: 'Without a GitHub sign-in no helper model is chosen.',
      },
      fix: {
        tr: 'Ayarlarda chat.utilityModel ve chat.utilitySmallModel için HisarWeb AI modelinizi seçin.',
        en: 'In the settings choose your HisarWeb AI model for chat.utilityModel and chat.utilitySmallModel.',
      },
    },
  ],
}

const kilo: ToolGuide = {
  id: 'kilo',
  name: 'Kilo Code',
  status: 'works',
  protocol: 'openai',
  testedWith: {
    tr: 'Kilo Code VS Code eklentisi 7.8.15 ve CLI 7.8.15; komut satırı 22 Ekim 2026’da gerçek bir anahtarla denendi',
    en: 'Kilo Code VS Code extension 7.8.15 and CLI 7.8.15; the command line was tried with a real key on 22 Oct 2026',
  },
  summary: {
    tr: 'Kilo Code, VS Code içinde çalışan açık kaynaklı bir kodlama yardımcısıdır ve özel bir sağlayıcı eklemenize izin verir.',
    en: 'Kilo Code is an open source coding assistant that runs inside VS Code and lets you add a custom provider.',
  },
  notice: {
    tr: 'Kilo Code’un kendi hesabını açmadan kendi anahtarınızla kullanılıp kullanılamayacağını resmî belgelerde doğrulayamadık. Giriş ekranı çıkarsa Cline sekmesini kullanın.',
    en: 'We could not confirm in the official documentation whether Kilo Code can be used with your own key without opening its own account. If a sign-in screen blocks you, use the Cline tab.',
  },
  variants: [
    {
      id: 'vscode',
      label: { tr: 'VS Code eklentisi', en: 'VS Code extension' },
      steps: [
        installVsCodeExtension('Kilo Code', 'kilocode.Kilo-Code'),
        {
          unverified: true,
          text: {
            tr: 'Kenar çubuğundaki Kilo Code simgesine tıklayın, sonra dişli simgesinden Settings’i, oradan “Providers” sekmesini açın.',
            en: 'Click the Kilo Code icon in the sidebar, then open Settings from the gear icon and the “Providers” tab.',
          },
          see: {
            tr: 'Sağlayıcıların listesi. Kilo bir hesap açmanızı isterse bu kılavuzdaki Cline sekmesini kullanın.',
            en: 'A list of providers. If Kilo asks you to create an account, use the Cline tab of this guide.',
          },
        },
        {
          text: {
            tr: 'Listenin en altındaki “Custom provider” düğmesine tıklayın ve açılan pencereyi doldurun.',
            en: 'Click the “Custom provider” button at the bottom of the list and fill in the window that opens.',
          },
          blocks: [
            block(
              'config',
              'text',
              `Provider ID: hisarweb\nDisplay name: HisarWeb AI\nProvider API: OpenAI Compatible\nBase URL: ${OPENAI_BASE_URL}\nAPI key: ${KEY_PLACEHOLDER}`
            ),
          ],
          note: {
            tr: 'API key satırına 3. adımda kopyaladığınız anahtarı yazın. Base URL sonunda /v1 olmalı.',
            en: 'Write the key you copied in step 3 on the API key line. The Base URL must end with /v1.',
          },
        },
        {
          text: {
            tr: 'Models bölümünde modellerin otomatik gelmesini bekleyin ya da “Fetch models” düğmesine basın. Gelmezse model adını elle ekleyin.',
            en: 'In the Models section wait for the models to load, or press the “Fetch models” button. If they do not come, add the model name by hand.',
          },
          blocks: [block('settings', 'text', MODEL_DEFAULT)],
          note: {
            tr: `Ücretsiz deneme anahtarında yalnızca ${MODEL_HAIKU} çalışır.`,
            en: `With a free trial key only ${MODEL_HAIKU} works.`,
          },
        },
        {
          text: {
            tr: '“Submit” düğmesine basın, sonra sohbet kutusunun altındaki model seçiciden HisarWeb AI modelini seçip bir soru yazın.',
            en: 'Press “Submit”, then pick the HisarWeb AI model from the model picker below the chat box and type a question.',
          },
          see: {
            tr: 'Yanıt gelir.',
            en: 'An answer comes back.',
          },
        },
      ],
    },
    {
      id: 'cli',
      label: { tr: 'Komut satırı (CLI)', en: 'Command line (CLI)' },
      intro: {
        tr: 'Komut satırı sürümü bir ayar dosyası kullanır. Node.js gerekir (nodejs.org).',
        en: 'The command line version uses a settings file. It needs Node.js (nodejs.org).',
      },
      steps: [
        ...OPEN_TERMINAL_STEPS,
        {
          text: {
            tr: 'Kilo’yu kurmak için bu komutu terminale yapıştırıp Enter’a basın, sonra sürümü kontrol edin.',
            en: 'To install Kilo, paste this command into the terminal and press Enter, then check the version.',
          },
          blocks: [
            block(
              'command',
              'bash',
              'npm install -g @kilocode/cli\nkilo --version'
            ),
          ],
        },
        ...KEY_ENV_STEPS,
        {
          only: ['macos', 'linux'],
          text: {
            tr: 'Ayar dosyasını açın. Dosya şu yerdedir: ~/.config/kilo/kilo.jsonc',
            en: 'Open the settings file. It lives at: ~/.config/kilo/kilo.jsonc',
          },
          blocks: [
            block(
              'command',
              'bash',
              'mkdir -p ~/.config/kilo\nnano ~/.config/kilo/kilo.jsonc'
            ),
          ],
        },
        {
          only: ['windows'],
          text: {
            tr: 'Ayar dosyasını açın. Dosya şu yerdedir: %USERPROFILE%\\.config\\kilo\\kilo.jsonc',
            en: 'Open the settings file. It lives at: %USERPROFILE%\\.config\\kilo\\kilo.jsonc',
          },
          blocks: [
            block(
              'command',
              'powershell',
              String.raw`New-Item -ItemType Directory -Force "$env:USERPROFILE\.config\kilo" | Out-Null
notepad "$env:USERPROFILE\.config\kilo\kilo.jsonc"`
            ),
          ],
        },
        {
          text: {
            tr: 'Aşağıdaki metni dosyaya yapıştırıp kaydedin. Anahtar bu dosyada değil, az önce kaydettiğiniz HISARWEB_API_KEY değişkenindedir.',
            en: 'Paste the text below into the file and save. The key is not in this file but in the HISARWEB_API_KEY variable you just stored.',
          },
          blocks: [
            block(
              'settings',
              'json',
              `{
  "model": "openai-compatible/${MODEL_DEFAULT}",
  "provider": {
    "openai-compatible": {
      "options": {
        "apiKey": "{env:${KEY_ENV_NAME}}",
        "baseURL": "${OPENAI_BASE_URL}"
      },
      "models": {
        "${MODEL_DEFAULT}": {
          "name": "Claude Sonnet 5.5",
          "tool_call": true,
          "limit": { "context": 200000, "output": 16384 }
        }
      }
    }
  }
}`
            ),
          ],
          note: {
            tr: 'context ve output sayıları bizim tahminimizdir. Bu dosya genel (kullanıcı) ayar dosyasıdır; {env:...} yazımı proje klasöründeki kilo.json içinde çalışmaz.',
            en: 'The context and output numbers are our estimate. This is the global (user) settings file; the {env:...} notation does not work in a kilo.json inside a project folder.',
          },
        },
        {
          unverified: true,
          text: {
            tr: 'Bir proje klasöründe kilo yazın. Gerekirse /connect ile sağlayıcıyı bağlayın.',
            en: 'In a project folder type kilo. If needed, connect the provider with /connect.',
          },
          blocks: [block('command', 'bash', 'kilo')],
        },
      ],
    },
  ],
  works: [
    {
      tr: 'Model seçicide HisarWeb AI sağlayıcısı ve modelin adı görünür.',
      en: 'The model picker shows the HisarWeb AI provider and the model name.',
    },
    {
      tr: 'Bir soru yazdığınızda yanıt gelir.',
      en: 'When you type a question an answer comes back.',
    },
  ],
  problems: [
    {
      message: {
        tr: 'Fetch models modelleri getirmiyor',
        en: 'Fetch models returns no models',
      },
      cause: {
        tr: 'Adres yanlış ya da anahtar geçersiz.',
        en: 'The address is wrong or the key is invalid.',
      },
      fix: {
        tr: `Base URL’nin ${OPENAI_BASE_URL} olduğunu kontrol edin ve model adını elle ekleyin.`,
        en: `Check that the Base URL is ${OPENAI_BASE_URL} and add the model name by hand.`,
      },
    },
    UNAUTHORIZED_PROBLEM,
    {
      message: { tr: '404 Not Found', en: '404 Not Found' },
      cause: {
        tr: 'Base URL’nin sonunda /v1 yok.',
        en: 'The Base URL does not end with /v1.',
      },
      fix: {
        tr: `Base URL’yi ${OPENAI_BASE_URL} olarak düzeltin.`,
        en: `Correct the Base URL to ${OPENAI_BASE_URL}.`,
      },
    },
  ],
}

const AIDER_ENV_UNIX = (rcFile: string): string =>
  `echo 'export OPENAI_API_BASE="${OPENAI_BASE_URL}"' >> ${rcFile}\necho 'export OPENAI_API_KEY="${KEY_PLACEHOLDER}"' >> ${rcFile}`

const aider: ToolGuide = {
  id: 'aider',
  name: 'Aider',
  status: 'works',
  protocol: 'openai',
  testedWith: {
    tr: 'Aider 0.86.2 ile 22 Ekim 2026’da gerçek bir anahtarla denendi',
    en: 'Tried with Aider 0.86.2 and a real key on 22 Oct 2026',
  },
  summary: {
    tr: 'Aider, terminalde çalışan, projenizdeki dosyaları değiştiren ve değişiklikleri git ile kaydeden bir kodlama yardımcısıdır. Hesap gerektirmez.',
    en: 'Aider is a coding assistant that runs in the terminal, changes the files of your project and records the changes with git. It needs no account.',
  },
  notice: {
    tr: 'Aider’ın yayımlanmış sürümü eskidir; yeni model adlarını tanımayabilir ve “Unknown context window size” gibi bir uyarı gösterebilir. Bu uyarı zararsızdır. Model adının başına her zaman openai/ eklenir.',
    en: 'The released version of Aider is old; it may not know the new model names and may show a warning such as “Unknown context window size”. That warning is harmless. The model name always gets openai/ in front.',
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
            tr: 'Aider’ı kurmak için bu komutu PowerShell’e yapıştırıp Enter’a basın.',
            en: 'To install Aider, paste this command into PowerShell and press Enter.',
          },
          blocks: [
            block(
              'command',
              'powershell',
              'powershell -ExecutionPolicy ByPass -c "irm https://aider.chat/install.ps1 | iex"'
            ),
          ],
        },
        {
          only: ['macos', 'linux'],
          text: {
            tr: 'Aider’ı kurmak için bu komutu terminale yapıştırıp Enter’a basın.',
            en: 'To install Aider, paste this command into the terminal and press Enter.',
          },
          blocks: [
            block(
              'command',
              'bash',
              'curl -LsSf https://aider.chat/install.sh | sh'
            ),
          ],
        },
        {
          only: ['windows'],
          text: {
            tr: 'Adresi ve anahtarı birer “ortam değişkeni”ne kaydedin. Ortam değişkeni, Windows’un başlattığınız her programa verdiği adlandırılmış bir nottur. PowerShell’e şunu yapıştırıp Enter’a basın ve BURAYA_ANAHTARINIZ yerine anahtarınızı yazın.',
            en: 'Store the address and the key in two “environment variables”. An environment variable is a named note that Windows gives to every program you start. Paste this into PowerShell, press Enter, and replace BURAYA_ANAHTARINIZ with your key.',
          },
          blocks: [
            block(
              'config',
              'powershell',
              `setx OPENAI_API_BASE "${OPENAI_BASE_URL}"\nsetx OPENAI_API_KEY "${KEY_PLACEHOLDER}"`
            ),
          ],
          see: {
            tr: 'Her komut için “SUCCESS: Specified value was saved.” yazar.',
            en: 'Each command prints “SUCCESS: Specified value was saved.”.',
          },
        },
        {
          only: ['macos'],
          text: {
            tr: 'Adresi ve anahtarı birer “ortam değişkeni”ne kaydedin. Ortam değişkeni, macOS’un başlattığınız her programa verdiği adlandırılmış bir nottur. Terminal’e şunu yapıştırıp Enter’a basın ve BURAYA_ANAHTARINIZ yerine anahtarınızı yazın.',
            en: 'Store the address and the key in two “environment variables”. An environment variable is a named note that macOS gives to every program you start. Paste this into Terminal, press Enter, and replace BURAYA_ANAHTARINIZ with your key.',
          },
          blocks: [block('config', 'bash', AIDER_ENV_UNIX('~/.zshrc'))],
        },
        {
          only: ['linux'],
          text: {
            tr: 'Adresi ve anahtarı birer “ortam değişkeni”ne kaydedin. Ortam değişkeni, sistemin başlattığınız her programa verdiği adlandırılmış bir nottur. Terminal’e şunu yapıştırıp Enter’a basın ve BURAYA_ANAHTARINIZ yerine anahtarınızı yazın.',
            en: 'Store the address and the key in two “environment variables”. An environment variable is a named note that the system gives to every program you start. Paste this into the terminal, press Enter, and replace BURAYA_ANAHTARINIZ with your key.',
          },
          blocks: [block('config', 'bash', AIDER_ENV_UNIX('~/.bashrc'))],
        },
        {
          text: {
            tr: 'Terminal penceresini kapatıp yeni bir tane açın. Değişkenler yalnızca yeni açılan pencerelerde geçerli olur.',
            en: 'Close the terminal window and open a new one. The variables only apply to windows opened afterwards.',
          },
        },
        {
          text: {
            tr: 'Terminalde projenizin klasörüne gidin (cd komutuyla) ve Aider’ı başlatın.',
            en: 'In the terminal go to your project folder (with the cd command) and start Aider.',
          },
          blocks: [
            block('command', 'bash', `aider --model openai/${MODEL_DEFAULT}`),
          ],
          note: {
            tr: `Ücretsiz deneme anahtarı için openai/${MODEL_HAIKU} yazın. “aider tanınmıyor” hatası alırsanız python -m aider deneyin.`,
            en: `For a free trial key write openai/${MODEL_HAIKU}. If you get an “aider is not recognized” error, try python -m aider.`,
          },
          see: {
            tr: 'Aider bir karşılama metni ve “>” işaretiyle komut beklemeye başlar. Projeniz bir git deposu değilse Aider bir tane oluşturmayı önerir.',
            en: 'Aider shows a welcome text and waits at a “>” prompt. If your project is not a git repository, Aider offers to create one.',
          },
        },
      ],
    },
    {
      id: 'file',
      label: {
        tr: 'Ayar dosyası (isteğe bağlı)',
        en: 'Settings file (optional)',
      },
      intro: {
        tr: 'Ortam değişkenleri yerine bir ayar dosyası da kullanabilirsiniz. Bu dosyayı asla git’e göndermeyin: içinde anahtarınız var.',
        en: 'Instead of environment variables you can use a settings file. Never send this file to git: it contains your key.',
      },
      steps: [
        {
          only: ['windows'],
          text: {
            tr: 'Ayar dosyasını açın. Dosya şu yerdedir: %USERPROFILE%\\.aider.conf.yml',
            en: 'Open the settings file. It lives at: %USERPROFILE%\\.aider.conf.yml',
          },
          blocks: [
            block(
              'command',
              'powershell',
              String.raw`notepad "$env:USERPROFILE\.aider.conf.yml"`
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
            tr: 'Ayar dosyasını açın. Dosya şu yerdedir: ~/.aider.conf.yml',
            en: 'Open the settings file. It lives at: ~/.aider.conf.yml',
          },
          blocks: [block('command', 'bash', 'nano ~/.aider.conf.yml')],
        },
        {
          text: {
            tr: 'Aşağıdaki metni dosyaya yapıştırın, BURAYA_ANAHTARINIZ yerine anahtarınızı yazın ve kaydedin. Sonra projenizin klasöründe yalnızca aider yazarak başlatabilirsiniz.',
            en: 'Paste the text below into the file, replace BURAYA_ANAHTARINIZ with your key and save. Afterwards you can start Aider in your project folder by typing just aider.',
          },
          blocks: [
            block(
              'config',
              'yaml',
              `model: openai/${MODEL_DEFAULT}\nopenai-api-base: ${OPENAI_BASE_URL}\nopenai-api-key: ${KEY_PLACEHOLDER}\nshow-model-warnings: false`
            ),
          ],
        },
      ],
    },
  ],
  works: [
    {
      tr: 'Aider başlar ve ilk satırlarında seçtiğiniz modeli (openai/claude-sonnet-5-5) gösterir.',
      en: 'Aider starts and shows the model you chose (openai/claude-sonnet-5-5) in its first lines.',
    },
    {
      tr: 'Bir istek yazdığınızda yanıt gelir ve kullanım HisarWeb AI bakiyenizden düşer.',
      en: 'When you type a request an answer comes back and the use is deducted from your HisarWeb AI balance.',
    },
  ],
  problems: [
    {
      message: {
        tr: 'Unknown context window size and costs, using sane defaults',
        en: 'Unknown context window size and costs, using sane defaults',
      },
      cause: {
        tr: 'Aider bu model adını kendi listesinde bulamıyor.',
        en: 'Aider does not find this model name in its own list.',
      },
      fix: {
        tr: 'Yapmanız gereken bir şey yok; uyarı zararsızdır.',
        en: 'Nothing to do; the warning is harmless.',
      },
    },
    UNAUTHORIZED_PROBLEM,
    {
      message: {
        tr: 'Başka bir sağlayıcının anahtarını soruyor',
        en: 'It asks for the key of another provider',
      },
      cause: {
        tr: 'Model adının başında openai/ yok.',
        en: 'The model name does not start with openai/.',
      },
      fix: {
        tr: `Aider’ı aider --model openai/${MODEL_DEFAULT} komutuyla başlatın.`,
        en: `Start Aider with aider --model openai/${MODEL_DEFAULT}.`,
      },
    },
    {
      message: {
        tr: 'Anahtar yok ya da adres yanlış (değişkenler görünmüyor)',
        en: 'No key or wrong address (variables not visible)',
      },
      cause: {
        tr: 'Değişkenler kaydedildikten sonra terminal penceresi yenilenmedi.',
        en: 'The terminal window was not refreshed after the variables were stored.',
      },
      fix: {
        tr: 'Terminal penceresini kapatıp yeni bir tane açın.',
        en: 'Close the terminal window and open a new one.',
      },
    },
  ],
}

const CONTINUE_CONFIG = `name: HisarWeb AI
version: 1.0.0
schema: v1

models:
  - name: HisarWeb Claude Sonnet 5.5
    provider: openai
    model: ${MODEL_DEFAULT}
    apiBase: ${OPENAI_BASE_URL}
    apiKey: ${KEY_PLACEHOLDER}
    roles:
      - chat
      - edit
      - apply`

const continueGuide: ToolGuide = {
  id: 'continue',
  name: 'Continue',
  status: 'works',
  protocol: 'openai',
  testedWith: {
    tr: 'Continue VS Code eklentisi 2.0.0, 22 Ekim 2026’da incelendi; proje arşivlenmiş',
    en: 'Continue VS Code extension 2.0.0, researched 22 Oct 2026; the project is archived',
  },
  summary: {
    tr: 'Continue, VS Code içinde sohbet ve kod düzenleme sunan bir eklentidir. Yapılandırma bir YAML dosyasındadır.',
    en: 'Continue is an extension that offers chat and code editing inside VS Code. The configuration is in a YAML file.',
  },
  notice: {
    tr: 'Dürüst not: Continue projesi arşivlendi (yalnızca okunur) ve artık geliştirilmiyor; yeni modeller için düzeltme gelmeyecek. Yeni başlıyorsanız Cline, Zed ya da OpenCode sekmesi daha iyi bir seçimdir. Aşağıdaki yapılandırma yine de çalışır.',
    en: 'Honest note: the Continue project is archived (read only) and no longer developed; there will be no fixes for new models. If you are just starting, the Cline, Zed or OpenCode tab is a better choice. The configuration below still works.',
  },
  alternatives: ['cline', 'zed', 'opencode'],
  variants: [
    {
      id: 'vscode',
      label: { tr: 'VS Code eklentisi', en: 'VS Code extension' },
      steps: [
        installVsCodeExtension('Continue', 'Continue.continue'),
        {
          only: ['windows'],
          text: {
            tr: 'Ayar dosyasını açın. Bu iki komut, klasör yoksa oluşturur ve dosyayı Not Defteri’nde açar. Dosya şu yerdedir: %USERPROFILE%\\.continue\\config.yaml',
            en: 'Open the settings file. These two commands create the folder if it is missing and open the file in Notepad. The file lives at: %USERPROFILE%\\.continue\\config.yaml',
          },
          blocks: [
            block(
              'command',
              'powershell',
              String.raw`New-Item -ItemType Directory -Force "$env:USERPROFILE\.continue" | Out-Null
notepad "$env:USERPROFILE\.continue\config.yaml"`
            ),
          ],
        },
        {
          only: ['macos', 'linux'],
          text: {
            tr: 'Ayar dosyasını açın. Dosya şu yerdedir: ~/.continue/config.yaml',
            en: 'Open the settings file. It lives at: ~/.continue/config.yaml',
          },
          blocks: [
            block(
              'command',
              'bash',
              'mkdir -p ~/.continue\nnano ~/.continue/config.yaml'
            ),
          ],
        },
        {
          text: {
            tr: 'Dosyada zaten bir yapılandırma varsa yedeğini alın. Aşağıdaki metni dosyanın tamamının yerine yapıştırın, BURAYA_ANAHTARINIZ yerine anahtarınızı yazın ve kaydedin.',
            en: 'If the file already has a configuration, make a backup. Paste the text below in place of the whole file, replace BURAYA_ANAHTARINIZ with your key and save.',
          },
          blocks: [block('config', 'yaml', CONTINUE_CONFIG)],
          note: {
            tr: `Ücretsiz deneme anahtarı için model satırına ${MODEL_HAIKU} yazın. Bu dosyayı asla git’e göndermeyin: içinde anahtarınız var.`,
            en: `For a free trial key write ${MODEL_HAIKU} on the model line. Never send this file to git: it contains your key.`,
          },
        },
        {
          unverified: true,
          text: {
            tr: 'VS Code’da Ctrl + L (macOS’ta Cmd + L) ile Continue panelini açın ve bir soru yazın. Model seçicide “HisarWeb Claude Sonnet 5.5” seçili olmalı.',
            en: 'In VS Code press Ctrl + L (Cmd + L on macOS) to open the Continue panel and type a question. “HisarWeb Claude Sonnet 5.5” must be selected in the model picker.',
          },
          see: {
            tr: 'Yanıt gelir. Dosyayı kaydettiğinizde Continue ayarı kendiliğinden yeniler.',
            en: 'An answer comes back. When you save the file, Continue reloads the settings by itself.',
          },
        },
      ],
    },
  ],
  works: [
    {
      tr: 'Continue panelinin model seçicisinde “HisarWeb Claude Sonnet 5.5” görünür.',
      en: 'The model picker of the Continue panel shows “HisarWeb Claude Sonnet 5.5”.',
    },
    {
      tr: 'Bir soru yazdığınızda yanıt gelir.',
      en: 'When you type a question an answer comes back.',
    },
  ],
  problems: [
    {
      message: {
        tr: 'Model seçicide HisarWeb yok',
        en: 'HisarWeb is not in the model picker',
      },
      cause: {
        tr: 'YAML dosyasında girinti (boşluk) hatası var ya da dosya kaydedilmemiş.',
        en: 'The YAML file has an indentation (spaces) mistake or was not saved.',
      },
      fix: {
        tr: 'Metni olduğu gibi, boşluklarıyla birlikte yapıştırıp kaydedin.',
        en: 'Paste the text exactly as it is, with its spaces, and save.',
      },
    },
    UNAUTHORIZED_PROBLEM,
    {
      message: { tr: '404 Not Found', en: '404 Not Found' },
      cause: {
        tr: 'apiBase adresinin sonunda /v1 yok.',
        en: 'The apiBase address does not end with /v1.',
      },
      fix: {
        tr: `apiBase değerini ${OPENAI_BASE_URL} olarak yazın.`,
        en: `Write the apiBase value as ${OPENAI_BASE_URL}.`,
      },
    },
    {
      message: {
        tr: 'İstek hatası (/responses)',
        en: 'Request error (/responses)',
      },
      cause: {
        tr: 'Continue bazı modellerde /responses ucunu kullanabilir; listedeki modeller bu ucu beklemez.',
        en: 'Continue may use the /responses endpoint for some models; the models in our list do not expect it.',
      },
      fix: {
        tr: 'Model bloğuna useResponsesApi: false satırını ekleyin.',
        en: 'Add the line useResponsesApi: false to the model block.',
      },
    },
  ],
}

export const TOOL_GUIDES_B: readonly ToolGuide[] = [
  cline,
  copilot,
  kilo,
  aider,
  continueGuide,
]
