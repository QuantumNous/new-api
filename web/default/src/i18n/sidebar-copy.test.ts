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
import { describe, expect, test } from "bun:test";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import ja from "./locales/ja.json";
import pt from "./locales/pt.json";
import ru from "./locales/ru.json";
import vi from "./locales/vi.json";
import zh from "./locales/zh.json";

const localeTranslations = {
  en: en.translation,
  zh: zh.translation,
  es: es.translation,
  fr: fr.translation,
  ru: ru.translation,
  ja: ja.translation,
  vi: vi.translation,
  pt: pt.translation,
};

describe("sidebar onboarding copy", () => {
  test("uses localized quick-start copy for Overview and only renames Chinese Playground", () => {
    const expectedOverview: Record<string, string> = {
      en: "Quickstart",
      zh: "快速开始",
      es: "Inicio rápido",
      fr: "Démarrage rapide",
      ru: "Быстрый старт",
      ja: "クイックスタート",
      vi: "Bắt đầu nhanh",
      pt: "Início rápido",
    };

    for (const [locale, expected] of Object.entries(expectedOverview)) {
      expect(
        localeTranslations[locale as keyof typeof localeTranslations].Overview,
      ).toBe(expected);
    }

    expect(localeTranslations.zh.Playground).toBe("模型试用");
    expect(localeTranslations.en.Playground).toBe("Playground");
    expect(localeTranslations.es.Playground).toBe("Playground");
    expect(localeTranslations.fr.Playground).toBe("Aire de jeux");
    expect(localeTranslations.ru.Playground).toBe("Песочница");
    expect(localeTranslations.ja.Playground).toBe("プレイグラウンド");
    expect(localeTranslations.vi.Playground).toBe("Sân chơi");
    expect(localeTranslations.pt.Playground).toBe("Parque infantil");
  });
});
