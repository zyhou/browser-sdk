import type { Duration, RelativeTime } from '@datadog/browser-core'
import type { Clock } from '@datadog/browser-core/test'
import { mockClock, registerCleanupTask } from '@datadog/browser-core/test'
import type { RumPerformanceNavigationTiming } from '../../../browser/performanceObservable'
import { RumPerformanceEntryType } from '../../../browser/performanceObservable'
import {
  createPerformanceEntry,
  mockDocumentReadyState,
  mockGlobalPerformanceBuffer,
  mockPerformanceTiming,
} from '../../../../test'
import type { RumConfiguration } from '../../configuration'
import type { NavigationTimings } from './trackNavigationTimings'
import { trackNavigationTimings } from './trackNavigationTimings'

describe('trackNavigationTimings', () => {
  let navigationTimingsCallback: jasmine.Spy<(timings: NavigationTimings) => void>
  let performanceNavigationTiming: RumPerformanceNavigationTiming
  let stop: () => void
  let clock: Clock

  function removePerformanceObserver() {
    const originalPerformanceObserver = window.PerformanceObserver
    window.PerformanceObserver = undefined as any

    registerCleanupTask(() => {
      window.PerformanceObserver = originalPerformanceObserver
    })
  }

  beforeEach(() => {
    navigationTimingsCallback = jasmine.createSpy()

    performanceNavigationTiming = createPerformanceEntry(RumPerformanceEntryType.NAVIGATION)
    mockGlobalPerformanceBuffer([performanceNavigationTiming])

    clock = mockClock(new Date(0))
    // Make sure `relativeNow()` is after the mocked response start
    clock.tick(performanceNavigationTiming.responseStart)

    registerCleanupTask(() => {
      clock.cleanup()
      stop()
    })
  })

  it('should provide navigation timing', () => {
    const { triggerOnLoad } = mockDocumentReadyState()

    ;({ stop } = trackNavigationTimings({} as RumConfiguration, navigationTimingsCallback))

    triggerOnLoad()
    clock.tick(0)

    expect(navigationTimingsCallback).toHaveBeenCalledOnceWith({
      firstByte: 123 as Duration,
      domComplete: 456 as Duration,
      domContentLoaded: 345 as Duration,
      domInteractive: 234 as Duration,
      loadEvent: 567 as Duration,
    })
  })

  it('should wait for the load event to provide navigation timing', () => {
    mockDocumentReadyState()
    ;({ stop } = trackNavigationTimings({} as RumConfiguration, navigationTimingsCallback))

    clock.tick(0)

    expect(navigationTimingsCallback).not.toHaveBeenCalled()
  })

  it('should discard incomplete navigation timing', () => {
    performanceNavigationTiming.loadEventEnd = 0 as RelativeTime
    const { triggerOnLoad } = mockDocumentReadyState()

    ;({ stop } = trackNavigationTimings({} as RumConfiguration, navigationTimingsCallback))

    triggerOnLoad()
    clock.tick(0)

    expect(navigationTimingsCallback).not.toHaveBeenCalled()
  })

  it('should provide navigation timing when navigation timing is not supported ', () => {
    removePerformanceObserver()
    mockPerformanceTiming()
    const { triggerOnLoad } = mockDocumentReadyState()

    ;({ stop } = trackNavigationTimings({} as RumConfiguration, navigationTimingsCallback))

    triggerOnLoad()
    clock.tick(0)

    expect(navigationTimingsCallback).toHaveBeenCalledOnceWith({
      firstByte: 123 as Duration,
      domComplete: 456 as Duration,
      domContentLoaded: 345 as Duration,
      domInteractive: 234 as Duration,
      loadEvent: 567 as Duration,
    })
  })
})
