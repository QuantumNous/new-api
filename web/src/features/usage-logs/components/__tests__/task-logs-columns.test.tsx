/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import { render, screen } from '@testing-library/react'
import type React from 'react'
import { describe, expect, test } from 'vitest'

import { TASK_ACTIONS, TASK_STATUS } from '../../constants'
import type { TaskLog } from '../../types'
import { useTaskLogsColumns } from '../columns/task-logs-columns'

function DetailsCellProbe({ log }: { log: TaskLog }) {
  const detailsColumn = useTaskLogsColumns(false).find(
    (column) => 'accessorKey' in column && column.accessorKey === 'fail_reason'
  )
  if (!detailsColumn || typeof detailsColumn.cell !== 'function') {
    throw new Error('Details column is unavailable')
  }

  const row = {
    original: log,
    getValue: () => log.fail_reason,
  }
  return detailsColumn.cell({ row } as never) as React.ReactNode
}

describe('task log details', () => {
  test('previews a successful video when result_url is populated', () => {
    render(
      <DetailsCellProbe
        log={{
          id: 1,
          user_id: 1,
          platform: 'kling',
          task_id: 'task_issue_6993',
          action: TASK_ACTIONS.GENERATE,
          channel_id: 1,
          submit_time: 1,
          status: TASK_STATUS.SUCCESS,
          fail_reason: '',
          result_url: 'https://example.com/video.mp4',
        }}
      />
    )

    expect(
      screen.getByRole('link', { name: 'Click to preview video' })
    ).toHaveAttribute('href', '/v1/videos/task_issue_6993/content')
  })

  test('keeps preview compatibility for legacy result URLs in fail_reason', () => {
    render(
      <DetailsCellProbe
        log={{
          id: 2,
          user_id: 1,
          platform: 'kling',
          task_id: 'task_legacy_video',
          action: TASK_ACTIONS.GENERATE,
          channel_id: 1,
          submit_time: 1,
          status: TASK_STATUS.SUCCESS,
          fail_reason: 'https://example.com/legacy-video.mp4',
        }}
      />
    )

    expect(
      screen.getByRole('link', { name: 'Click to preview video' })
    ).toHaveAttribute('href', '/v1/videos/task_legacy_video/content')
  })
})
