// Minimal local app to test xAI text-to-speech and speech-to-text through
// @ai-sdk/xai. The API key remains on this server and is never sent to the
// browser.
import { createServer } from 'node:http';
import { xai } from '@ai-sdk/xai';
import { generateSpeech, transcribe } from 'ai';

const PORT = Number(process.env.PORT) || 5051;
const VOICES = ['eve', 'ara', 'rex', 'sal', 'leo'];
const LANGUAGES = ['auto', 'en', 'es-ES', 'fr', 'de', 'ja', 'pt-BR'];
const TRANSCRIPTION_LANGUAGES = ['auto', 'en', 'es', 'fr', 'de', 'ja', 'pt', 'zh'];
const CODECS = ['mp3', 'wav', 'pcm', 'mulaw', 'alaw'];
const SAMPLE_RATES = [8000, 16000, 22050, 24000, 44100, 48000];

const options = (values, selected) =>
  values
    .map(
      value =>
        `<option value="${value}"${value === selected ? ' selected' : ''}>${value}</option>`,
    )
    .join('');

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>xAI Voice Demo</title>
  <style>
    :root {
      --bg: #fafafa;
      --card: #fff;
      --border: #e5e7eb;
      --fg: #18181b;
      --muted: #71717a;
      --button: #18181b;
      --button-text: #fff;
      --error: #dc2626;
      --success: #15803d;
      --surface: #f4f4f5;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #09090b;
        --card: #111113;
        --border: #27272a;
        --fg: #f4f4f5;
        --muted: #a1a1aa;
        --button: #f4f4f5;
        --button-text: #09090b;
        --surface: #18181b;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 52px 20px;
      background: var(--bg);
      color: var(--fg);
      font: 14px system-ui, sans-serif;
    }
    main {
      max-width: 640px;
      margin: 0 auto;
      padding: 28px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--card);
    }
    h1 { margin: 0 0 8px; font-size: 22px; }
    h2 { margin: 0 0 8px; font-size: 15px; }
    p { margin: 0 0 24px; color: var(--muted); line-height: 1.5; }
    code { font-family: ui-monospace, monospace; }
    .field { margin-bottom: 16px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    label { display: block; margin-bottom: 6px; font-weight: 600; }
    textarea, input, select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 9px;
      background: var(--card);
      color: var(--fg);
      font: inherit;
    }
    textarea { height: 108px; resize: vertical; line-height: 1.5; }
    input[type='checkbox'] { width: auto; margin-right: 8px; }
    button {
      width: 100%;
      padding: 11px 16px;
      border: 0;
      border-radius: 9px;
      color: var(--button-text);
      background: var(--button);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    button.secondary {
      color: var(--fg);
      background: transparent;
      border: 1px solid var(--border);
    }
    button:disabled { opacity: .55; cursor: wait; }
    #speechStatus, #transcriptionStatus {
      min-height: 20px;
      margin: 15px 0 0;
      color: var(--muted);
    }
    #speechStatus.error, #transcriptionStatus.error { color: var(--error); }
    #speechStatus.success, #transcriptionStatus.success { color: var(--success); }
    audio { width: 100%; margin-top: 16px; }
    audio:not([src]) { display: none; }
    .hint { font-size: 12px; color: var(--muted); font-weight: normal; }
    .divider { border: 0; border-top: 1px solid var(--border); margin: 30px 0; }
    .section-copy { margin-bottom: 18px; }
    .recording { touch-action: none; }
    .recording.active { background: var(--error); color: #fff; }
    #transcriptionResult { margin-top: 18px; }
    #transcriptionResult.hidden { display: none; }
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
    .meta div { padding: 10px 12px; border-radius: 9px; background: var(--surface); }
    .meta strong { display: block; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
    .meta span { display: block; margin-top: 4px; font-size: 13px; }
    .transcript { padding: 14px; border-radius: 10px; background: var(--surface); white-space: pre-wrap; line-height: 1.55; }
    .segments { margin-top: 14px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--card); }
    .segments summary { cursor: pointer; color: var(--muted); }
    .segments pre { overflow: auto; margin: 12px 0 0; font-size: 12px; line-height: 1.5; }
    #uploadInput { display: none; }
    .or { margin: 12px 0; color: var(--muted); font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <main>
    <h1>xAI Voice Demo</h1>
    <p>Text-to-speech and speech-to-text via <code>@ai-sdk/xai</code>.</p>

    <section>
      <h2>Text-to-Speech</h2>
      <p class="section-copy">Speech via <code>xai.speech()</code> and <code>generateSpeech</code>. Include tags such as <code>[pause]</code> or <code>&lt;whisper&gt;...&lt;/whisper&gt;</code> in the text.</p>
      <div class="field">
        <label for="text">Text</label>
        <textarea id="text">Hello from the AI SDK. [pause] &lt;whisper&gt;This is xAI text to speech.&lt;/whisper&gt;</textarea>
      </div>
      <div class="field row">
        <div>
          <label for="voice">Voice</label>
          <select id="voice">${options(VOICES, 'eve')}</select>
        </div>
        <div>
          <label for="language">Language</label>
          <select id="language">${options(LANGUAGES, 'auto')}</select>
        </div>
      </div>
      <div class="field row">
        <div>
          <label for="codec">Output format</label>
          <select id="codec">${options(CODECS, 'mp3')}</select>
        </div>
        <div>
          <label for="sampleRate">Sample rate</label>
          <select id="sampleRate">${options(SAMPLE_RATES, 24000)}</select>
        </div>
      </div>
      <div class="field row">
        <div>
          <label for="speed">Speed <span class="hint">(0.7 - 1.5)</span></label>
          <input id="speed" type="number" min="0.7" max="1.5" step="0.1" value="1" />
        </div>
        <div>
          <label for="latency">Latency optimization</label>
          <select id="latency">${options([0, 1, 2], 0)}</select>
        </div>
      </div>
      <div class="field">
        <label><input id="normalization" type="checkbox" />Normalize text for speech</label>
      </div>
      <button id="generate">Generate and play</button>
      <div id="speechStatus"></div>
      <audio id="audio" controls></audio>
    </section>

    <hr class="divider" />

    <section>
      <h2>Speech-to-Text</h2>
      <p class="section-copy">Batch transcription via <code>xai.transcription()</code> and <code>transcribe</code>. Hold the button to record, then release to transcribe, or upload a file directly.</p>
      <div class="field row">
        <div>
          <label for="transcriptionLanguage">Language <span class="hint">(for formatting)</span></label>
          <select id="transcriptionLanguage">${options(TRANSCRIPTION_LANGUAGES, 'auto')}</select>
        </div>
        <div>
          <label for="keyterm">Key terms <span class="hint">(comma separated)</span></label>
          <input id="keyterm" type="text" placeholder="Galileo, Jupiter" />
        </div>
      </div>
      <div class="field row">
        <label><input id="format" type="checkbox" />Normalize formatted text</label>
        <label><input id="diarize" type="checkbox" />Speaker diarization</label>
      </div>
      <button id="record" class="recording">Hold to talk</button>
      <div class="or">or</div>
      <button id="upload" class="secondary">Upload audio file</button>
      <input id="uploadInput" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac" />
      <div id="transcriptionStatus"></div>
      <section id="transcriptionResult" class="hidden">
        <div class="meta">
          <div><strong>Language</strong><span id="resultLanguage"></span></div>
          <div><strong>Duration</strong><span id="resultDuration"></span></div>
          <div><strong>Segments</strong><span id="resultSegments"></span></div>
        </div>
        <div id="transcript" class="transcript"></div>
        <details class="segments">
          <summary>Word timestamps</summary>
          <pre id="segments"></pre>
        </details>
      </section>
    </section>
  </main>
  <script>
    var get = function (id) { return document.getElementById(id); };

    get('generate').onclick = async function () {
      var button = get('generate');
      var status = get('speechStatus');
      button.disabled = true;
      button.textContent = 'Generating...';
      status.className = '';
      status.textContent = '';
      try {
        var response = await fetch('/api/speech', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            text: get('text').value,
            voice: get('voice').value,
            language: get('language').value,
            outputFormat: get('codec').value,
            sampleRate: Number(get('sampleRate').value),
            speed: Number(get('speed').value),
            optimizeStreamingLatency: Number(get('latency').value),
            textNormalization: get('normalization').checked,
          }),
        });
        if (!response.ok) {
          var error = await response.json().catch(function () { return {}; });
          throw new Error(error.error || response.statusText);
        }
        var audio = await response.blob();
        get('audio').src = URL.createObjectURL(audio);
        await get('audio').play().catch(function () {});
        status.className = 'success';
        status.textContent = 'Generated ' + (audio.size / 1024).toFixed(1) + ' KB (' + audio.type + ').';
      } catch (error) {
        status.className = 'error';
        status.textContent = 'Error: ' + error.message;
      } finally {
        button.disabled = false;
        button.textContent = 'Generate and play';
      }
    };

    var mediaTypeForFile = function (file) {
      if (file.type) return file.type;
      var name = file.name.toLowerCase();
      if (name.endsWith('.mp3')) return 'audio/mpeg';
      if (name.endsWith('.wav')) return 'audio/wav';
      if (name.endsWith('.m4a')) return 'audio/mp4';
      if (name.endsWith('.ogg')) return 'audio/ogg';
      if (name.endsWith('.webm')) return 'audio/webm';
      if (name.endsWith('.flac')) return 'audio/flac';
      return 'application/octet-stream';
    };

    var showTranscription = function (result) {
      get('resultLanguage').textContent = result.language || 'unknown';
      get('resultDuration').textContent = result.durationInSeconds == null
        ? 'unknown'
        : result.durationInSeconds.toFixed(2) + ' s';
      get('resultSegments').textContent = String(result.segments.length);
      get('transcript').textContent = result.text;
      get('segments').textContent = JSON.stringify(result.segments, null, 2);
      get('transcriptionResult').className = '';
    };

    var transcribeFile = async function (file) {
      var status = get('transcriptionStatus');
      status.className = '';
      status.textContent = 'Transcribing...';
      get('transcriptionResult').className = 'hidden';
      var reader = new FileReader();
      var dataUrl = await new Promise(function (resolve, reject) {
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = function () { reject(reader.error); };
        reader.readAsDataURL(file);
      });
      var keyterm = get('keyterm').value
        .split(',')
        .map(function (value) { return value.trim(); })
        .filter(Boolean);
      var language = get('transcriptionLanguage').value;
      var response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          audio: String(dataUrl).split(',')[1],
          mediaType: mediaTypeForFile(file),
          language: language === 'auto' ? undefined : language,
          keyterm: keyterm.length ? keyterm : undefined,
          format: get('format').checked,
          diarize: get('diarize').checked,
        }),
      });
      if (!response.ok) {
        var error = await response.json().catch(function () { return {}; });
        throw new Error(error.error || response.statusText);
      }
      var result = await response.json();
      showTranscription(result);
      status.className = 'success';
      status.textContent = 'Transcription complete.';
    };

    get('upload').onclick = function () {
      get('uploadInput').click();
    };

    get('uploadInput').onchange = async function () {
      var file = get('uploadInput').files[0];
      if (!file) return;
      try {
        await transcribeFile(file);
      } catch (error) {
        get('transcriptionStatus').className = 'error';
        get('transcriptionStatus').textContent = 'Error: ' + error.message;
      }
    };

    var recorder;
    var stream;
    var chunks = [];
    var recording = false;

    var stopRecording = function () {
      if (!recording) return;
      recording = false;
      recorder.stop();
      get('record').classList.remove('active');
      get('record').textContent = 'Hold to talk';
    };

    get('record').onpointerdown = async function (event) {
      event.preventDefault();
      if (recording) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = function (data) {
          if (data.data.size) chunks.push(data.data);
        };
        recorder.onstop = async function () {
          var file = new File(chunks, 'recording.webm', {
            type: recorder.mimeType || 'audio/webm',
          });
          stream.getTracks().forEach(function (track) { track.stop(); });
          try {
            await transcribeFile(file);
          } catch (error) {
            get('transcriptionStatus').className = 'error';
            get('transcriptionStatus').textContent = 'Error: ' + error.message;
          }
        };
        recorder.start();
        recording = true;
        get('record').classList.add('active');
        get('record').textContent = 'Release to transcribe';
        get('transcriptionStatus').className = '';
        get('transcriptionStatus').textContent = 'Recording...';
      } catch (error) {
        get('transcriptionStatus').className = 'error';
        get('transcriptionStatus').textContent = 'Error: ' + error.message;
      }
    };

    get('record').onpointerup = stopRecording;
    get('record').onpointerleave = stopRecording;
    get('record').onpointercancel = stopRecording;
  </script>
