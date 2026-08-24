/* flatkey shared site shell — grouped desktop navigation + responsive mobile menu */
(function () {
  var shell = document.querySelector(".nav") || document.querySelector(".dbar");
  if (!shell || document.querySelector(".nav-toggle")) return;

  var isDocs = shell.classList.contains("dbar");
  var sourceLinks = Array.prototype.slice.call(
    isDocs ? shell.querySelectorAll(".dtabs a, .dext a") : shell.querySelectorAll(":scope > a:not(.logo)")
  );
  if (!sourceLinks.length) return;

  var groupLabels = {
    en: { products: "Products", developers: "Developers", resources: "Resources" },
    zh: { products: "产品", developers: "开发者", resources: "资源" },
    es: { products: "Productos", developers: "Desarrolladores", resources: "Recursos" },
    fr: { products: "Produits", developers: "Développeurs", resources: "Ressources" },
    pt: { products: "Produtos", developers: "Desenvolvedores", resources: "Recursos" },
    ru: { products: "Продукты", developers: "Разработчикам", resources: "Ресурсы" },
    ja: { products: "プロダクト", developers: "開発者向け", resources: "リソース" },
    vi: { products: "Sản phẩm", developers: "Nhà phát triển", resources: "Tài nguyên" },
    de: { products: "Produkte", developers: "Entwickler", resources: "Ressourcen" },
    id: { products: "Produk", developers: "Developer", resources: "Sumber daya" }
  };
  var menuLabels = {
    en: "Open navigation menu", zh: "打开导航菜单", es: "Abrir menú de navegación",
    fr: "Ouvrir le menu de navigation", pt: "Abrir menu de navegação",
    ru: "Открыть меню навигации", ja: "ナビゲーションメニューを開く",
    vi: "Mở menu điều hướng", de: "Navigationsmenü öffnen", id: "Buka menu navigasi"
  };
  var toolsLabels = {
    en: "Tools", zh: "工具", es: "Herramientas", fr: "Outils", pt: "Ferramentas",
    ru: "Инструменты", ja: "ツール", vi: "Công cụ", de: "Tools", id: "Tools"
  };
  var primaryNavigationLabels = {
    en: "Primary navigation", zh: "主导航", es: "Navegación principal", fr: "Navigation principale",
    pt: "Navegação principal", ru: "Основная навигация", ja: "メインナビゲーション",
    vi: "Điều hướng chính", de: "Hauptnavigation", id: "Navigasi utama"
  };

  function currentLanguage() {
    var selector = document.querySelector(".langsel");
    return selector ? selector.value : (document.documentElement.lang || "en").split("-")[0];
  }

  function normalizedTarget(link) {
    try {
      var target = new URL(link.getAttribute("href") || "", window.location.href);
      var path = target.pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "").replace(/\/+$/, "") || "/";
      return { host: target.hostname, path: path, hash: target.hash };
    } catch (error) {
      return { host: "", path: "", hash: "" };
    }
  }

  function groupKeyFor(link) {
    var target = normalizedTarget(link);
    if (target.host === "docs.flatkey.ai") return "developers";
    if (target.host === "console.flatkey.ai" && target.path === "/api-marketplace") return "products";
    if (target.path === "/models" && target.hash === "#leaderboard") return "resources";
    if (target.path === "/models" || target.path === "/playground" || target.path === "/compute") return "products";
    if (target.path === "/cli" || target.path === "/docs") return "developers";
    if (target.path === "/rankings" || target.path === "/usecases" || target.path.indexOf("/use-case/") === 0 || target.path === "/status") {
      return "resources";
    }
    return "";
  }

  function isCurrentLink(link) {
    var target = normalizedTarget(link);
    var currentPath = window.location.pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "").replace(/\/+$/, "") || "/";
    if (target.host && target.host !== window.location.hostname) return false;
    if (target.path === "/models" && !target.hash && currentPath.indexOf("/models/") === 0) return true;
    if (target.path !== currentPath) return false;
    return !target.hash || target.hash === window.location.hash;
  }

  var groupedLinks = { products: [], developers: [], resources: [] };
  var standaloneLinks = [];
  sourceLinks.forEach(function (link) {
    var groupKey = groupKeyFor(link);
    if (groupKey) groupedLinks[groupKey].push(link);
    else standaloneLinks.push(link);
  });
  if (!isDocs && !groupedLinks.products.some(function (link) {
    var target = normalizedTarget(link);
    return target.host === "console.flatkey.ai" && target.path === "/api-marketplace";
  })) {
    var toolsLink = document.createElement("a");
    toolsLink.href = "https://console.flatkey.ai/api-marketplace";
    toolsLink.textContent = toolsLabels[currentLanguage()] || toolsLabels.en;
    groupedLinks.products.splice(Math.min(1, groupedLinks.products.length), 0, toolsLink);
  }

  var desktopGroups = null;
  var desktopTriggers = [];

  function closeDesktopGroups(options) {
    desktopTriggers.forEach(function (trigger) {
      var group = trigger.closest(".nav-group");
      group.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    });
    if (options && options.focusTrigger) options.focusTrigger.focus();
  }

  function buildDesktopGroups() {
    if (isDocs) return;
    var firstGroupedLink = sourceLinks.find(function (link) { return Boolean(groupKeyFor(link)); });
    if (!firstGroupedLink) return;

    desktopGroups = document.createElement("div");
    desktopGroups.className = "desktop-nav-groups";
    firstGroupedLink.parentNode.insertBefore(desktopGroups, firstGroupedLink);

    ["products", "developers", "resources"].forEach(function (key) {
      if (!groupedLinks[key].length) return;

      var group = document.createElement("div");
      group.className = "nav-group";
      if (groupedLinks[key].some(function (link) { return link.classList.contains("on") || isCurrentLink(link); })) {
        group.classList.add("is-current");
      }

      var trigger = document.createElement("button");
      trigger.className = "nav-group-trigger";
      trigger.type = "button";
      trigger.setAttribute("aria-haspopup", "true");
      trigger.setAttribute("aria-expanded", "false");
      trigger.innerHTML = '<span class="nav-group-dot" aria-hidden="true"></span><span class="nav-group-label"></span>';

      var menu = document.createElement("div");
      menu.className = "nav-group-menu";
      menu.id = "desktop-nav-" + key;
      menu.setAttribute("role", "menu");
      trigger.setAttribute("aria-controls", menu.id);

      groupedLinks[key].forEach(function (link) {
        link.classList.add("nav-group-link");
        link.setAttribute("role", "menuitem");
        if (isCurrentLink(link)) {
          link.classList.add("is-current-link");
          link.setAttribute("aria-current", "page");
        }
        link.addEventListener("click", function () { closeDesktopGroups(); });
        menu.appendChild(link);
      });

      trigger.addEventListener("click", function (event) {
        event.stopPropagation();
        var willOpen = !group.classList.contains("is-open");
        closeDesktopGroups();
        group.classList.toggle("is-open", willOpen);
        trigger.setAttribute("aria-expanded", String(willOpen));
      });
      trigger.addEventListener("keydown", function (event) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          closeDesktopGroups();
          group.classList.add("is-open");
          trigger.setAttribute("aria-expanded", "true");
          var firstLink = menu.querySelector("a");
          if (firstLink) firstLink.focus();
        }
      });
      group.addEventListener("focusout", function (event) {
        if (event.relatedTarget && group.contains(event.relatedTarget)) return;
        group.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
      });

      desktopTriggers.push(trigger);
      group.appendChild(trigger);
      group.appendChild(menu);
      desktopGroups.appendChild(group);
    });
  }

  function updateGroupLabels() {
    var labels = groupLabels[currentLanguage()] || groupLabels.en;
    var language = currentLanguage();
    if (desktopGroups) {
      desktopGroups.setAttribute("aria-label", primaryNavigationLabels[language] || primaryNavigationLabels.en);
      Array.prototype.forEach.call(desktopGroups.querySelectorAll(".nav-group"), function (group) {
        var id = group.querySelector(".nav-group-menu").id.replace("desktop-nav-", "");
        group.querySelector(".nav-group-label").textContent = labels[id] || groupLabels.en[id];
      });
    }
    Array.prototype.forEach.call(document.querySelectorAll("[data-nav-group-label]"), function (label) {
      var key = label.getAttribute("data-nav-group-label");
      label.textContent = labels[key] || groupLabels.en[key];
    });
    if (toolsLink) toolsLink.textContent = toolsLabels[language] || toolsLabels.en;
  }

  buildDesktopGroups();

  var panel = document.createElement("div");
  panel.className = "mobile-nav-panel nav-panel-grouped";
  panel.id = "mobile-site-nav";
  panel.hidden = true;

  function mobileLink(link) {
    var copy = link.cloneNode(true);
    copy.removeAttribute("id");
    copy.removeAttribute("role");
    copy.classList.remove("on", "nav-group-link");
    copy.addEventListener("click", closeMobile);
    return copy;
  }

  function syncPanel() {
    panel.innerHTML = "";

    var primary = document.createElement("div");
    primary.className = "mobile-nav-primary";
    standaloneLinks.forEach(function (link) {
      if (!link.classList.contains("btn")) primary.appendChild(mobileLink(link));
    });
    if (primary.children.length) panel.appendChild(primary);

    var groupsGrid = document.createElement("div");
    groupsGrid.className = "mobile-nav-groups";
    ["products", "developers", "resources"].forEach(function (key) {
      if (!groupedLinks[key].length) return;
      var section = document.createElement("section");
      section.className = "mobile-nav-group";
      var heading = document.createElement("h2");
      heading.setAttribute("data-nav-group-label", key);
      section.appendChild(heading);
      groupedLinks[key].forEach(function (link) { section.appendChild(mobileLink(link)); });
      groupsGrid.appendChild(section);
    });
    panel.appendChild(groupsGrid);

    var actions = document.createElement("div");
    actions.className = "mobile-nav-actions";
    standaloneLinks.forEach(function (link) {
      if (link.classList.contains("btn")) actions.appendChild(mobileLink(link));
    });
    if (actions.children.length) panel.appendChild(actions);
    updateGroupLabels();
  }

  var button = document.createElement("button");
  button.className = "nav-toggle";
  button.type = "button";
  button.setAttribute("aria-controls", panel.id);
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = "<span></span><span></span><span></span>";

  function updateMenuLabel() {
    var language = currentLanguage();
    button.setAttribute("aria-label", menuLabels[language] || menuLabels.en);
  }

  function closeMobile() {
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
    document.body.classList.remove("mobile-nav-open");
  }

  syncPanel();
  updateGroupLabels();
  updateMenuLabel();

  var languageSelector = document.querySelector(".langsel");
  if (languageSelector) {
    languageSelector.addEventListener("change", function () {
      updateGroupLabels();
      updateMenuLabel();
      syncPanel();
    });
  }
  document.addEventListener("flatkey:languagechange", function () {
    updateGroupLabels();
    updateMenuLabel();
    syncPanel();
  });

  button.addEventListener("click", function () {
    var open = button.getAttribute("aria-expanded") !== "true";
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("mobile-nav-open", open);
  });
  document.addEventListener("click", function (event) {
    if (desktopGroups && !desktopGroups.contains(event.target)) closeDesktopGroups();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    var openTrigger = desktopTriggers.find(function (trigger) { return trigger.getAttribute("aria-expanded") === "true"; });
    closeDesktopGroups({ focusTrigger: openTrigger });
    closeMobile();
  });

  shell.appendChild(button);
  shell.insertAdjacentElement("afterend", panel);
})();
