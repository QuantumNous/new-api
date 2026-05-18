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
import { Link } from '@tanstack/react-router'
import { HelpCircle, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { SectionPageLayout } from '@/components/layout'

/**
 * Help / FAQ page (PRD §7.10).
 *
 * Ten questions answering the things non-technical users actually ask
 * after signing up:
 *   1) what IS this
 *   2) where do I paste the key
 *   3) how is it billed
 *   4) what if I lose the key
 *   5) can I get a refund                 (V1: no, link to compliance)
 *   6) is my data safe
 *   7) when does my top-up land
 *   8) which payment methods work
 *   9) can I share the key across tools
 *  10) invoices for business
 *
 * Self-serve first — the goal is users find the answer without messaging
 * support. Contact info lives at the top in case the FAQ misses.
 */

type FaqEntry = {
  id: string
  question: string
  answer: string
}

const FAQS: FaqEntry[] = [
  {
    id: 'what-is-this',
    question: 'Is this a chat product? How do I start using AI after topping up?',
    answer:
      "No, DeepRouter is not a chat app. It's a single account + wallet that lets you call GPT, Claude, Gemini, DeepSeek and more from any AI tool you already use. After topping up, copy your API key from the Keys page and paste it into your AI tool's settings.",
  },
  {
    id: 'where-paste',
    question: 'Where should I paste my API key?',
    answer:
      'Into any AI tool that supports "OpenAI-compatible" API. Look for an "API Key" field in the tool\'s settings. We don\'t recommend specific tools — use whichever one you\'re already comfortable with.',
  },
  {
    id: 'how-billed',
    question: 'How is the billing calculated? How much does ¥1 get me?',
    answer:
      'Pay per use — every call shows the exact charge in your billing history. Roughly: ¥1 gives you ~6 万字 of Claude Sonnet, ~8 万字 of GPT-4o, or ~70 万字 of DeepSeek V3 (input). Actual cost depends on the model and conversation length.',
  },
  {
    id: 'lost-key',
    question: 'What if I lose my API key? Will I lose my balance?',
    answer:
      "No — your balance is safe. You can regenerate the key any time from the Keys page; the old one stops working immediately and the new one keeps your balance. Just remember to update the key in whatever AI tool you'd pasted it into.",
  },
  {
    id: 'refund',
    question: 'Can I get a refund for unused balance?',
    answer:
      "For now, top-ups aren't refundable — please top up only what you plan to use. We're working on a refund policy in the upcoming compliance release; until then, contact support if there's an exceptional issue.",
  },
  {
    id: 'data-safety',
    question: 'Data safety — can you see the content of my conversations?',
    answer:
      "We don't store prompt or response content in plain text. We only store token counts for billing. Your conversations pass through to the upstream model provider (OpenAI / Anthropic / etc.), whose own privacy policies apply.",
  },
  {
    id: 'topup-arrival',
    question: 'When does my top-up arrive?',
    answer:
      'WeChat Pay and Alipay typically credit your balance within seconds. If it takes more than 2 minutes, refresh the wallet page. If still not visible after 10 minutes, contact support with your transaction ID.',
  },
  {
    id: 'payment-methods',
    question: 'Which payment methods are supported?',
    answer:
      'WeChat Pay and Alipay (default) for personal users. Corporate bank transfer and monthly invoicing are planned for the business tier — contact support if you need them now.',
  },
  {
    id: 'multi-tool',
    question: 'Can I use the same key across multiple AI tools?',
    answer:
      'Yes — one key works for every AI tool you paste it into. All usage draws from the same balance and shows in one billing history. For team usage with separate quotas per user, hold tight — team accounts are coming in V2.',
  },
  {
    id: 'invoice',
    question: 'Can I get an invoice for company expense reporting?',
    answer:
      'Yes, business invoices are available. Click "Order History" on the wallet page and request an invoice for any settled top-up. We are an ICP-registered entity in mainland China; full corporate flow with electronic contracts comes in V2.',
  },
]

export function FaqPage() {
  const { t } = useTranslation()
  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Help & FAQ')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t(
          "Answers to the questions we hear most. Can't find yours? Check the contact details below."
        )}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        {/* Contact strip — surfaces support upfront so users with urgent
          * issues don't have to scroll the FAQ first. */}
        <div className='bg-muted/30 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm'>
          <div className='flex items-center gap-2'>
            <HelpCircle className='text-muted-foreground h-4 w-4' />
            <span className='text-foreground'>
              {t('Still stuck? Email support — we respond within 24h.')}
            </span>
            <a
              href='mailto:support@deeprouter.ai'
              className='text-foreground underline-offset-4 hover:underline'
            >
              support@deeprouter.ai
            </a>
          </div>
          <Button
            size='sm'
            variant='outline'
            render={
              <Link to='/wallet'>
                <Wallet className='h-4 w-4' />
                {t('Go to wallet')}
              </Link>
            }
          />
        </div>

        <Accordion className='space-y-1'>
          {FAQS.map((faq) => (
            <AccordionItem key={faq.id} value={faq.id}>
              <AccordionTrigger className='text-sm font-medium hover:no-underline'>
                {t(faq.question)}
              </AccordionTrigger>
              <AccordionContent className='text-muted-foreground text-sm leading-relaxed'>
                {t(faq.answer)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
