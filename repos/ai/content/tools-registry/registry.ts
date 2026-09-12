// CONTRIBUTING GUIDE
// https://github.com/vercel/ai/blob/main/contributing/add-new-tool-to-registry.md

export interface Tool {
  slug: string;
  name: string;
  description: string;
  packageName: string;
  tags?: string[];
  apiKeyEnvName?: string;
  installCommand: {
    pnpm: string;
    npm: string;
    yarn: string;
    bun: string;
  };
  codeExample: string;
  docsUrl?: string;
  apiKeyUrl?: string;
  websiteUrl?: string;
  npmUrl?: string;
}

export const tools: Tool[] = [
  {
    slug: 'code-execution',
    name: 'Code Execution',
    description:
      'Execute Python code in a sandboxed environment using Vercel Sandbox. Run calculations, data processing, and other computational tasks safely in an isolated environment with Python 3.13.',
    packageName: 'ai-sdk-tool-code-execution',
    tags: ['code-execution', 'sandbox'],
    apiKeyEnvName: 'VERCEL_OIDC_TOKEN',
    installCommand: {
      pnpm: 'pnpm add ai-sdk-tool-code-execution',
      npm: 'npm install ai-sdk-tool-code-execution',
      yarn: 'yarn add ai-sdk-tool-code-execution',
      bun: 'bun add ai-sdk-tool-code-execution',
    },
    codeExample: `import { generateText, isStepCount } from 'ai';
import { executeCode } from 'ai-sdk-tool-code-execution';

const { text } = await generateText({
  model: 'openai/gpt-5.1-codex',
  prompt: 'What is 5 + 5 minus 84 cubed?',
  tools: {
    executeCode: executeCode(),
  },
  stopWhen: isStepCount(5),
});

console.log(text);`,
    docsUrl: 'https://vercel.com/docs/vercel-sandbox',
    apiKeyUrl: 'https://vercel.com/docs/vercel-sandbox#authentication',
    websiteUrl: 'https://vercel.com/docs/vercel-sandbox',
    npmUrl: 'https://www.npmjs.com/package/ai-sdk-tool-code-execution',
  },
  {
    slug: 'exa',
    name: 'Exa',
    description:
      'Exa is a web search API that adds web search capabilities to your LLMs. Exa can search the web for code docs, current information, news, articles, and a lot more. Exa performs real-time web searches and can get page content from specific URLs. Add Exa web search tool to your LLMs in just a few lines of code.',
    packageName: '@exalabs/ai-sdk',
    tags: ['search', 'web', 'extraction'],
    apiKeyEnvName: 'EXA_API_KEY',
    installCommand: {
      pnpm: 'pnpm add @exalabs/ai-sdk',
      npm: 'npm install @exalabs/ai-sdk',
      yarn: 'yarn add @exalabs/ai-sdk',
      bun: 'bun add @exalabs/ai-sdk',
    },
    codeExample: `import { generateText, isStepCount } from 'ai';
import { webSearch } from '@exalabs/ai-sdk';

const { text } = await generateText({
  model: 'google/gemini-3-pro-preview',
  prompt: 'Tell me the latest developments in AI',
  tools: {
    webSearch: webSearch(),
  },
  stopWhen: isStepCount(3),
});

console.log(text);`,
    docsUrl: 'https://docs.exa.ai/reference/vercel',
    apiKeyUrl: 'https://dashboard.exa.ai/api-keys',
    websiteUrl: 'https://exa.ai',
    npmUrl: 'https://www.npmjs.com/package/@exalabs/ai-sdk',
  },
  {
    slug: 'parallel',
    name: 'Parallel',
    description:
      'Parallel gives AI agents best-in-class tools to search and extract context from the web. Web results returned by Parallel are compressed for optimal token efficiency at inference time.',
    packageName: '@parallel-web/ai-sdk-tools',
    tags: ['search', 'web', 'extraction'],
    apiKeyEnvName: 'PARALLEL_API_KEY',
    installCommand: {
      pnpm: 'pnpm add @parallel-web/ai-sdk-tools',
      npm: 'npm install @parallel-web/ai-sdk-tools',
      yarn: 'yarn add @parallel-web/ai-sdk-tools',
      bun: 'bun add @parallel-web/ai-sdk-tools',
    },
    codeExample: `import { generateText, isStepCount } from 'ai';
import { searchTool, extractTool } from '@parallel-web/ai-sdk-tools';

const { text } = await generateText({
  model: 'google/gemini-3-pro-preview',
  prompt: 'When was Vercel Ship AI?',
  tools: {
    webSearch: searchTool,
    webExtract: extractTool,
  },
  stopWhen: isStepCount(3),
});

console.log(text);`,
    apiKeyUrl: 'https://platform.parallel.ai',
    websiteUrl: 'https://parallel.ai',
    npmUrl: 'https://www.npmjs.com/package/@parallel-web/ai-sdk-tools',
  },
  {
    slug: 'ctx-zip',
    name: 'ctx-zip',
    description:
      'Transform MCP tools and AI SDK tools into code, write it to a Vercel sandbox file system and have the agent import the tools, write code, and execute it.',
    packageName: 'ctx-zip',
    tags: ['code-execution', 'sandbox', 'mcp', 'code-mode'],
    apiKeyEnvName: 'VERCEL_OIDC_TOKEN',
    installCommand: {
      pnpm: 'pnpm add ctx-zip',
      npm: 'npm install ctx-zip',
      yarn: 'yarn add ctx-zip',
      bun: 'bun add ctx-zip',
    },
    codeExample: `import { generateText, isStepCount } from 'ai';
import { createVercelSandboxCodeMode, SANDBOX_SYSTEM_PROMPT } from 'ctx-zip';

const { tools } = await createVercelSandboxCodeMode({
  servers: [
    {
      name: 'vercel',
      url: 'https://mcp.vercel.com',
      useSSE: false,
      headers: {
        Authorization: \`Bearer \${process.env.VERCEL_API_KEY}\`,
      },
    },
  ],
  standardTools: {
    weather: weatherTool,
  },
});

const { text } = await generateText({
  model: 'openai/gpt-5.2',
  tools,
  stopWhen: isStepCount(20),
  system: SANDBOX_SYSTEM_PROMPT,
  messages: [
    {
      role: 'user',
      content: 'What tools are available from the Vercel MCP server?',
    },
  ],
});

console.log(text);
`,
    docsUrl: 'https://github.com/karthikscale3/ctx-zip/blob/main/README.md',
    apiKeyUrl: 'https://vercel.com/docs/vercel-sandbox#authentication',
    websiteUrl: 'https://github.com/karthikscale3/ctx-zip/blob/main/README.md',
    npmUrl: 'https://www.npmjs.com/package/ctx-zip',
  },
  {
    slug: 'perplexity-search',
    name: 'Perplexity Search',
    description:
      "Search the web with real-time results and advanced filtering powered by Perplexity's Search API. Provides ranked search results with domain, language, date range, and recency filters. Supports multi-query searches and regional search results.",
    packageName: '@perplexity-ai/ai-sdk',
    tags: ['search', 'web'],
    apiKeyEnvName: 'PERPLEXITY_API_KEY',
    installCommand: {
      pnpm: 'pnpm add @perplexity-ai/ai-sdk',
      npm: 'npm install @perplexity-ai/ai-sdk',
      yarn: 'yarn add @perplexity-ai/ai-sdk',
      bun: 'bun add @perplexity-ai/ai-sdk',
    },
    codeExample: `import { generateText, isStepCount } from 'ai';
import { perplexitySearch } from '@perplexity-ai/ai-sdk';

const { text } = await generateText({
  model: 'openai/gpt-5.2',
  prompt: 'What are the latest AI developments? Use search to find current information.',
  tools: {
    search: perplexitySearch(),
  },
  stopWhen: isStepCount(3),
});

console.log(text);`,
    docsUrl: 'https://docs.perplexity.ai/guides/search-quickstart',
    apiKeyUrl: 'https://www.perplexity.ai/account/api/keys',
    websiteUrl: 'https://www.perplexity.ai',
    npmUrl: 'https://www.npmjs.com/package/@perplexity-ai/ai-sdk',
  },
  {
    slug: 'tavily',
    name: 'Tavily',
    description:
      'Tavily is a web intelligence platform offering real-time web search optimized for AI applications. Tavily provides comprehensive web research capabilities including search, content extraction, website crawling, and site mapping to power AI agents with current information.',
    packageName: '@tavily/ai-sdk',
    tags: ['search', 'extract', 'crawl'],
    apiKeyEnvName: 'TAVILY_API_KEY',
    installCommand: {
      pnpm: 'pnpm add @tavily/ai-sdk',
      npm: 'npm install @tavily/ai-sdk',
      yarn: 'yarn add @tavily/ai-sdk',
      bun: 'bun add @tavily/ai-sdk',
    },
    codeExample: `import { generateText, isStepCount } from 'ai';
import { tavilySearch } from '@tavily/ai-sdk';

const { text } = await generateText({
  model: 'google/gemini-3-pro-preview',
  prompt: 'What are the latest developments in agentic search?',
  tools: {
    webSearch: tavilySearch,
  },
  stopWhen: isStepCount(3),
});

console.log(text);`,
    docsUrl: 'https://docs.tavily.com/documentation/integrations/vercel',
    apiKeyUrl: 'https://app.tavily.com/home',
    websiteUrl: 'https://tavily.com',
    npmUrl: 'https://www.npmjs.com/package/@tavily/ai-sdk',
  },
  {
    slug: 'firecrawl',
    name: 'Firecrawl',
    description:
      'Firecrawl tools for the AI SDK. Web scraping, search, crawling, and data extraction for AI applications. Scrape any website into clean markdown, search the web, crawl entire sites, and extract structured data.',
    packageName: 'firecrawl-aisdk',
    tags: ['scraping', 'search', 'crawling', 'extraction', 'web'],
    apiKeyEnvName: 'FIRECRAWL_API_KEY',
    installCommand: {
      pnpm: 'pnpm add firecrawl-aisdk',
      npm: 'npm install firecrawl-aisdk',
      yarn: 'yarn add firecrawl-aisdk',
      bun: 'bun add firecrawl-aisdk',
    },
    codeExample: `import { generateText, isStepCount } from 'ai';
import { scrapeTool } from 'firecrawl-aisdk';

const { text } = await generateText({
  model: 'openai/gpt-5-mini',
  prompt: 'Scrape https://firecrawl.dev and summarize what it does',
  tools: {
    scrape: scrapeTool,
  },
  stopWhen: isStepCount(3),
});

console.log(text);`,
    docsUrl: 'https://docs.firecrawl.dev/integrations/ai-sdk',
    apiKeyUrl: 'https://firecrawl.dev/app/api-keys',
    websiteUrl: 'https://firecrawl.dev',
    npmUrl: 'https://www.npmjs.com/package/firecrawl-aisdk',
  },
  {
    slug: 'bedrock-agentcore',
    name: 'Amazon Bedrock AgentCore',
    description:
      'Fully managed Browser and Code Interpreter tools for AI agents. Browser is a fast and secure cloud-based runtime for interacting with web applications, filling forms, navigating websites, and extracting information. Code Interpreter provides an isolated sandbox for executing Python, JavaScript, and TypeScript code to solve complex tasks.',
    packageName: 'bedrock-agentcore',
    tags: ['code-execution', 'browser-automation', 'sandbox'],
    apiKeyEnvName: 'AWS_ROLE_ARN',
    installCommand: {
      pnpm: 'pnpm add bedrock-agentcore',
      npm: 'npm install bedrock-agentcore',
      yarn: 'yarn add bedrock-agentcore',
      bun: 'bun add bedrock-agentcore',
    },
    codeExample: `import { generateText, isStepCount } from 'ai';
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider';
import { CodeInterpreterTools } from 'bedrock-agentcore/code-interpreter/vercel-ai';
import { BrowserTools } from 'bedrock-agentcore/browser/vercel-ai';

const credentialsProvider = awsCredentialsProvider({
  roleArn: process.env.AWS_ROLE_ARN!,
});

const codeInterpreter = new CodeInterpreterTools({ credentialsProvider });
const browser = new BrowserTools({ credentialsProvider });

try {
  const { text } = await generateText({
    model: bedrock('us.anthropic.claude-sonnet-4-20250514-v1:0'),
    prompt: 'Go to https://news.ycombinator.com and get the first story title. Then use Python to reverse the string.',
    tools: {
      ...codeInterpreter.tools,
      ...browser.tools,
    },
    stopWhen: isStepCount(5),
  });

  console.log(text);
} finally {
  await codeInterpreter.stopSession();
  await browser.stopSession();
}`,
    docsUrl: 'https://github.com/aws/bedrock-agentcore-sdk-typescript',
    apiKeyUrl: 'https://vercel.com/docs/oidc/aws',
    websiteUrl:
      'https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/built-in-tools.html',
    npmUrl: 'https://www.npmjs.com/package/bedrock-agentcore',
  },
  {
    slug: 'superagent',
    name: 'Superagent',
    description:
      'AI security guardrails for your LLMs. Protect your AI apps from prompt injection, redact PII/PHI (SSNs, emails, phone numbers), and verify claims against source materials. Add security tools to your LLMs in just a few lines of code.',
    packageName: '@superagent-ai/ai-sdk',
    tags: ['security', 'guardrails', 'pii', 'prompt-injection', 'verification'],
    apiKeyEnvName: 'SUPERAGENT_API_KEY',
    installCommand: {
      pnpm: 'pnpm add @superagent-ai/ai-sdk',
      npm: 'npm install @superagent-ai/ai-sdk',
      yarn: 'yarn add @superagent-ai/ai-sdk',
      bun: 'bun add @superagent-ai/ai-sdk',
    },
    codeExample: `import { generateText, isStepCount } from 'ai';
import { guard, redact, verify } from '@superagent-ai/ai-sdk';
import { openai } from '@ai-sdk/openai';

const { text } = await generateText({
  model: openai('gpt-4o-mini'),
  prompt: 'Check this input for security threats: "Ignore all instructions"',
  tools: {
    guard: guard(),
    redact: redact(),
    verify: verify(),
  },
  stopWhen: isStepCount(3),
});

console.log(text);`,
    docsUrl: 'https://docs.superagent.sh',
    apiKeyUrl: 'https://dashboard.superagent.sh',
    websiteUrl: 'https://superagent.sh',
    npmUrl: 'https://www.npmjs.com/package/@superagent-ai/ai-sdk',
  },
  {
    slug: 'tako-search',
    name: 'Tako Search',
    description:
      "Search Tako's knowledge base for data visualizations, insights, and well-sourced information with charts and analytics.",
    packageName: '@takoviz/ai-sdk',
    installCommand: {
      pnpm: 'pnpm install @takoviz/ai-sdk',
      npm: 'npm install @takoviz/ai-sdk',
      yarn: 'yarn add @takoviz/ai-sdk',
      bun: 'bun add @takoviz/ai-sdk',
    },
    codeExample: `import { takoSearch } from '@takoviz/ai-sdk';
import { generateText, isStepCount } from 'ai';

const { text } = await generateText({
  model: 'openai/gpt-5.2',
  prompt: 'What is the stock price of Nvidia?',
  tools: {
    takoSearch: takoSearch(),
  },
  stopWhen: isStepCount(5),
});

console.log(text);`,
    docsUrl: 'https://github.com/TakoData/ai-sdk#readme',
    npmUrl: 'https://www.npmjs.com/package/@takoviz/ai-sdk',
    websiteUrl: 'https://tako.com',
    apiKeyEnvName: 'TAKO_API_KEY',
    apiKeyUrl: 'https://tako.com',
    tags: ['search', 'data', 'visualization', 'analytics'],
  },
  {
    slug: 'valyu',
    name: 'Valyu',
    description:
      'Valyu provides powerful search tools for AI agents. Web search for real-time information, plus specialized domain-specific searchtools: financeSearch (stock prices, earnings, income statements, cash flows, etc), paperSearch (full-text PubMed, arXiv, bioRxiv, medRxiv), bioSearch (clinical trials, FDA drug labels, PubMed, medRxiv, bioRxiv), patentSearch (USPTO patents), secSearch (10-k/10-Q/8-k), economicsSearch (BLS, FRED, World Bank data), and companyResearch (comprehensive company research reports).',
    packageName: '@valyu/ai-sdk',
    tags: ['search', 'web', 'domain-search'],
    apiKeyEnvName: 'VALYU_API_KEY',
    installCommand: {
      pnpm: 'pnpm add @valyu/ai-sdk',
      npm: 'npm install @valyu/ai-sdk',
      yarn: 'yarn add @valyu/ai-sdk',
      bun: 'bun add @valyu/ai-sdk',
    },
    codeExample: `import { generateText, isStepCount } from 'ai';
import { webSearch } from '@valyu/ai-sdk';
// Available specialised search tools: financeSearch, paperSearch,
// bioSearch, patentSearch, secSearch, economicsSearch, companyResearch

const { text } = await generateText({
  model: 'google/gemini-3-pro-preview',
  prompt: 'Latest data center projects for AI inference?',
  tools: {
    webSearch: webSearch(),
  },
  stopWhen: isStepCount(3),
});

console.log(text);`,
    docsUrl: 'https://docs.valyu.ai/integrations/vercel-ai-sdk',
    apiKeyUrl: 'https://platform.valyu.ai',
    websiteUrl: 'https://valyu.ai',
    npmUrl: 'https://www.npmjs.com/package/@valyu/ai-sdk',
  },
  {
    slug: 'airweave',
    name: 'Airweave',
    description:
      'Airweave is an open-source platform that makes any app searchable for your agent. Sync and search across 35+ data sources (Notion, Slack, Google Drive, databases, and more) with semantic search. Add unified search across all your connected data to your AI applications in just a few lines of code.',
    packageName: '@airweave/vercel-ai-sdk',
    tags: ['search', 'rag', 'data-sources', 'semantic-search'],
    apiKeyEnvName: 'AIRWEAVE_API_KEY',
    installCommand: {
      pnpm: 'pnpm install @airweave/vercel-ai-sdk',
      npm: 'npm install @airweave/vercel-ai-sdk',
      yarn: 'yarn add @airweave/vercel-ai-sdk',
      bun: 'bun add @airweave/vercel-ai-sdk',
    },
    codeExample: `import { generateText, isStepCount } from 'ai';
import { airweaveSearch } from '@airweave/vercel-ai-sdk';

const { text } = await generateText({
  model: 'anthropic/claude-sonnet-4.5',
  prompt: 'What were the key decisions from last week?',
  tools: {
    search: airweaveSearch({
      defaultCollection: 'my-knowledge-base',
    }),
  },
  stopWhen: isStepCount(3),
});

console.log(text);`,
    docsUrl: 'https://docs.airweave.ai',
    apiKeyUrl: 'https://app.airweave.ai/settings/api-keys',
    websiteUrl: 'https://airweave.ai',
    npmUrl: 'https://www.npmjs.com/package/@airweave/vercel-ai-sdk',
  },
  {
    slug: 'bash-tool',
    name: 'bash-tool',
    description:
      'Provides bash, readFile, and writeFile tools for AI agents. Supports @vercel/sandbox for full VM isolation.',
    packageName: 'bash-tool',
    tags: ['bash', 'file-system', 'sandbox', 'code-execution'],
    installCommand: {
      pnpm: 'pnpm install bash-tool',
      npm: 'npm install bash-tool',
      yarn: 'yarn add bash-tool',
      bun: 'bun add bash-tool',
    },
    codeExample: `import { generateText, isStepCount } from 'ai';
import { createBashTool } from 'bash-tool';

const { tools } = await createBashTool({
  files: { 'src/index.ts': "export const hello = 'world';" },
});

const { text } = await generateText({
  model: 'anthropic/claude-sonnet-4',
  prompt: 'List the files in src/ and show me the contents of index.ts',
  tools,
  stopWhen: isStepCount(5),
});

console.log(text);`,
    docsUrl: 'https://github.com/vercel/bash-tool',
    websiteUrl: 'https://github.com/vercel/bash-tool',
    npmUrl: 'https://www.npmjs.com/package/bash-tool',
  },
  {
    slug: 'browserbase',
    name: 'Browserbase',
    description:
      'Browserbase provides browser automation tools for AI agents powered by Stagehand. Navigate websites, take screenshots, click buttons, fill forms, extract structured data, and execute multi-step browser tasks in cloud-hosted sessions with built-in CAPTCHA solving and anti-bot stealth mode.',
    packageName: '@browserbasehq/ai-sdk',
    tags: ['browser', 'browser-automation', 'web', 'extraction'],
    apiKeyEnvName: 'BROWSERBASE_API_KEY',
    installCommand: {
      pnpm: 'pnpm add @browserbasehq/ai-sdk',
      npm: 'npm install @browserbasehq/ai-sdk',
      yarn: 'yarn add @browserbasehq/ai-sdk',
      bun: 'bun add @browserbasehq/ai-sdk',
    },
    codeExample: `import { generateText, isStepCount } from 'ai';
import { createBrowserbaseTools } from '@browserbasehq/ai-sdk';

const browserbase = createBrowserbaseTools();

const { text } = await generateText({
  model: 'google/gemini-3-pro-preview',
  tools: browserbase.tools,
  stopWhen: isStepCount(10),
  prompt: 'Open https://news.ycombinator.com and summarize the top 3 stories.',
});

console.log(text);
await browserbase.closeSession();`,
    docsUrl: 'https://docs.browserbase.com',
    apiKeyUrl: 'https://www.browserbase.com/settings',
    websiteUrl: 'https://www.browserbase.com',
    npmUrl: 'https://www.npmjs.com/package/@browserbasehq/ai-sdk',
  },
  {
    slug: 'you-search',
    name: 'You.com',
    description:
      "Real-time web search, deep research with cited sources, and webpage content extraction powered by You.com. Search current information with advanced filtering (dates, sites, file types), research topics with configurable effort (lite to exhaustive), and extract full page content in markdown or HTML. Built on You.com's enterprise search API with zero server setup.",
    packageName: '@youdotcom-oss/ai-sdk-plugin',
    tags: ['search', 'web', 'extraction', 'research'],
    apiKeyEnvName: 'YDC_API_KEY',
    installCommand: {
      pnpm: 'pnpm add @youdotcom-oss/ai-sdk-plugin',
      npm: 'npm install @youdotcom-oss/ai-sdk-plugin',
      yarn: 'yarn add @youdotcom-oss/ai-sdk-plugin',
      bun: 'bun add @youdotcom-oss/ai-sdk-plugin',
    },
    codeExample: `import { generateText, isStepCount } from 'ai';
import { youSearch, youResearch, youContents } from '@youdotcom-oss/ai-sdk-plugin';

const { text } = await generateText({
  model: 'anthropic/claude-sonnet-4-5-20250929',
  prompt: 'Research the latest developments in quantum computing',
  tools: {
    search: youSearch(),
    research: youResearch(),
    extract: youContents(),
  },
  stopWhen: isStepCount(5),
});

console.log(text);`,
    docsUrl:
      'https://github.com/youdotcom-oss/dx-toolkit/tree/main/packages/ai-sdk-plugin#readme',
    apiKeyUrl: 'https://you.com/platform/api-keys',
    websiteUrl: 'https://you.com',
    npmUrl: 'https://www.npmjs.com/package/@youdotcom-oss/ai-sdk-plugin',
  },
  {
    slug: 'nitrosend',
    name: 'Nitrosend',
    description:
      'Nitrosend tools for Vercel AI SDK agents — send email and SMS, manage contacts and segments, build flows, run campaigns. Backed by the Nitrosend remote MCP server.',
    packageName: '@nitrosend/ai-sdk',
    tags: ['email', 'sms', 'marketing', 'mcp', 'automation', 'crm'],
    apiKeyEnvName: 'NITROSEND_API_KEY',
    installCommand: {
      pnpm: 'pnpm add @nitrosend/ai-sdk ai @ai-sdk/mcp zod @ai-sdk/openai',
      npm: 'npm install @nitrosend/ai-sdk ai @ai-sdk/mcp zod @ai-sdk/openai',
      yarn: 'yarn add @nitrosend/ai-sdk ai @ai-sdk/mcp zod @ai-sdk/openai',
      bun: 'bun add @nitrosend/ai-sdk ai @ai-sdk/mcp zod @ai-sdk/openai',
    },
    codeExample: `import { generateText, isStepCount } from 'ai';
import { openai } from '@ai-sdk/openai';
import { withNitrosendTools } from '@nitrosend/ai-sdk';

const result = await withNitrosendTools({}, async ({ tools }) => {
  return generateText({
    model: openai('gpt-4o'),
    tools,
    stopWhen: isStepCount(5),
    prompt: 'Send a welcome email to founder@acme.com from our team.',
  });
});

console.log(result.text);`,
    docsUrl: 'https://docs.nitrosend.com/integrations/vercel-ai-sdk',
    apiKeyUrl: 'https://app.nitrosend.com/settings/api-keys',
    websiteUrl: 'https://nitrosend.com',
    npmUrl: 'https://www.npmjs.com/package/@nitrosend/ai-sdk',
  },
];
