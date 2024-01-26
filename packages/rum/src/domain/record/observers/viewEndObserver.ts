import type { ListenerHandler, RelativeTime } from '@datadog/browser-core'
import type { LifeCycle } from '@datadog/browser-rum-core'
import { LifeCycleEventType } from '@datadog/browser-rum-core'
import type { ViewEndRecord } from '../../../types'
import { RecordType } from '../../../types'

export type ViewEndCallback = (record: ViewEndRecord, startTime: RelativeTime) => void

export function initViewEndObserver(lifeCycle: LifeCycle, viewEndCb: ViewEndCallback): ListenerHandler {
  return lifeCycle.subscribe(LifeCycleEventType.VIEW_ENDED, ({ endClocks }) => {
    viewEndCb(
      {
        timestamp: endClocks.timeStamp,
        type: RecordType.ViewEnd,
      },
      endClocks.relative
    )
  }).unsubscribe
}
