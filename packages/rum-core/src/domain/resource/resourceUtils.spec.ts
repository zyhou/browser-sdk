import { ExperimentalFeature, type Duration, type RelativeTime, type ServerDuration } from '@datadog/browser-core'
import { SPEC_ENDPOINTS, mockExperimentalFeatures } from '@datadog/browser-core/test'
import { RumPerformanceEntryType, type RumPerformanceResourceTiming } from '../../browser/performanceCollection'
import type { RumConfiguration } from '../configuration'
import { validateAndBuildRumConfiguration } from '../configuration'
import {
  computePerformanceResourceDetails,
  computePerformanceResourceDuration,
  computeResourceKind,
  isAllowedRequestUrl,
  findDataUrlAndTruncate,
} from './resourceUtils'

function generateResourceWith(overrides: Partial<RumPerformanceResourceTiming>) {
  const completeTiming: Partial<RumPerformanceResourceTiming> = {
    connectEnd: 17 as RelativeTime,
    connectStart: 15 as RelativeTime,
    domainLookupEnd: 14 as RelativeTime,
    domainLookupStart: 13 as RelativeTime,
    duration: 50 as Duration,
    entryType: RumPerformanceEntryType.RESOURCE,
    fetchStart: 12 as RelativeTime,
    name: 'entry',
    redirectEnd: 11 as RelativeTime,
    redirectStart: 10 as RelativeTime,
    requestStart: 20 as RelativeTime,
    responseEnd: 60 as RelativeTime,
    responseStart: 50 as RelativeTime,
    secureConnectionStart: 16 as RelativeTime,
    startTime: 10 as RelativeTime,
    ...overrides,
  }
  return completeTiming as RumPerformanceResourceTiming
}

describe('computeResourceKind', () => {
  ;[
    {
      description: 'file extension with query params',
      expected: 'js',
      name: 'http://localhost/test.js?from=foo.css',
    },
    {
      description: 'css extension',
      expected: 'css',
      name: 'http://localhost/test.css',
    },
    {
      description: 'image initiator',
      expected: 'image',
      initiatorType: 'img',
      name: 'http://localhost/test',
    },
    {
      description: 'image extension',
      expected: 'image',
      name: 'http://localhost/test.jpg',
    },
  ].forEach(
    ({
      description,
      name,
      initiatorType,
      expected,
    }: {
      description: string
      name: string
      initiatorType?: string
      expected: string
    }) => {
      it(`should compute resource kind: ${description}`, () => {
        const entry = generateResourceWith({ initiatorType, name })
        expect(computeResourceKind(entry)).toEqual(expected)
      })
    }
  )
})

