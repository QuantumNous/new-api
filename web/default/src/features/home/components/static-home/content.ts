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
import {
  Activity,
  BadgeCheck,
  Bell,
  BookOpen,
  Bot,
  ChartNoAxesColumn,
  CircleDollarSign,
  Code2,
  Copy,
  Gift,
  Globe2,
  Grid2X2,
  Headphones,
  Layers3,
  Link2,
  Mail,
  Network,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react'

export const DOCS_URL = 'https://docs.aiapi114.com'
export const API_BASE_URL = 'https://aiapi114.com'
export const SUPPORT_URL = 'https://t.me/aiapi114kf'
export const SUPPORT_EMAIL = 'support@aiapi114.com'

export const homeNavLinks = [
  { labelKey: 'home.static.nav.home', href: '#top' },
  { labelKey: 'home.static.nav.console', href: '/console' },
  { labelKey: 'home.static.nav.docs', href: DOCS_URL },
  { labelKey: 'home.static.nav.models', href: '#models', disabled: true },
  { labelKey: 'home.static.nav.invite', href: '#invite', disabled: true },
  { labelKey: 'home.static.nav.about', href: '#footer', disabled: true },
] as const

export const heroFeatures = [
  {
    icon: Link2,
    titleKey: 'home.static.hero.feature.stable.title',
    textKey: 'home.static.hero.feature.stable.text',
  },
  {
    icon: Send,
    titleKey: 'home.static.hero.feature.fast.title',
    textKey: 'home.static.hero.feature.fast.text',
  },
  {
    icon: CircleDollarSign,
    titleKey: 'home.static.hero.feature.price.title',
    textKey: 'home.static.hero.feature.price.text',
  },
  {
    icon: Bell,
    titleKey: 'home.static.hero.feature.security.title',
    textKey: 'home.static.hero.feature.security.text',
  },
] as const

export const whyCards = [
  {
    icon: Bot,
    titleKey: 'home.static.why.models.title',
    lines: [
      'home.static.why.models.line1',
      'home.static.why.models.line2',
    ],
  },
  {
    icon: Route,
    titleKey: 'home.static.why.api.title',
    lines: ['home.static.why.api.line1', 'home.static.why.api.line2'],
  },
  {
    icon: BadgeCheck,
    titleKey: 'home.static.why.price.title',
    lines: ['home.static.why.price.line1', 'home.static.why.price.line2'],
  },
  {
    icon: ShieldCheck,
    titleKey: 'home.static.why.reliable.title',
    lines: [
      'home.static.why.reliable.line1',
      'home.static.why.reliable.line2',
    ],
  },
] as const

export const endpointCards = [
  {
    labelKey: 'home.static.endpoint.api',
    value: API_BASE_URL,
    copyLabelKey: 'home.static.endpoint.copyApi',
  },
  {
    labelKey: 'home.static.endpoint.docs',
    value: DOCS_URL,
    copyLabelKey: 'home.static.endpoint.copyDocs',
  },
] as const

export const developerFeatures = [
  {
    icon: Code2,
    titleKey: 'home.static.developer.openai.title',
    textKey: 'home.static.developer.openai.text',
  },
  {
    icon: Grid2X2,
    titleKey: 'home.static.developer.languages.title',
    textKey: 'home.static.developer.languages.text',
  },
  {
    icon: BookOpen,
    titleKey: 'home.static.developer.docs.title',
    textKey: 'home.static.developer.docs.text',
  },
  {
    icon: ChartNoAxesColumn,
    titleKey: 'home.static.developer.monitor.title',
    textKey: 'home.static.developer.monitor.text',
  },
] as const

export const codeExamples = {
  curl: `curl https://aiapi114.com/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      { "role": "user", "content": "Hello!" }
    ]
  }'`,
  python: `from openai import OpenAI

client = OpenAI(
    base_url="https://aiapi114.com/v1",
    api_key="YOUR_API_KEY",
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)`,
  javascript: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://aiapi114.com/v1",
  apiKey: "YOUR_API_KEY",
});

