(function (global) {
  "use strict";

  var ENDPOINT = "/api/website/pricing/v2?group=plg";
  var SCHEMA_VERSION = "website-public-plg-v2";
  var UNAVAILABLE = "Pricing temporarily unavailable";
  var DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function validDecimal(value) {
    return typeof value === "string" && DECIMAL.test(value) && Number.isFinite(Number(value));
  }

  function pricePair(value) {
    if (!isObject(value) || !validDecimal(value.configured) || !validDecimal(value.plg)) {
      throw new Error("Invalid public price pair");
    }
    return { configured: value.configured, plg: value.plg };
  }

  function validatePrices(prices) {
    var keys = ["input", "output", "cache", "image", "audio_input", "audio_output", "request"];
    if (!isObject(prices)) throw new Error("Invalid public prices");
    var validated = Object.create(null);
    keys.forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(prices, key)) throw new Error("Incomplete public prices");
      validated[key] = prices[key] === null ? null : pricePair(prices[key]);
    });
    return validated;
  }

  function displayPrice(model) {
    if (!isObject(model) || typeof model.model_name !== "string" || !model.model_name) {
      throw new Error("Invalid public pricing model");
    }
    var prices = validatePrices(model.prices);
    if (model.billing_kind === "token_ratio") {
      if (!prices.input || !prices.output || prices.request) throw new Error("Invalid token pricing model");
      var token = prices.input;
      return { configured: "$" + token.configured + "/M", plg: "$" + token.plg + "/M" };
    }
    if (model.billing_kind === "request_base") {
      if (!prices.request || Object.keys(prices).some(function (key) { return key !== "request" && prices[key] !== null; })) throw new Error("Invalid request pricing model");
      var request = prices.request;
      return { configured: "$" + request.configured + "/request", plg: "$" + request.plg + "/request" };
    }
    if (model.billing_kind === "tiered_expr") {
      if (Object.keys(prices).some(function (key) { return prices[key] !== null; })) throw new Error("Invalid tiered pricing model");
      return { configured: "Variable pricing", plg: "Variable pricing" };
    }
    throw new Error("Unsupported public billing kind");
  }

  function rows(root) {
    return Array.prototype.slice.call(root.querySelectorAll("[data-pricing-model]")).map(function (row) {
      var configured = row.querySelector('[data-price="configured"]');
      var plg = row.querySelector('[data-price="plg"]');
      if (!configured || !plg) throw new Error("Missing pricing cell");
      return { name: row.getAttribute("data-pricing-model"), configured: configured, plg: plg };
    });
  }

  function pricesFor(payload, modelNames) {
    if (!isObject(payload) || payload.success !== true || payload.schema_version !== SCHEMA_VERSION || payload.group !== "plg" || !Number.isInteger(payload.generated_at) || !Array.isArray(payload.models)) {
      throw new Error("Invalid public pricing payload");
    }
    var wanted = Object.create(null);
    modelNames.forEach(function (name) { wanted[name] = true; });
    var result = Object.create(null);
    var seen = Object.create(null);
    payload.models.forEach(function (model) {
      if (!isObject(model) || typeof model.model_name !== "string" || !model.model_name) throw new Error("Invalid public pricing model");
      if (seen[model.model_name]) throw new Error("Duplicate public pricing model");
      seen[model.model_name] = true;
      var displayed = displayPrice(model);
      if (wanted[model.model_name]) result[model.model_name] = displayed;
    });
    return result;
  }

  function unavailable(root) {
    rows(root).forEach(function (row) {
      row.configured.textContent = UNAVAILABLE;
      row.plg.textContent = UNAVAILABLE;
    });
  }

  function apply(root, payload) {
    var targets = rows(root);
    var mapped = pricesFor(payload, targets.map(function (row) { return row.name; }));
    var updates = targets.map(function (row) {
      return { row: row, price: mapped[row.name] || { configured: UNAVAILABLE, plg: UNAVAILABLE } };
    });
    updates.forEach(function (update) {
      update.row.configured.textContent = update.price.configured;
      update.row.plg.textContent = update.price.plg;
    });
  }

  function load(root, options) {
    options = options || {};
    var fetcher = options.fetch || global.fetch;
    var Controller = options.AbortController || global.AbortController;
    var schedule = options.setTimeout || global.setTimeout;
    var cancel = options.clearTimeout || global.clearTimeout;
    var controller = new Controller();
    var timer = schedule(function () { controller.abort(); }, 3000);
    return fetcher(ENDPOINT, { credentials: "omit", signal: controller.signal })
      .then(function (response) {
        if (!response || !response.ok) throw new Error("Pricing request failed");
        return response.json();
      })
      .then(function (payload) {
        apply(root, payload);
        return true;
      })
      .catch(function () {
        unavailable(root);
        return false;
      })
      .finally(function () { cancel(timer); });
  }

  global.FLATKEY_MODEL_PRICING = Object.freeze({
    endpoint: ENDPOINT,
    unavailable: UNAVAILABLE,
    displayPrice: displayPrice,
    pricesFor: pricesFor,
    apply: apply,
    load: load
  });

  if (global.document) {
    if (global.fetch && global.AbortController) load(global.document);
    else unavailable(global.document);
  }
})(window);
