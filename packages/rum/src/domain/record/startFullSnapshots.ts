import { LifeCycleEventType, getScrollX, getScrollY, getViewportDimension } from '@datadog/browser-rum-core'
import type { RumConfiguration, LifeCycle } from '@datadog/browser-rum-core'
import type { RelativeTime } from '@datadog/browser-core'
import { clocksNow } from '@datadog/browser-core'
import type { BrowserRecord } from '../../types'
import { RecordType } from '../../types'
import type { ElementsScrollPositions } from './elementsScrollPositions'
import type { ShadowRootsController } from './shadowRootsController'
import { SerializationContextStatus, serializeDocument } from './serialization'
import { getVisualViewport } from './viewports'

export function startFullSnapshots(
  elementsScrollPositions: ElementsScrollPositions,
  shadowRootsController: ShadowRootsController,
  lifeCycle: LifeCycle,
  configuration: RumConfiguration,
  flushMutations: () => void,
  fullSnapshotCallback: (records: BrowserRecord[], startTime: RelativeTime) => void
) {
  const takeFullSnapshot = (
    startClocks = clocksNow(),
    serializationContext = {
      status: SerializationContextStatus.INITIAL_FULL_SNAPSHOT,
      elementsScrollPositions,
      shadowRootsController,
    }
  ) => {
    const { width, height } = getViewportDimension()
    const records: BrowserRecord[] = [
      {
        data: {
          height,
          href: window.location.href,
          width,
        },
        type: RecordType.Meta,
        timestamp: startClocks.timeStamp,
      },
      {
        data: {
          has_focus: document.hasFocus(),
        },
        type: RecordType.Focus,
        timestamp: startClocks.timeStamp,
      },
      {
        data: {
          node: serializeDocument(document, configuration, serializationContext),
          initialOffset: {
            left: getScrollX(),
            top: getScrollY(),
          },
        },
        type: RecordType.FullSnapshot,
        timestamp: startClocks.timeStamp,
      },
    ]

    if (window.visualViewport) {
      records.push({
        data: getVisualViewport(window.visualViewport),
        type: RecordType.VisualViewport,
        timestamp: startClocks.timeStamp,
      })
    }
    return records
  }

  const startClocks = clocksNow()
  fullSnapshotCallback(takeFullSnapshot(startClocks), startClocks.relative)

  const { unsubscribe } = lifeCycle.subscribe(LifeCycleEventType.VIEW_CREATED, (view) => {
    flushMutations()
    fullSnapshotCallback(
      takeFullSnapshot(view.startClocks, {
        shadowRootsController,
        status: SerializationContextStatus.SUBSEQUENT_FULL_SNAPSHOT,
        elementsScrollPositions,
      }),
      view.startClocks.relative
    )
  })

  return {
    stop: unsubscribe,
  }
}
