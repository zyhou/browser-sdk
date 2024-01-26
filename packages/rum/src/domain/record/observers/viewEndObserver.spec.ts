import { LifeCycle, LifeCycleEventType } from '@datadog/browser-rum-core'
import { clocksNow } from '@datadog/browser-core'
import { RecordType } from '../../../types'
import type { ViewEndCallback } from './viewEndObserver'
import { initViewEndObserver } from './viewEndObserver'

describe('initMoveObserver', () => {
  let lifeCycle: LifeCycle
  let viewEndCb: jasmine.Spy<ViewEndCallback>
  let stopObserver: () => void

  beforeEach(() => {
    lifeCycle = new LifeCycle()
    viewEndCb = jasmine.createSpy()
    stopObserver = initViewEndObserver(lifeCycle, viewEndCb)
  })

  afterEach(() => {
    stopObserver()
  })

  it('should generate view end record', () => {
    const clock = clocksNow()
    lifeCycle.notify(LifeCycleEventType.VIEW_ENDED, { endClocks: clock } as any)

    expect(viewEndCb).toHaveBeenCalledWith(
      {
        timestamp: clock.timeStamp,
        type: RecordType.ViewEnd,
      },
      clock.relative
    )
  })
})
