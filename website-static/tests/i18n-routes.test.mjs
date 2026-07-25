import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const scriptPath = new URL("../html/assets/i18n.js", import.meta.url);

function createLink({ href, textContent = "", area, logo = false }) {
  const attributes = { href };
  return {
    dataset: {},
    textContent,
    getAttribute(name) {
      return attributes[name] ?? null;
    },
    setAttribute(name, value) {
      attributes[name] = value;
    },
    matches(selector) {
      return logo && (
        (area === "nav" && selector.includes(".nav .logo"))
        || (area === "dbar" && selector.includes(".dbar .brand"))
      );
    },
    closest(selector) {
      return area !== "footer" && selector === ".nav, .dbar" ? { className: area } : null;
    },
  };
}

test("keeps localized navbar labels on the shared official-site routes", () => {
  const navLogo = createLink({ href: "/", area: "nav", logo: true });
  const navContact = createLink({ href: "/contact", textContent: "Contact", area: "nav" });
  const dbarBrand = createLink({ href: "/", area: "dbar", logo: true });
  const dbarContact = createLink({ href: "/contact", textContent: "Contact", area: "dbar" });
  const footerContact = createLink({ href: "/contact", textContent: "Contact", area: "footer" });
  const links = [navLogo, navContact, dbarBrand, dbarContact, footerContact];

  const document = {
    documentElement: { lang: "en-US", dataset: {} },
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "a[href]") return links;
      if (selector === ".nav a:not(.logo):not(.btn)") return [navContact];
      if (selector === ".megafoot .col a") return [footerContact];
      if (selector === ".dbar .dext a, .dbar .dtabs a") return [dbarContact];
      return [];
    },
    dispatchEvent() {},
  };
  const context = {
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    document,
    location: {
      hash: "",
      pathname: "/models",
      search: "",
      replace() {},
    },
    localStorage: {
      getItem() {
        return "zh";
      },
      setItem() {},
    },
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(scriptPath, "utf8"), context, { filename: "i18n.js" });

  assert.equal(navLogo.getAttribute("href"), "/");
  assert.equal(navContact.getAttribute("href"), "/contact");
  assert.equal(dbarBrand.getAttribute("href"), "/");
  assert.equal(dbarContact.getAttribute("href"), "/contact");
  assert.equal(footerContact.getAttribute("href"), "/zh/contact");
});
