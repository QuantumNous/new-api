import { describe, expect, test } from "bun:test";
import { LOCALES } from "@/lib/locales";
import {
  OFFER_MODAL_COPY,
  shouldShowOfferFab,
  shouldShowOfferModal,
} from "./lp-limited-offer-modal";

describe("LP limited offer modal helpers", () => {
  test("provides localized offer copy for every website locale", () => {
    expect(Object.keys(OFFER_MODAL_COPY).sort()).toEqual([...LOCALES].sort());

    for (const locale of LOCALES) {
      expect(OFFER_MODAL_COPY[locale].timerLabel.length).toBeGreaterThan(1);
      expect(OFFER_MODAL_COPY[locale].title.length).toBeGreaterThan(12);
      expect(OFFER_MODAL_COPY[locale].body.length).toBeGreaterThan(40);
    }

    // `id` is a staged locale: falls back to English until translated.
    for (const locale of LOCALES.filter((item) => item !== "en" && item !== "id")) {
      expect(OFFER_MODAL_COPY[locale].timerLabel).not.toBe(OFFER_MODAL_COPY.en.timerLabel);
      expect(OFFER_MODAL_COPY[locale].body).not.toBe(OFFER_MODAL_COPY.en.body);
    }
  });

  test("waits 5 seconds before showing the offer", () => {
    expect(shouldShowOfferModal(4_999)).toBe(false);
    expect(shouldShowOfferModal(5_000)).toBe(true);
  });

  test("does not define leave-page confirmation copy", () => {
    for (const locale of LOCALES) {
      expect("leaveMessage" in OFFER_MODAL_COPY[locale]).toBe(false);
    }
  });

  test("shows the corner plans button after the modal is collapsed, with no expiry", () => {
    expect(shouldShowOfferFab({ hasOfferStarted: true, isCollapsed: true })).toBe(true);
    expect(shouldShowOfferFab({ hasOfferStarted: false, isCollapsed: true })).toBe(false);
    expect(shouldShowOfferFab({ hasOfferStarted: true, isCollapsed: false })).toBe(false);
  });
});