</body>
</html>`;

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

const MEDIA_TYPES = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  pcm: 'audio/pcm',
  mulaw: 'audio/basic',
  alaw: 'audio/alaw',
};

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(page);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/speech') {
    try {
      if (!process.env.XAI_API_KEY) {
        throw new Error('XAI_API_KEY is not set in the environment.');
      }

      const {
        text,
        voice,
        language,
        outputFormat,
        sampleRate,
        speed,
        optimizeStreamingLatency,
        textNormalization,
      } = await readJson(req);

      if (!text) {
        throw new Error('text is required');
      }

      const codec = CODECS.includes(outputFormat) ? outputFormat : 'mp3';
      const result = await generateSpeech({
        model: xai.speech(),
        text,
        voice: voice || 'eve',
        language: language || 'auto',
        outputFormat: codec,
        speed,
        providerOptions: {
          xai: {
            sampleRate,
            optimizeStreamingLatency,
            textNormalization,
          },
        },
      });

      if (result.warnings.length) {
        console.log('warnings:', JSON.stringify(result.warnings));
      }

      res.writeHead(200, { 'content-type': MEDIA_TYPES[codec] });
      res.end(Buffer.from(result.audio.uint8Array));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('speech error:', message);
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/transcribe') {
    try {
      if (!process.env.XAI_API_KEY) {
        throw new Error('XAI_API_KEY is not set in the environment.');
      }

      const { audio, mediaType, language, keyterm, format, diarize } =
        await readJson(req);

      if (!audio) {
        throw new Error('audio is required');
      }

      if (format && !language) {
        throw new Error('language is required when formatting is enabled');
      }

      const result = await transcribe({
        model: xai.transcription(),
        audio,
        mediaType: mediaType || 'audio/webm',
        providerOptions: {
          xai: {
            language,
            keyterm,
            format: format || undefined,
            diarize: diarize || undefined,
          },
        },
      });

      if (result.warnings.length) {
        console.log('warnings:', JSON.stringify(result.warnings));
      }

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          text: result.text,
          language: result.language,
          durationInSeconds: result.durationInSeconds,
          segments: result.segments,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('transcription error:', message);
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`xAI voice demo: http://localhost:${PORT}`);
  if (!process.env.XAI_API_KEY) {
    console.log('XAI_API_KEY is not set; add it to .env before using the demo.');
  }
});
