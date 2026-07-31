import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { submitContactSales, trackEvent } from '../api'
import type { Locale } from '../types'

const regionOptions: { value: string; en: string; zh: string }[] = [
  { value: 'na', en: 'North America', zh: '北美' },
  { value: 'eu', en: 'Europe', zh: '欧洲' },
  { value: 'sea', en: 'Southeast Asia', zh: '东南亚' },
  { value: 'cn', en: 'China', zh: '中国' },
  { value: 'other', en: 'Other', zh: '其他' },
]

const useCaseOptions: { value: string; en: string; zh: string }[] = [
  { value: 'dev', en: 'Individual developer', zh: '个人开发者' },
  { value: 'saas', en: 'SaaS team', zh: 'SaaS 团队' },
  { value: 'ecom', en: 'Cross-border commerce', zh: '跨境电商' },
  { value: 'reseller', en: 'AI reseller', zh: 'AI 分销商' },
  { value: 'other', en: 'Other', zh: '其他' },
]

interface FormState {
  name: string
  email: string
  company: string
  region: string
  use_case: string
  monthly_volume: string
  required_models: string
  message: string
}

const empty: FormState = {
  name: '',
  email: '',
  company: '',
  region: '',
  use_case: '',
  monthly_volume: '',
  required_models: '',
  message: '',
}

export function ContactForm({ locale }: { locale: Locale }) {
  const [form, setForm] = useState<FormState>(empty)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const t = (en: string, zh: string) => (locale === 'zh' ? zh : en)

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const validate = () => {
    if (!form.name.trim()) return t('Name is required', '请填写姓名')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return t('Valid email is required', '请填写有效邮箱')
    if (!form.region) return t('Region is required', '请选择地区')
    if (!form.use_case) return t('Use case is required', '请选择使用场景')
    return null
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const v = validate()
    if (v) {
      setError(v)
      return
    }
    setSubmitting(true)
    try {
      const res = await submitContactSales({
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim() || undefined,
        region: form.region,
        use_case: form.use_case,
        monthly_volume: form.monthly_volume.trim() || undefined,
        required_models: form.required_models.trim() || undefined,
        message: form.message.trim() || undefined,
      })
      if (res) {
        trackEvent('lead_submit')
        setDone(true)
        setForm(empty)
      } else {
        setError(t('Submission failed, please try again', '提交失败，请重试'))
      }
    } catch {
      setError(t('Submission failed, please try again', '提交失败，请重试'))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className='rounded-2xl border border-[#10B981]/30 bg-[#10B981]/10 p-8 text-center'>
        <h3 className='text-lg font-semibold text-[#10B981]'>
          {t('Thank you!', '谢谢！')}
        </h3>
        <p className='mt-2 text-sm text-[#94A3B8]'>
          {t('We received your request and will contact you soon.', '我们已收到您的需求，将尽快与您联系。')}
        </p>
        <Button
          className='mt-6 border border-white/20 bg-transparent text-foreground'
          onClick={() => setDone(false)}
        >
          {t('Submit another', '再提交一份')}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className='space-y-4'>
      <div className='grid gap-4 sm:grid-cols-2'>
        <Input
          placeholder={t('Name *', '姓名 *')}
          value={form.name}
          onChange={set('name')}
        />
        <Input
          type='email'
          placeholder={t('Work Email *', '工作邮箱 *')}
          value={form.email}
          onChange={set('email')}
        />
      </div>
      <Input
        placeholder={t('Company', '公司')}
        value={form.company}
        onChange={set('company')}
      />
      <div className='grid gap-4 sm:grid-cols-2'>
        <Select value={form.region} onValueChange={(v) => setForm((f) => ({ ...f, region: v }))}>
          <SelectTrigger>
            <SelectValue placeholder={t('Region *', '地区 *')} />
          </SelectTrigger>
          <SelectContent>
            {regionOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {locale === 'zh' ? o.zh : o.en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={form.use_case} onValueChange={(v) => setForm((f) => ({ ...f, use_case: v }))}>
          <SelectTrigger>
            <SelectValue placeholder={t('Use Case *', '使用场景 *')} />
          </SelectTrigger>
          <SelectContent>
            {useCaseOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {locale === 'zh' ? o.zh : o.en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Input
        placeholder={t('Estimated monthly volume', '预估月调用量')}
        value={form.monthly_volume}
        onChange={set('monthly_volume')}
      />
      <Input
        placeholder={t('Required models', '需要的模型类型')}
        value={form.required_models}
        onChange={set('required_models')}
      />
      <Textarea
        placeholder={t('Message', '补充说明')}
        value={form.message}
        onChange={set('message')}
        rows={4}
      />
      {error && <p className='text-sm text-red-400'>{error}</p>}
      <Button
        type='submit'
        disabled={submitting}
        className='w-full bg-gradient-to-r from-[#4F8CFF] to-[#8B5CF6] text-white border-0'
      >
        {submitting ? t('Submitting…', '提交中…') : t('Submit', '提交')}
      </Button>
    </form>
  )
}
