(function () {
  "use strict";

  var slug = location.pathname.replace(/^\/models\/?/, "").replace(/\/$/, "");
  var meta = window.FLATKEY_MODEL_CATALOG && window.FLATKEY_MODEL_CATALOG[slug];
  var root = document.getElementById("model-detail");
  var base = "https://router.flatkey.ai";
  var key = "sk-fk-…";

  var specialSummaries = {
    "gpt-image-2": "OpenAI image generation for prompt-driven creative production through the Flatkey Images API.",
    "gemini-2.5-flash-image": "Google's fast Gemini image model for prompt-to-image workflows through compatible chat output.",
    "gemini-3-pro-image": "Google's quality-focused Gemini image model for high-fidelity creative and product imagery.",
    "gemini-3.1-flash-image": "Google's fast Gemini 3.1 image model for production creative workflows.",
    "gemini-3.1-flash-lite-image": "Google's lightweight Gemini 3.1 image model for efficient, high-volume generation.",
    "nano-banana-pro-preview": "Google's Nano Banana Pro preview for prompt-driven image generation and visual iteration.",
    "seedance-2.5": "Text-to-video and image-to-video generation with 1080p output and optional reference media.",
    "seedance-2.0-i2v": "Image-to-video generation that animates a supplied first frame using a natural-language prompt.",
    "gpt-realtime": "Realtime speech-to-speech sessions over WebSocket for low-latency conversational interfaces.",
    "whisper-v4": "Speech-to-text transcription for uploaded audio files."
  };

  function esc(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function statusFor(model, kind) {
    if (model === "seedance-2.5") return { id: "early_access", label: "Early access", cls: "early", note: "Available to approved early-access accounts." };
    if (kind === "chat" || kind === "image" || model === "seedance-2.0-i2v") return { id: "available", label: "Available", cls: "live", note: "Available through Flatkey now." };
    return { id: "coming_soon", label: "Coming soon", cls: "soon", note: "Not callable through Flatkey yet. The API below is a contract preview, not a live endpoint guarantee." };
  }

  function detailsFor(model, data) {
    var kind = data.kind;
    var labels = {
      chat: "Text · chat and agents", video: "Video generation", image: "Image generation",
      realtime: "Realtime audio", transcription: "Audio transcription", speech: "Text to speech"
    };
    var useCases = {
      chat: ["Reasoning", "Production agents", "Code and knowledge work"],
      video: ["Creative video", "Product motion", "Storyboarding"],
      image: ["Ad creative", "Product concepts", "Social imagery"],
      realtime: ["Voice agents", "Live assistants", "Conversational apps"],
      transcription: ["Meeting transcription", "Subtitles", "Voice analytics"],
      speech: ["Voiceover", "Narration", "Conversational audio"]
    };
    var inputs = {
      chat: ["Text", "Messages", "Tools"], video: ["Prompt", "Optional image"],
      image: ["Prompt"], realtime: ["Audio", "Text", "Events"],
      transcription: ["Audio file"], speech: ["Text", "Voice"]
    };
    var outputs = {
      chat: ["Text", "JSON", "Tool calls"], video: ["Video task", "MP4 URL"],
      image: ["Image URL"], realtime: ["Audio", "Text", "Events"],
      transcription: ["Transcript"], speech: ["Audio"]
    };
    var generic = model + " is a " + data.provider + " " + labels[kind].toLowerCase() + " model available through the Flatkey model catalog.";
    return {
      label: labels[kind] || "AI model",
      summary: specialSummaries[model] || generic,
      useCases: useCases[kind] || ["AI applications"],
      input: inputs[kind] || ["Request"],
      output: outputs[kind] || ["Response"]
    };
  }

  function videoRequest(model) {
    var content = [{ type: "text", text: "A paper airplane flying over a neon city at dusk" }];
    if (model.indexOf("i2v") > -1 || model.indexOf("kling") > -1 || model.indexOf("hailuo") > -1) {
      content.push({ type: "image_url", image_url: { url: "https://example.com/first-frame.jpg" }, role: "first_frame" });
    }
    return { model: model, content: content, resolution: model === "seedance-2.0-i2v" ? "720p" : "1080p", duration: 5 };
  }

  function examples(model, kind, api) {
    if (kind === "chat") {
      var chatBody = JSON.stringify({ model: model, messages: [{ role: "user", content: "Hello" }] });
      return {
        curl: "curl " + base + "/v1/chat/completions -H \"Authorization: Bearer " + key + "\" -H \"Content-Type: application/json\" -d '" + chatBody + "'",
        python: ["from openai import OpenAI", "", "client = OpenAI(", "    base_url=\"https://router.flatkey.ai/v1\",", "    api_key=\"" + key + "\",", ")", "response = client.chat.completions.create(", "    model=\"" + model + "\",", "    messages=[{\"role\": \"user\", \"content\": \"Hello\"}],", ")", "print(response.choices[0].message.content)"].join("\n"),
        javascript: ["import OpenAI from \"openai\";", "", "const client = new OpenAI({", "  baseURL: \"https://router.flatkey.ai/v1\",", "  apiKey: \"" + key + "\",", "});", "const response = await client.chat.completions.create({", "  model: \"" + model + "\",", "  messages: [{ role: \"user\", content: \"Hello\" }],", "});", "console.log(response.choices[0].message.content);"].join("\n")
      };
    }
    if (kind === "video") {
      var videoBody = videoRequest(model);
      var videoJSON = JSON.stringify(videoBody);
      var videoPretty = JSON.stringify(videoBody, null, 2);
      return {
        curl: ["curl -X POST " + base + "/v1/video/generations -H \"Authorization: Bearer " + key + "\" -H \"Content-Type: application/json\" -d '" + videoJSON + "'", "", "# Then poll the returned task id:", "curl " + base + "/v1/videos/TASK_ID -H \"Authorization: Bearer " + key + "\""].join("\n"),
        python: ["import requests", "", "headers = {\"Authorization\": \"Bearer " + key + "\"}", "payload = " + videoPretty, "created = requests.post(", "    \"" + base + "/v1/video/generations\",", "    headers=headers, json=payload, timeout=60,", ").json()", "task_id = created[\"id\"]", "status = requests.get(\"" + base + "/v1/videos/\" + task_id, headers=headers, timeout=30).json()", "print(status)"].join("\n"),
        javascript: ["const headers = { Authorization: \"Bearer " + key + "\", \"Content-Type\": \"application/json\" };", "const created = await fetch(\"" + base + "/v1/video/generations\", {", "  method: \"POST\", headers, body: JSON.stringify(" + videoPretty + "),", "}).then(response => response.json());", "const status = await fetch(\"" + base + "/v1/videos/\" + created.id, { headers }).then(response => response.json());", "console.log(status);"].join("\n")
      };
    }
    if (kind === "image") {
      if (api === "chat-image") {
        var imageChatBody = JSON.stringify({ model: model, messages: [{ role: "user", content: "Generate a chrome key floating above a violet city, editorial lighting" }] });
        return {
          curl: "curl " + base + "/v1/chat/completions -H \"Authorization: Bearer " + key + "\" -H \"Content-Type: application/json\" -d '" + imageChatBody + "'",
          python: ["from openai import OpenAI", "", "client = OpenAI(base_url=\"https://router.flatkey.ai/v1\", api_key=\"" + key + "\")", "response = client.chat.completions.create(", "    model=\"" + model + "\",", "    messages=[{\"role\": \"user\", \"content\": \"Generate a chrome key floating above a violet city\"}],", ")", "# Generated image is returned as a Markdown data URI.", "print(response.choices[0].message.content)"].join("\n"),
          javascript: ["import OpenAI from \"openai\";", "", "const client = new OpenAI({ baseURL: \"https://router.flatkey.ai/v1\", apiKey: \"" + key + "\" });", "const response = await client.chat.completions.create({", "  model: \"" + model + "\",", "  messages: [{ role: \"user\", content: \"Generate a chrome key floating above a violet city\" }],", "});", "// Generated image is returned as a Markdown data URI.", "console.log(response.choices[0].message.content);"].join("\n")
        };
      }
      var imageBody = JSON.stringify({ model: model, prompt: "A chrome key floating above a violet city, editorial lighting", n: 1, response_format: "url" });
      return {
        curl: "curl " + base + "/v1/images/generations -H \"Authorization: Bearer " + key + "\" -H \"Content-Type: application/json\" -d '" + imageBody + "'",
        python: ["from openai import OpenAI", "", "client = OpenAI(base_url=\"https://router.flatkey.ai/v1\", api_key=\"" + key + "\")", "image = client.images.generate(", "    model=\"" + model + "\",", "    prompt=\"A chrome key floating above a violet city, editorial lighting\",", "    n=1, response_format=\"url\",", ")", "print(image.data[0].url)"].join("\n"),
        javascript: ["import OpenAI from \"openai\";", "", "const client = new OpenAI({ baseURL: \"https://router.flatkey.ai/v1\", apiKey: \"" + key + "\" });", "const image = await client.images.generate({", "  model: \"" + model + "\",", "  prompt: \"A chrome key floating above a violet city, editorial lighting\",", "  n: 1, response_format: \"url\",", "});", "console.log(image.data[0].url);"].join("\n")
      };
    }
    if (kind === "transcription") {
      return {
        curl: "curl " + base + "/v1/audio/transcriptions -H \"Authorization: Bearer " + key + "\" -F \"model=" + model + "\" -F \"file=@meeting.mp3\"",
        python: ["from openai import OpenAI", "", "client = OpenAI(base_url=\"https://router.flatkey.ai/v1\", api_key=\"" + key + "\")", "with open(\"meeting.mp3\", \"rb\") as audio:", "    transcript = client.audio.transcriptions.create(model=\"" + model + "\", file=audio)", "print(transcript.text)"].join("\n"),
        javascript: ["import fs from \"node:fs\";", "import OpenAI from \"openai\";", "", "const client = new OpenAI({ baseURL: \"https://router.flatkey.ai/v1\", apiKey: \"" + key + "\" });", "const transcript = await client.audio.transcriptions.create({ model: \"" + model + "\", file: fs.createReadStream(\"meeting.mp3\") });", "console.log(transcript.text);"].join("\n")
      };
    }
    if (kind === "realtime") {
      return {
        curl: ["# Realtime uses WebSocket; this CLI example uses websocat:", "websocat -H=\"Authorization: Bearer " + key + "\" \"wss://router.flatkey.ai/v1/realtime?model=" + model + "\""].join("\n"),
        python: ["import asyncio, json, websockets", "", "async def main():", "    url = \"wss://router.flatkey.ai/v1/realtime?model=" + model + "\"", "    headers = {\"Authorization\": \"Bearer " + key + "\"}", "    async with websockets.connect(url, additional_headers=headers) as ws:", "        await ws.send(json.dumps({\"type\": \"response.create\"}))", "        print(await ws.recv())", "", "asyncio.run(main())"].join("\n"),
        javascript: ["import WebSocket from \"ws\";", "", "const ws = new WebSocket(", "  \"wss://router.flatkey.ai/v1/realtime?model=" + model + "\",", "  { headers: { Authorization: \"Bearer " + key + "\" } },", ");", "ws.on(\"open\", () => ws.send(JSON.stringify({ type: \"response.create\" })));", "ws.on(\"message\", data => console.log(JSON.parse(data)));"].join("\n")
      };
    }
    var speechBody = JSON.stringify({ model: model, voice: "alloy", input: "Welcome to Flatkey." });
    return {
      curl: "curl " + base + "/v1/audio/speech -H \"Authorization: Bearer " + key + "\" -H \"Content-Type: application/json\" -d '" + speechBody + "' --output speech.mp3",
      python: ["from openai import OpenAI", "", "client = OpenAI(base_url=\"https://router.flatkey.ai/v1\", api_key=\"" + key + "\")", "with client.audio.speech.with_streaming_response.create(", "    model=\"" + model + "\", voice=\"alloy\", input=\"Welcome to Flatkey.\",", ") as response:", "    response.stream_to_file(\"speech.mp3\")"].join("\n"),
      javascript: ["import fs from \"node:fs\";", "import OpenAI from \"openai\";", "", "const client = new OpenAI({ baseURL: \"https://router.flatkey.ai/v1\", apiKey: \"" + key + "\" });", "const audio = await client.audio.speech.create({ model: \"" + model + "\", voice: \"alloy\", input: \"Welcome to Flatkey.\" });", "fs.writeFileSync(\"speech.mp3\", Buffer.from(await audio.arrayBuffer()));"].join("\n")
    };
  }

  if (!meta) {
    document.title = "Model not found — flatkey";
    root.innerHTML = '<section class="not-found"><span class="eyebrow">404 · MODEL NOT FOUND</span><h1>This model is not in the Flatkey catalog.</h1><p>Return to the model explorer to select a listing.</p><a class="btn black" href="/models">Explore models →</a></section>';
    return;
  }

  var details = detailsFor(slug, meta);
  var status = statusFor(slug, meta.kind);
  var code = examples(slug, meta.kind, meta.api);
  document.title = slug + " API — Flatkey Models";
  document.querySelector('link[rel="canonical"]').href = "https://flatkey.ai/models/" + encodeURIComponent(slug);
  document.querySelector('meta[name="description"]').content = details.summary + " View the Flatkey API request format and code examples.";

  root.innerHTML = '<section class="model-hero">' +
    '<a class="back" href="/models">← Explore models</a>' +
    '<div class="model-heading"><div><span class="eyebrow">' + esc(meta.provider) + ' · ' + esc(details.label) + '</span><h1>' + esc(slug) + '</h1><p>' + esc(details.summary) + '</p></div>' +
    '<aside class="model-facts"><div><span>Availability</span><strong class="status ' + status.cls + '">' + status.label + '</strong></div><div><span>Provider</span><strong>' + esc(meta.provider) + '</strong></div><div><span>Flatkey price</span><strong>' + esc(meta.price) + '</strong></div></aside></div>' +
    '<div class="hero-actions">' + (status.id === "available" || status.id === "early_access" ? '<a class="btn black" href="/login">Get API Key →</a><a class="btn white" href="/playground?model=' + encodeURIComponent(slug) + '">Try in Playground</a>' : '<a class="btn black" href="/contact">Request access →</a>') + '</div></section>' +
    '<section class="model-grid"><article><span class="eyebrow">OVERVIEW</span><h2>What it is good for</h2><div class="use-list">' + details.useCases.map(function (item) { return '<span>' + esc(item) + '</span>'; }).join("") + '</div></article>' +
    '<article><span class="eyebrow">MODALITY</span><h2>Input and output</h2><div class="io"><div><b>INPUT</b>' + details.input.map(function (item) { return '<span>' + esc(item) + '</span>'; }).join("") + '</div><div class="arrow">→</div><div><b>OUTPUT</b>' + details.output.map(function (item) { return '<span>' + esc(item) + '</span>'; }).join("") + '</div></div></article></section>' +
    '<section class="api-section"><div class="api-head"><div><span class="eyebrow">API</span><h2>Call ' + esc(slug) + '</h2><p>' + esc(status.note) + '</p></div><a href="/docs#qs">Full API docs →</a></div>' +
    '<div class="code-card"><div class="code-tabs"><button class="on" data-code="curl">cURL / CLI</button><button data-code="python">Python</button><button data-code="javascript">JavaScript</button><button class="copy-code">Copy</button></div><pre><code id="model-code"></code></pre></div></section>';

  var current = "curl";
  var codeBox = document.getElementById("model-code");
  function renderCode() { codeBox.textContent = code[current]; }
  document.querySelectorAll("[data-code]").forEach(function (button) {
    button.addEventListener("click", function () {
      current = button.getAttribute("data-code");
      document.querySelectorAll("[data-code]").forEach(function (item) { item.classList.toggle("on", item === button); });
      renderCode();
    });
  });
  document.querySelector(".copy-code").addEventListener("click", function (event) {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(code[current]).then(function () {
      event.currentTarget.textContent = "Copied ✓";
      setTimeout(function () { event.currentTarget.textContent = "Copy"; }, 1200);
    });
  });
  renderCode();
})();
