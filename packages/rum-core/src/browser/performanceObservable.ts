import type { Duration, RelativeTime } from '@datadog/browser-core'
import { addEventListener, Observable } from '@datadog/browser-core'
import type { RumConfiguration } from '../domain/configuration'
import { isAllowedRequestUrl } from '../domain/resource/resourceUtils'

type RumPerformanceObserverConstructor = new (callback: PerformanceObserverCallback) => RumPerformanceObserver

export interface BrowserWindow extends Window {
  PerformanceObserver: RumPerformanceObserverConstructor
  performance: Performance & { interactionCount?: number }
}

export interface RumPerformanceObserver extends PerformanceObserver {
  observe(options?: PerformanceObserverInit & { durationThreshold: number }): void
}

// We want to use a real enum (i.e. not a const enum) here, to be able to check whether an arbitrary
// string is an expected performance entry
// eslint-disable-next-line no-restricted-syntax
export enum RumPerformanceEntryType {
  EVENT = 'event',
  FIRST_INPUT = 'first-input',
  LARGEST_CONTENTFUL_PAINT = 'largest-contentful-paint',
  LAYOUT_SHIFT = 'layout-shift',
  LONG_TASK = 'longtask',
  NAVIGATION = 'navigation',
  PAINT = 'paint',
  RESOURCE = 'resource',
}

export interface RumPerformanceLongTaskTiming {
  name: string
  entryType: RumPerformanceEntryType.LONG_TASK
  startTime: RelativeTime
  duration: Duration
  toJSON(): Omit<PerformanceEntry, 'toJSON'>
}

export interface RumPerformanceResourceTiming {
  entryType: RumPerformanceEntryType.RESOURCE
  initiatorType: string
  responseStatus?: number
  name: string
  startTime: RelativeTime
  duration: Duration
  fetchStart: RelativeTime
  domainLookupStart: RelativeTime
  domainLookupEnd: RelativeTime
  connectStart: RelativeTime
  secureConnectionStart: RelativeTime
  connectEnd: RelativeTime
  requestStart: RelativeTime
  responseStart: RelativeTime
  responseEnd: RelativeTime
  redirectStart: RelativeTime
  redirectEnd: RelativeTime
  decodedBodySize: number
  encodedBodySize: number
  transferSize: number
  renderBlockingStatus?: string
  traceId?: string
  toJSON(): Omit<PerformanceEntry, 'toJSON'>
}

export interface RumPerformancePaintTiming {
  entryType: RumPerformanceEntryType.PAINT
  name: 'first-paint' | 'first-contentful-paint'
  startTime: RelativeTime
}

export interface RumPerformanceNavigationTiming {
  entryType: RumPerformanceEntryType.NAVIGATION
  domComplete: RelativeTime
  domContentLoadedEventEnd: RelativeTime
  domInteractive: RelativeTime
  loadEventEnd: RelativeTime
  responseStart: RelativeTime
}

export interface RumLargestContentfulPaintTiming {
  entryType: RumPerformanceEntryType.LARGEST_CONTENTFUL_PAINT
  startTime: RelativeTime
  size: number
  element?: Element
  toJSON(): Omit<RumLargestContentfulPaintTiming, 'toJSON'>
}

export interface RumFirstInputTiming {
  entryType: RumPerformanceEntryType.FIRST_INPUT
  startTime: RelativeTime
  processingStart: RelativeTime
  processingEnd: RelativeTime
  duration: Duration
  target?: Node
  interactionId?: number
  name: string
}

export interface RumPerformanceEventTiming {
  entryType: RumPerformanceEntryType.EVENT
  startTime: RelativeTime
  processingStart: RelativeTime
  processingEnd: RelativeTime
  duration: Duration
  interactionId?: number
  target?: Node
  name: string
}

export interface RumLayoutShiftTiming {
  entryType: RumPerformanceEntryType.LAYOUT_SHIFT
  startTime: RelativeTime
  value: number
  hadRecentInput: boolean
  sources?: Array<{
    node?: Node
  }>
}

export type RumPerformanceEntry =
  | RumPerformanceResourceTiming
  | RumPerformanceLongTaskTiming
  | RumPerformancePaintTiming
  | RumPerformanceNavigationTiming
  | RumLargestContentfulPaintTiming
  | RumFirstInputTiming
  | RumPerformanceEventTiming
  | RumLayoutShiftTiming

export type EntryTypeToReturnType = {
  [RumPerformanceEntryType.EVENT]: RumPerformanceEventTiming
  [RumPerformanceEntryType.FIRST_INPUT]: RumFirstInputTiming
  [RumPerformanceEntryType.LARGEST_CONTENTFUL_PAINT]: RumLargestContentfulPaintTiming
  [RumPerformanceEntryType.LAYOUT_SHIFT]: RumLayoutShiftTiming
  [RumPerformanceEntryType.PAINT]: RumPerformancePaintTiming
  [RumPerformanceEntryType.LONG_TASK]: RumPerformanceLongTaskTiming
  [RumPerformanceEntryType.NAVIGATION]: RumPerformanceNavigationTiming
  [RumPerformanceEntryType.RESOURCE]: RumPerformanceResourceTiming
}

export function createPerformanceObservable<T extends RumPerformanceEntryType>(
  configuration: RumConfiguration,
  options: { type: T; buffered?: boolean; durationThreshold?: number }
) {
  return new Observable<Array<EntryTypeToReturnType[T]>>((observable) => {
    const cleanupTasks: Array<() => void> = []

    const observeEntries = (options?: PerformanceObserverInit & { durationThreshold?: number }) => {
      const observer = new PerformanceObserver((entries) => {
        const rumResourceEntries = handleRumPerformanceEntries(
          configuration,
          entries.getEntries() as Array<EntryTypeToReturnType[T]>
        )
        if (rumResourceEntries.length > 0) {
          observable.notify(rumResourceEntries)
        }
      })
      observer.observe(options)
      cleanupTasks.push(() => observer.disconnect())
    }

    if (window.PerformanceObserver) {
      try {
        observeEntries(options)
      } catch {
        observeEntries({ entryTypes: [options.type] })
      }
    }

    cleanupTasks.push(manageResourceTimingBufferFull(configuration))

    return () => {
      cleanupTasks.forEach((task) => task())
    }
  })
}

let resourceTimingBufferFullListener: () => void | undefined
function manageResourceTimingBufferFull(configuration: RumConfiguration) {
  if (!resourceTimingBufferFullListener && supportPerformanceObject() && 'addEventListener' in performance) {
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1559377
    resourceTimingBufferFullListener = addEventListener(configuration, performance, 'resourcetimingbufferfull', () => {
      performance.clearResourceTimings()
    }).stop
  }
  return resourceTimingBufferFullListener
}

function supportPerformanceObject() {
  return window.performance !== undefined && 'getEntries' in performance
}

export function supportPerformanceTimingEvent(entryType: RumPerformanceEntryType) {
  return (
    window.PerformanceObserver &&
    PerformanceObserver.supportedEntryTypes !== undefined &&
    PerformanceObserver.supportedEntryTypes.includes(entryType)
  )
}

function handleRumPerformanceEntries<T extends RumPerformanceEntryType>(
  configuration: RumConfiguration,
  entries: Array<EntryTypeToReturnType[T]>
) {
  return entries.filter((entry) => isAllowedResource(configuration, entry))
}

function isAllowedResource(configuration: RumConfiguration, entry: RumPerformanceEntry) {
  return entry.entryType === RumPerformanceEntryType.RESOURCE && isAllowedRequestUrl(configuration, entry.name)
}