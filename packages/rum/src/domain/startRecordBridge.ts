import type { RelativeTime, TimeStamp } from '@datadog/browser-core'
import { getEventBridge, getRelativeTime } from '@datadog/browser-core'
import type { ViewContexts } from '@datadog/browser-rum-core'
import type { BrowserRecord } from '../types'

export function startRecordBridge(viewContexts: ViewContexts) {
  const bridge = getEventBridge<'record', BrowserRecord>()!

  return {
    addRecord: (record: BrowserRecord, startTime?: RelativeTime) => {
      const relative = startTime ?? getRelativeTime(record.timestamp as TimeStamp)
      const view = viewContexts.findView(relative)!
      bridge.send('record', record, view.id)
    },
  }
}
