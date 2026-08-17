import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TicketReplyBox from '@/components/console/tickets/TicketReplyBox.vue'
import i18n from '@/i18n'

describe('TicketReplyBox', () => {
  it('keeps the draft after submit until the parent confirms success', async () => {
    const wrapper = mount(TicketReplyBox, {
      global: {
        plugins: [i18n],
        stubs: {
          TicketImageUploader: true,
        },
      },
    })
    const textarea = wrapper.get('textarea')

    await textarea.setValue('  Please keep this draft  ')
    await wrapper
      .get('button[type="submit"], button:last-child')
      .trigger('click')

    expect(wrapper.emitted('submit')).toEqual([
      [{ content: 'Please keep this draft', attachments: [] }],
    ])
    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      '  Please keep this draft  '
    )

    wrapper.vm.reset()
    await wrapper.vm.$nextTick()

    expect((textarea.element as HTMLTextAreaElement).value).toBe('')
  })
})