describe('computePerformanceResourceDetails', () => {
  it('should not compute entry without detailed timings', () => {
    expect(
      computePerformanceResourceDetails(
        generateResourceWith({
          connectEnd: 0 as RelativeTime,
          connectStart: 0 as RelativeTime,
          domainLookupEnd: 0 as RelativeTime,
          domainLookupStart: 0 as RelativeTime,
          redirectEnd: 0 as RelativeTime,
          redirectStart: 0 as RelativeTime,
          requestStart: 0 as RelativeTime,
          responseStart: 0 as RelativeTime,
          secureConnectionStart: 0 as RelativeTime,
        })
      )
    ).toBeUndefined()
  })

  it('should compute timings from entry', () => {
    expect(computePerformanceResourceDetails(generateResourceWith({}))).toEqual({
      connect: { start: 5e6 as ServerDuration, duration: 2e6 as ServerDuration },
      dns: { start: 3e6 as ServerDuration, duration: 1e6 as ServerDuration },
      download: { start: 40e6 as ServerDuration, duration: 10e6 as ServerDuration },
      first_byte: { start: 10e6 as ServerDuration, duration: 30e6 as ServerDuration },
      redirect: { start: 0 as ServerDuration, duration: 1e6 as ServerDuration },
      ssl: { start: 6e6 as ServerDuration, duration: 1e6 as ServerDuration },
    })
  })

  it('should not compute redirect timing when no redirect', () => {
    expect(
      computePerformanceResourceDetails(
        generateResourceWith({
          fetchStart: 10 as RelativeTime,
          redirectEnd: 0 as RelativeTime,
          redirectStart: 0 as RelativeTime,
        })
      )
    ).toEqual({
      connect: { start: 5e6 as ServerDuration, duration: 2e6 as ServerDuration },
      dns: { start: 3e6 as ServerDuration, duration: 1e6 as ServerDuration },
      download: { start: 40e6 as ServerDuration, duration: 10e6 as ServerDuration },
      first_byte: { start: 10e6 as ServerDuration, duration: 30e6 as ServerDuration },
      ssl: { start: 6e6 as ServerDuration, duration: 1e6 as ServerDuration },
    })
  })

  it('should not compute dns timing when persistent connection or cache', () => {
    expect(
      computePerformanceResourceDetails(
        generateResourceWith({
          domainLookupEnd: 12 as RelativeTime,
          domainLookupStart: 12 as RelativeTime,
          fetchStart: 12 as RelativeTime,
        })
      )
    ).toEqual({
      connect: { start: 5e6 as ServerDuration, duration: 2e6 as ServerDuration },
      download: { start: 40e6 as ServerDuration, duration: 10e6 as ServerDuration },
      first_byte: { start: 10e6 as ServerDuration, duration: 30e6 as ServerDuration },
      redirect: { start: 0 as ServerDuration, duration: 1e6 as ServerDuration },
      ssl: { start: 6e6 as ServerDuration, duration: 1e6 as ServerDuration },
    })
  })

  it('should not compute ssl timing when no secure connection', () => {
    expect(
      computePerformanceResourceDetails(
        generateResourceWith({
          secureConnectionStart: 0 as RelativeTime,
        })
      )
    ).toEqual({
      connect: { start: 5e6 as ServerDuration, duration: 2e6 as ServerDuration },
      dns: { start: 3e6 as ServerDuration, duration: 1e6 as ServerDuration },
      download: { start: 40e6 as ServerDuration, duration: 10e6 as ServerDuration },
      first_byte: { start: 10e6 as ServerDuration, duration: 30e6 as ServerDuration },
      redirect: { start: 0 as ServerDuration, duration: 1e6 as ServerDuration },
    })
  })

  it('should not compute ssl timing when persistent connection', () => {
    expect(
      computePerformanceResourceDetails(
        generateResourceWith({
          connectEnd: 12 as RelativeTime,
          connectStart: 12 as RelativeTime,
          domainLookupEnd: 12 as RelativeTime,
          domainLookupStart: 12 as RelativeTime,
          fetchStart: 12 as RelativeTime,
          secureConnectionStart: 12 as RelativeTime,
        })
      )
    ).toEqual({
      download: { start: 40e6 as ServerDuration, duration: 10e6 as ServerDuration },
      first_byte: { start: 10e6 as ServerDuration, duration: 30e6 as ServerDuration },
      redirect: { start: 0 as ServerDuration, duration: 1e6 as ServerDuration },
    })
  })

  it('should not compute connect timing when persistent connection', () => {
    expect(
      computePerformanceResourceDetails(
        generateResourceWith({
          connectEnd: 12 as RelativeTime,
          connectStart: 12 as RelativeTime,
          domainLookupEnd: 12 as RelativeTime,
          domainLookupStart: 12 as RelativeTime,
          fetchStart: 12 as RelativeTime,
          secureConnectionStart: 0 as RelativeTime,
        })
      )
    ).toEqual({
      download: { start: 40e6 as ServerDuration, duration: 10e6 as ServerDuration },
      first_byte: { start: 10e6 as ServerDuration, duration: 30e6 as ServerDuration },
      redirect: { start: 0 as ServerDuration, duration: 1e6 as ServerDuration },
    })
  })
  ;[
    {
      timing: 'connect' as const,
      reason: 'connectStart > connectEnd',
      connectEnd: 10 as RelativeTime,
      connectStart: 20 as RelativeTime,
    },
    {
      timing: 'dns' as const,
      reason: 'domainLookupStart > domainLookupEnd',
      domainLookupEnd: 10 as RelativeTime,
      domainLookupStart: 20 as RelativeTime,
    },
    {
      timing: 'download' as const,
      reason: 'responseStart > responseEnd',
      responseEnd: 10 as RelativeTime,
      responseStart: 20 as RelativeTime,
    },
    {
      timing: 'first_byte' as const,
      reason: 'requestStart > responseStart',
      requestStart: 20 as RelativeTime,
      responseStart: 10 as RelativeTime,
    },
    {
      timing: 'redirect' as const,
      reason: 'redirectStart > redirectEnd',
      redirectEnd: 15 as RelativeTime,
      redirectStart: 20 as RelativeTime,
    },
    {
      timing: 'ssl' as const,
      connectEnd: 10 as RelativeTime,
      reason: 'secureConnectionStart > connectEnd',
      secureConnectionStart: 20 as RelativeTime,
    },
    {
      connectEnd: 10 as RelativeTime,
      connectStart: -3 as RelativeTime,
      fetchStart: 10 as RelativeTime,
      reason: 'negative timing start',
    },
  ].forEach(({ reason, timing, ...overrides }) => {
    it(`[without tolerant-resource-timings] should not compute entry when ${reason}`, () => {
      expect(computePerformanceResourceDetails(generateResourceWith(overrides))).toBeUndefined()
    })

    if (timing) {
      it(`[with tolerant-resource-timings] should not include the '${timing}' timing when ${reason}`, () => {
        mockExperimentalFeatures([ExperimentalFeature.TOLERANT_RESOURCE_TIMINGS])
        expect(computePerformanceResourceDetails(generateResourceWith(overrides))![timing]).toBeUndefined()
      })
    }
  })

  it('should allow really fast document resource', () => {
    expect(
      computePerformanceResourceDetails(
        generateResourceWith({
          connectEnd: 10 as RelativeTime,
          connectStart: 10 as RelativeTime,
          domainLookupEnd: 10 as RelativeTime,
          domainLookupStart: 10 as RelativeTime,
          fetchStart: 10 as RelativeTime,
          redirectEnd: 0 as RelativeTime,
          redirectStart: 0 as RelativeTime,
          requestStart: 10 as RelativeTime,
          responseEnd: 50 as RelativeTime,
          responseStart: 40 as RelativeTime,
          secureConnectionStart: 0 as RelativeTime,
        })
      )
    ).toEqual({
      download: { start: 30e6 as ServerDuration, duration: 10e6 as ServerDuration },
      first_byte: { start: 0 as ServerDuration, duration: 30e6 as ServerDuration },
    })
  })
})

