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
import { api } from '@/lib/api'

import type { DrawingRequest, ImageGenerationResponse } from './types'

export async function createDrawing(
  request: DrawingRequest
): Promise<ImageGenerationResponse> {
  if (!request.image) {
    const response = await api.post(
      '/pg/images/generations',
      {
        model: request.model,
        group: request.group,
        prompt: request.prompt,
        size: request.size,
        n: 1,
        response_format: 'b64_json',
      },
      { skipErrorHandler: true }
    )
    return response.data
  }

  const form = new FormData()
  form.append('model', request.model)
  form.append('group', request.group)
  form.append('prompt', request.prompt)
  form.append('size', request.size)
  form.append('n', '1')
  form.append('response_format', 'b64_json')
  form.append('image', request.image)

  const response = await api.post('/pg/images/edits', form, {
    skipErrorHandler: true,
  })
  return response.data
}
