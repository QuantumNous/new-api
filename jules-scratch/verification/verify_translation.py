from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Go to the page and wait for it to be ready
    page.goto("http://localhost:5173", wait_until="networkidle")
    print("Page loaded")

    # The aria-label is in Chinese in the source, so we use that.
    language_button = page.get_by_role("button", name="切换语言")

    # Wait for the button to be visible
    expect(language_button).to_be_visible()
    print("Language button found")
    language_button.click()
    print("Language button clicked")

    # Click the "Français" option
    french_option = page.get_by_role("menuitem", name="Français")
    expect(french_option).to_be_visible()
    print("French option found")
    french_option.click()
    print("French option clicked")

    # Wait for the language switch to apply
    time.sleep(2)  # Wait for 2 seconds

    # Now the aria-label should be in French
    expect(page.get_by_role("button", name="Changer de langue")).to_be_visible(timeout=10000)
    print("Language changed to French")

    # Take a screenshot to see the page state
    page.screenshot(path="jules-scratch/verification/verification.png")
    print("Screenshot taken")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)