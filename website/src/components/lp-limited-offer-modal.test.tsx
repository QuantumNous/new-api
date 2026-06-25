import { describe, expect, test } from "bun:test";
import { LOCALES } from "@/lib/locales";
import {
  OFFER_MODAL_COPY,
  formatOfferCountdown,
  getOfferCountdownSeconds,
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

    for (const locale of LOCALES.filter((item) => item !== "en")) {
      expect(OFFER_MODAL_COPY[locale].timerLabel).not.toBe(OFFER_MODAL_COPY.en.timerLabel);
      expect(OFFER_MODAL_COPY[locale].body).not.toBe(OFFER_MODAL_COPY.en.body);
    }
  });

  test("waits 5 seconds before showing the offer", () => {
    expect(shouldShowOfferModal(4_999)).toBe(false);
    expect(shouldShowOfferModal(5_000)).toBe(true);
  });

  test("counts down from a 10 minute offer window", () => {
    expect(getOfferCountdownSeconds(0)).toBe(600);
    expect(getOfferCountdownSeconds(1_000)).toBe(599);
    expect(getOfferCountdownSeconds(599_000)).toBe(1);
    expect(getOfferCountdownSeconds(600_000)).toBe(0);
    expect(getOfferCountdownSeconds(700_000)).toBe(0);
  });

  test("formats countdown as MM:SS", () => {
    expect(formatOfferCountdown(600)).toBe("10:00");
    expect(formatOfferCountdown(599)).toBe("09:59");
    expect(formatOfferCountdown(61)).toBe("01:01");
    expect(formatOfferCountdown(0)).toBe("00:00");
  });

  test("does not define leave-page confirmation copy", () => {
    for (const locale of LOCALES) {
      expect("leaveMessage" in OFFER_MODAL_COPY[locale]).toBe(false);
    }
  });

  test("shows the corner offer button after the modal is collapsed", () => {
    expect(shouldShowOfferFab({ hasOfferStarted: true, isCollapsed: true, secondsLeft: 1 })).toBe(true);
    expect(shouldShowOfferFab({ hasOfferStarted: false, isCollapsed: true, secondsLeft: 1 })).toBe(false);
    expect(shouldShowOfferFab({ hasOfferStarted: true, isCollapsed: false, secondsLeft: 1 })).toBe(false);
    expect(shouldShowOfferFab({ hasOfferStarted: true, isCollapsed: true, secondsLeft: 0 })).toBe(false);
  });
});
