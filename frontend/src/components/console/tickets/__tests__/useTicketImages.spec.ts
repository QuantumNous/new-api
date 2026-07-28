import { effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useTicketImages } from '@/components/console/tickets/useTicketImages'

describe('useTicketImages', () => {
  it('revokes object URLs when its effect scope is disposed', () => {
    const create = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:ticket')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const scope = effectScope()
    const images = scope.run(() => useTicketImages())
    if (!images) throw new Error('expected ticket image state')

    images.addFiles([new File(['image'], 'ticket.png', { type: 'image/png' })])
    expect(create).toHaveBeenCalledOnce()

    scope.stop()
    expect(revoke).toHaveBeenCalledWith('blob:ticket')
  })
})
