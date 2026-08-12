FROM node:22.23.2-bookworm-slim@sha256:f32b81066cde10a75dbac96646099533316d94bac4150c55da1636e1f0ffdc46

ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/opt/flatkey-browser-qa/ms-playwright \
    CHROMIUM_EXECUTABLE_PATH=/opt/flatkey-browser-qa/ms-playwright/chromium/chrome-linux64/chrome \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/opt/flatkey-browser-qa

ENV CHROMIUM_PATH=${CHROMIUM_EXECUTABLE_PATH}

WORKDIR /opt/flatkey-browser-qa

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        python3 \
        python3-venv \
    && rm -rf /var/lib/apt/lists/*

RUN npm install --omit=dev --prefix /opt/flatkey-browser-qa \
        @openai/codex@0.146.0 \
        @playwright/mcp@0.0.78 \
        playwright@1.62.0-alpha-1783623505000 \
        playwright-core@1.62.0-alpha-1783623505000 \
    && npx --no-install playwright install-deps chromium \
    && npx --no-install playwright install chromium \
    && chromium_dir="$(find /opt/flatkey-browser-qa/ms-playwright -maxdepth 1 -type d -name 'chromium-*' | sort | tail -n 1)" \
    && test -n "$chromium_dir" \
    && ln -s "$chromium_dir" /opt/flatkey-browser-qa/ms-playwright/chromium \
    && ln -s /opt/flatkey-browser-qa/node_modules/.bin/codex /usr/local/bin/codex \
    && ln -s /opt/flatkey-browser-qa/node_modules/.bin/playwright-mcp /usr/local/bin/playwright-mcp \
    && chmod -R a+rX /opt/flatkey-browser-qa/node_modules \
    && chmod -R a+rX /opt/flatkey-browser-qa/ms-playwright \
    && codex --version \
    && playwright-mcp --version

COPY scripts/browser_qa/flatkey_browser_qa scripts/browser_qa/flatkey_browser_qa
COPY scripts/browser_qa/config scripts/browser_qa/config
COPY scripts/browser_qa/fixed-cases scripts/browser_qa/fixed-cases
COPY scripts/browser_qa/tests scripts/browser_qa/tests
COPY .agents/skills/flatkey-new-user-onboarding/SKILL.md .agents/skills/flatkey-new-user-onboarding/SKILL.md
COPY .agents/skills/flatkey-new-user-onboarding/references .agents/skills/flatkey-new-user-onboarding/references
COPY .agents/skills/flatkey-new-user-onboarding/agents .agents/skills/flatkey-new-user-onboarding/agents
COPY .agents/skills/flatkey-new-user-onboarding/tests .agents/skills/flatkey-new-user-onboarding/tests
COPY --chmod=0755 scripts/browser_qa/entrypoint.sh /usr/local/bin/flatkey-browser-qa-entrypoint

RUN useradd --create-home --home-dir /home/flatkeyqa --shell /usr/sbin/nologin flatkeyqa \
    && ln -s /opt/flatkey-browser-qa/scripts/browser_qa/tests /opt/flatkey-browser-qa/tests \
    && chown -R flatkeyqa:flatkeyqa /opt/flatkey-browser-qa

USER flatkeyqa

ENTRYPOINT ["/usr/local/bin/flatkey-browser-qa-entrypoint"]
CMD ["main"]
