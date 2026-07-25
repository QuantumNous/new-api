/* Browser-only preview state for the public, no-signup Playground. */
(function (global) {
  "use strict";

  var MAX_RUNS = 3;
  var STORAGE_KEY = "flatkey.playground.preview-runs.v1";

  function readUsed(storage) {
    try {
      var value = Number(storage.getItem(STORAGE_KEY));
      return Number.isInteger(value) && value >= 0 ? Math.min(value, MAX_RUNS) : 0;
    } catch (error) {
      return 0;
    }
  }

  function writeUsed(storage, value) {
    try {
      storage.setItem(STORAGE_KEY, String(value));
    } catch (error) {
      // A privacy-restricted browser can still use the preview in this tab.
    }
  }

  function state(storage) {
    var used = readUsed(storage);
    return { used: used, remaining: MAX_RUNS - used, max: MAX_RUNS };
  }

  function consume(storage) {
    var current = state(storage);
    if (current.remaining === 0) {
      return { accepted: false, used: current.used, remaining: 0, max: MAX_RUNS };
    }
    var used = current.used + 1;
    writeUsed(storage, used);
    return { accepted: true, used: used, remaining: MAX_RUNS - used, max: MAX_RUNS };
  }

  function response(model, kind, prompt) {
    var shortPrompt = String(prompt || "").trim().replace(/\s+/g, " ").slice(0, 140);
    if (kind === "image") {
      return {
        label: "Illustrative image preview",
        text: "Preview prepared for “" + shortPrompt + "”. Sign in to render and download the live image through " + model + ".",
        meta: "browser preview · no paid API request sent"
      };
    }
    if (kind === "video") {
      return {
        label: "Illustrative video preview",
        text: "Storyboard preview prepared for “" + shortPrompt + "”. Sign in to create and download the live video through " + model + ".",
        meta: "browser preview · no paid API request sent"
      };
    }
    return {
      label: "Illustrative text preview",
      text: "Here is a concise starting point for “" + shortPrompt + "”: define the outcome, give the model the essential context, and ask for a structured answer you can verify.",
      meta: "browser preview · no paid API request sent"
    };
  }

  global.FLATKEY_PLAYGROUND_PREVIEW = Object.freeze({
    MAX_RUNS: MAX_RUNS,
    STORAGE_KEY: STORAGE_KEY,
    state: state,
    consume: consume,
    response: response
  });
})(window);
