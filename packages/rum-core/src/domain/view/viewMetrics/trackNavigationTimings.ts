import type { Duration, TimeoutId } from '@datadog/browser-core'
import { setTimeout, relativeNow, runOnReadyState, clearTimeout } from '@datadog/browser-core'
import type { RelativePerformanceTiming } from '../../../browser/performanceUtils'
import { computeRelativePerformanceTiming } from '../../../browser/performanceUtils'
import type { RumPerformanceNavigationTiming } from '../../../browser/performanceObservable'
import { RumPerformanceEntryType, supportPerformanceTimingEvent } from '../../../browser/performanceObservable'
import type { RumConfiguration } from '../../configuration'

export interface NavigationTimings {
  domComplete: Duration
  domContentLoaded: Duration
  domInteractive: Duration
  loadEvent: Duration
  firstByte: Duration | undefined
}

export function trackNavigationTimings(
  configuration: RumConfiguration,
  callback: (timings: NavigationTimings) => void
) {
  return waitAfterLoadEvent(configuration, () => {
    let entry: RumPerformanceNavigationTiming | RelativePerformanceTiming

    if (supportPerformanceTimingEvent(RumPerformanceEntryType.NAVIGATION)) {
      entry = performance.getEntriesByType(
        RumPerformanceEntryType.NAVIGATION
      )[0] as unknown as RumPerformanceNavigationTiming
    } else {
      entry = computeRelativePerformanceTiming()
    }

    if (!isIncompleteNavigation(entry)) {
      callback(processNavigationEntry(entry))
    }
  })
}

function processNavigationEntry(entry: RumPerformanceNavigationTiming | RelativePerformanceTiming): NavigationTimings {
  return {
    domComplete: entry.domComplete,
    domContentLoaded: entry.domContentLoadedEventEnd,
    domInteractive: entry.domInteractive,
    loadEvent: entry.loadEventEnd,
    // In some cases the value reported is negative or is larger
    // than the current page time. Ignore these cases:
    // https://github.com/GoogleChrome/web-vitals/issues/137
    // https://github.com/GoogleChrome/web-vitals/issues/162
    firstByte: entry.responseStart >= 0 && entry.responseStart <= relativeNow() ? entry.responseStart : undefined,
  }
}

function isIncompleteNavigation(entry: RumPerformanceNavigationTiming | RelativePerformanceTiming) {
  return entry.loadEventEnd <= 0
}

function waitAfterLoadEvent(configuration: RumConfiguration, callback: () => void) {
  let timeoutId: TimeoutId | undefined
  const { stop: stopOnReadyState } = runOnReadyState(configuration, 'complete', () => {
    // Invoke the callback a bit after the actual load event, so the "loadEventEnd" timing is accurate
    timeoutId = setTimeout(() => callback())
  })
  return {
    stop: () => {
      stopOnReadyState()
      clearTimeout(timeoutId)
    },
  }
}