describe('computePerformanceResourceDuration', () => {
  it('should return the entry duration', () => {
    expect(computePerformanceResourceDuration(generateResourceWith({}))).toBe(50e6 as ServerDuration)
  })

  it('should use other available timing if the duration is 0', () => {
    expect(computePerformanceResourceDuration(generateResourceWith({ duration: 0 as Duration }))).toBe(
      50e6 as ServerDuration
    )
  })
})

describe('shouldTrackResource', () => {
  let configuration: RumConfiguration

  beforeEach(() => {
    configuration = {
      ...validateAndBuildRumConfiguration({ clientToken: 'xxx', applicationId: 'xxx' })!,
      ...SPEC_ENDPOINTS,
    }
  })

  it('should exclude requests on intakes endpoints', () => {
    expect(isAllowedRequestUrl(configuration, 'https://rum-intake.com/v1/input/abcde?foo=bar')).toBe(false)
  })

  it('should exclude requests on intakes endpoints with different client parameters', () => {
    expect(isAllowedRequestUrl(configuration, 'https://rum-intake.com/v1/input/wxyz?foo=qux')).toBe(false)
  })

  it('should allow requests on non intake domains', () => {
    expect(isAllowedRequestUrl(configuration, 'https://my-domain.com/hello?a=b')).toBe(true)
  })
})

describe('findDataUrlAndTruncate', () => {
  it('returns truncated url when detects data url of json', () => {
    const expectedUrl = 'data:text/json'
    expect(
      findDataUrlAndTruncate(
        'data:text/json; charset=utf-8,%7B%22data%22%3A%7B%22type%22%3A%22notebooks%22%2C%22attributes%22%3A%7B%22metadata%22%3A%7B'
      )
    ).toEqual(expectedUrl)
  })

  it('returns truncated url when detects data url of html', () => {
    const expectedUrl = 'data:text/html'
    expect(findDataUrlAndTruncate('data:text/html,%3Ch1%3EHello%2C%20World%21%3C%2Fh1%3E')).toEqual(expectedUrl)
  })

  it('returns truncated url when detects data url of image', () => {
    const expectedUrl = 'data:image/svg+xml;base64'
    expect(findDataUrlAndTruncate('data:image/svg+xml;base64,+DQo8L3N2Zz4=')).toEqual(expectedUrl)
  })
  it('returns truncated url when detects plain data url', () => {
    const expectedUrl = 'data:'
    expect(findDataUrlAndTruncate('data:,Hello%2C%20World%21')).toEqual(expectedUrl)
  })

  it('returns null when no data url found', () => {
    const nonDataUrl = 'https://static.datad0g.com/static/c/70086/chunk.min.js'
    expect(findDataUrlAndTruncate(nonDataUrl)).toBeNull()
  })
})