const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(response.choices[0].message.content);`,
  go: `package main

import (
  "context"
  "fmt"
  "os"

  "github.com/sashabaranov/go-openai"
)

func main() {
  config := openai.DefaultConfig(os.Getenv("YOUR_API_KEY"))
  config.BaseURL = "https://aiapi114.com/v1"
  client := openai.NewClientWithConfig(config)

  resp, _ := client.CreateChatCompletion(
    context.Background(),
    openai.ChatCompletionRequest{
      Model: "gpt-4o",
      Messages: []openai.ChatCompletionMessage{
        {Role: "user", Content: "Hello!"},
      },
    },
  )

  fmt.Println(resp.Choices[0].Message.Content)
}`,
  java: `import com.theokanning.openai.service.OpenAiService;
import com.theokanning.openai.completion.chat.ChatCompletionRequest;
import com.theokanning.openai.completion.chat.ChatMessage;

import java.util.List;

public class Main {
  public static void main(String[] args) {
    OpenAiService service = new OpenAiService("YOUR_API_KEY", "https://aiapi114.com/v1");

    ChatCompletionRequest request = ChatCompletionRequest.builder()
        .model("gpt-4o")
        .messages(List.of(new ChatMessage("user", "Hello!")))
        .build();

    System.out.println(service.createChatCompletion(request));
  }
}`,
} as const

export type CodeExampleKey = keyof typeof codeExamples

export const pricingCards = [
  {
    featured: true,
    badgeKey: 'home.static.pricing.recommended',
    priceVariant: 'split',
    titleKey: 'home.static.pricing.developer.title',
    priceKey: 'home.static.pricing.developer.price',
    summaryKey: 'home.static.pricing.developer.summary',
    features: [
      'home.static.pricing.developer.f1',
      'home.static.pricing.developer.f2',
      'home.static.pricing.developer.f3',
      'home.static.pricing.developer.f4',
    ],
    ctaKey: 'home.static.pricing.useNow',
    href: '/sign-up',
  },
  {
    priceVariant: 'text',
    priceTone: 'neutral',
    titleKey: 'home.static.pricing.gateway.title',
    priceKey: 'home.static.pricing.gateway.price',
    features: [
      'home.static.pricing.gateway.f1',
      'home.static.pricing.gateway.f2',
      'home.static.pricing.gateway.f3',
      'home.static.pricing.gateway.f4',
    ],
    ctaKey: 'home.static.pricing.viewDocs',
    href: DOCS_URL,
  },
  {
    priceVariant: 'text',
    priceTone: 'neutral',
    titleKey: 'home.static.pricing.enterprise.title',
    priceKey: 'home.static.pricing.enterprise.price',
    features: [
      'home.static.pricing.enterprise.f1',
      'home.static.pricing.enterprise.f2',
      'home.static.pricing.enterprise.f3',
      'home.static.pricing.enterprise.f4',
    ],
    ctaKey: 'home.static.pricing.contact',
    href: SUPPORT_URL,
    external: true,
  },
] as const

export const metrics = [
  {
    icon: Users,
    value: '50,000+',
    labelKey: 'home.static.metrics.developers',
  },
  {
    icon: Activity,
    valueKey: 'home.static.metrics.callsValue',
    labelKey: 'home.static.metrics.calls',
  },
  {
    icon: Zap,
    value: '99.9%',
    labelKey: 'home.static.metrics.uptime',
  },
  {
    icon: Layers3,
    value: '25+',
    labelKey: 'home.static.metrics.models',
  },
] as const

export const supportCards = [
  {
    icon: Send,
    titleKey: 'home.static.support.telegram.title',
    text: '@aiapi114kf',
    href: SUPPORT_URL,
  },
  {
    icon: Gift,
    titleKey: 'home.static.support.invite.title',
    textKey: 'home.static.support.invite.text',
  },
] as const

export const homeModelShowcase = [
  {
    availability: 99.9,
    brand: 'Anthropic',
    healthLabel: 'up',
    latency: 132,
    logoClass: 'static-home__model-logo--claude',
    logoText: '✳',
    model: 'claude-sonnet-4-6-thinking',
  },
  {
    availability: 99.9,
    brand: 'OpenAI',
    healthLabel: 'up',
    latency: 118,
    logoClass: 'static-home__model-logo--openai',
    logoText: '◎',
    model: 'gpt-5.4',
  },
  {
    availability: 99.2,
    brand: 'Google',
    healthLabel: 'degraded',
    latency: 248,
    logoClass: 'static-home__model-logo--gemini',
    logoText: '✦',
    model: 'gemini-3.1-pro-preview',
  },
  {
    availability: 99.8,
    brand: 'OpenAI',
    healthLabel: 'up',
    latency: 121,
    logoClass: 'static-home__model-logo--openai',
    logoText: '◎',
    model: 'gpt-5.2',
  },
  {
    availability: 99.7,
    brand: 'Anthropic',
    healthLabel: 'up',
    latency: 156,
    logoClass: 'static-home__model-logo--claude',
    logoText: '✳',
    model: 'claude-opus-4-7-thinking',
  },
  {
    availability: 99.6,
    brand: 'OpenAI',
    healthLabel: 'up',
    latency: 210,
    logoClass: 'static-home__model-logo--openai',
    logoText: '◎',
    model: 'gpt-image-2',
  },
  {
    availability: 99.5,
    brand: 'Google',
    healthLabel: 'up',
    latency: 184,
    logoClass: 'static-home__model-logo--gemini',
    logoText: '✦',
    model: 'gemini-3.1-flash-image-preview',
  },
  {
    availability: 99.4,
    brand: 'ByteDance',
    healthLabel: 'up',
    latency: 226,
    logoClass: 'static-home__model-logo--seedream',
    logoText: '◓',
    model: 'seedream-4-5-251128',
  },
] as const

export const footerColumns = [
  {
    titleKey: 'home.static.footer.product',
    links: [
      { labelKey: 'home.static.nav.console', href: '/console' },
      { labelKey: 'home.static.nav.pricing', href: '#pricing' },
    ],
  },
  {
    titleKey: 'home.static.footer.support',
    links: [
      { labelKey: 'home.static.footer.docs', href: DOCS_URL },
      { labelKey: 'home.static.footer.apiRef', href: `${DOCS_URL}/#api-reference` },
      { labelKey: 'home.static.footer.faq', href: `${DOCS_URL}/#faq` },
    ],
  },
  {
    titleKey: 'home.static.footer.resources',
    links: [
      {
        labelKey: 'home.static.footer.integration',
        href: `${DOCS_URL}/#integration-guide`,
      },
    ],
  },
  {
    titleKey: 'home.static.footer.community',
    links: [
      {
        labelKey: 'home.static.footer.telegram',
        href: SUPPORT_URL,
        external: true,
      },
    ],
  },
] as const

export const heroOrbitItems = [
  { icon: Network, className: 'home-hero-orbit-item--top-left' },
  { icon: Grid2X2, className: 'home-hero-orbit-item--top-right' },
  { icon: Globe2, className: 'home-hero-orbit-item--bottom-left' },
  { icon: Sparkles, className: 'home-hero-orbit-item--bottom-right' },
] as const

export const footerSocials = [
  { icon: Mail, href: `mailto:${SUPPORT_EMAIL}`, labelKey: 'home.static.footer.mail' },
  { icon: Send, href: SUPPORT_URL, labelKey: 'home.static.footer.telegram' },
] as const

export const CopyIcon = Copy
export const HeadsetIcon = Headphones
