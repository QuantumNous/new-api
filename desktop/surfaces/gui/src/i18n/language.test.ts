import { afterEach, describe, expect, it } from "vitest";
import i18n, { setLanguage } from "./index";

afterEach(async () => {
  await i18n.changeLanguage("en");
  localStorage.removeItem("coworker.lang");
});

describe("setLanguage", () => {
  it("persists the choice to coworker.lang and changes i18n language", async () => {
    setLanguage("zh");
    expect(localStorage.getItem("coworker.lang")).toBe("zh");
    // changeLanguage is async; give it a tick
    await i18n.changeLanguage("zh");
    expect(i18n.language.startsWith("zh")).toBe(true);
  });

  it("resolves a common chrome key under zh", async () => {
    await i18n.changeLanguage("zh");
    expect(i18n.t("Settings")).toBe("设置");
    expect(i18n.t("Inbox")).toBe("收件箱");
    expect(i18n.t("New session")).toBe("新会话");
  });

  it("resolves dynamic labelKey strings (composer modes + inbox filters) under zh", async () => {
    await i18n.changeLanguage("zh");
    expect(i18n.t("Discuss")).toBe("讨论");
    expect(i18n.t("Ask for approval")).toBe("请求审批");
    expect(i18n.t("Full access")).toBe("完全访问");
    expect(i18n.t("All")).toBe("全部");
    expect(i18n.t("Approvals")).toBe("审批");
    expect(i18n.t("Questions")).toBe("问题");
    expect(i18n.t("Chat")).toBe("聊天");
    expect(i18n.t("Code")).toBe("代码");
  });
});
