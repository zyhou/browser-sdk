import { setCookie, deleteCookie, getCurrentSite, getCookie } from '../../browser/cookie'
import type { InitConfiguration } from '../configuration'
import { SESSION_COOKIE_NAME, buildCookieOptions, initCookieStore } from './sessionCookieStore'

import type { SessionState, SessionStore } from './sessionStore'

describe('session cookie store', () => {
  const sessionState: SessionState = { id: '123', created: '0' }
  const initConfiguration: InitConfiguration = { clientToken: 'abc' }
  let cookieStorage: SessionStore | undefined

  beforeEach(() => {
    cookieStorage = initCookieStore(initConfiguration)
  })

  afterEach(() => {
    deleteCookie(SESSION_COOKIE_NAME)
  })

  it('should persist a session in a cookie', () => {
    cookieStorage?.persistSession(sessionState)
    const session = cookieStorage?.retrieveSession()
    expect(session).toEqual({ ...sessionState })
    expect(getCookie(SESSION_COOKIE_NAME)).toBe('id=123&created=0')
  })

  it('should delete the cookie holding the session', () => {
    cookieStorage?.persistSession(sessionState)
    cookieStorage?.clearSession()
    const session = cookieStorage?.retrieveSession()
    expect(session).toEqual({})
    expect(getCookie(SESSION_COOKIE_NAME)).toBeUndefined()
  })

  it('should return an empty object if session string is invalid', () => {
    setCookie(SESSION_COOKIE_NAME, '{test:42}', 1000)
    const session = cookieStorage?.retrieveSession()
    expect(session).toEqual({})
  })

  describe('build cookie options', () => {
    const clientToken = 'abc'

    it('should not be secure nor crossSite by default', () => {
      const cookieOptions = buildCookieOptions({ clientToken })!
      expect(cookieOptions).toEqual({ secure: false, crossSite: false })
    })

    it('should be secure when `useSecureSessionCookie` is truthy', () => {
      const cookieOptions = buildCookieOptions({ clientToken, useSecureSessionCookie: true })!
      expect(cookieOptions).toEqual({ secure: true, crossSite: false })
    })

    it('should be secure and crossSite when `useCrossSiteSessionCookie` is truthy', () => {
      const cookieOptions = buildCookieOptions({ clientToken, useCrossSiteSessionCookie: true })!
      expect(cookieOptions).toEqual({ secure: true, crossSite: true })
    })

    it('should have domain when `trackSessionAcrossSubdomains` is truthy', () => {
      const cookieOptions = buildCookieOptions({ clientToken, trackSessionAcrossSubdomains: true })!
      expect(cookieOptions).toEqual({ secure: false, crossSite: false, domain: jasmine.any(String) })
    })
  })

  describe('cookie options', () => {
    ;[
      {
        initConfiguration: { clientToken: 'abc' },
        cookieString: /^dd_cookie_test_[\w-]+=[^;]*;expires=[^;]+;path=\/;samesite=strict$/,
        description: 'should set samesite to strict by default',
      },
      {
        initConfiguration: { clientToken: 'abc', useCrossSiteSessionCookie: true },
        cookieString: /^dd_cookie_test_[\w-]+=[^;]*;expires=[^;]+;path=\/;samesite=none;secure$/,
        description: 'should set samesite to none and secure to true for crossSite',
      },
      {
        initConfiguration: { clientToken: 'abc', useSecureSessionCookie: true },
        cookieString: /^dd_cookie_test_[\w-]+=[^;]*;expires=[^;]+;path=\/;samesite=strict;secure$/,
        description: 'should add secure attribute when defined',
      },
      {
        initConfiguration: { clientToken: 'abc', trackSessionAcrossSubdomains: true },
        cookieString: new RegExp(
          `^dd_cookie_test_[\\w-]+=[^;]*;expires=[^;]+;path=\\/;samesite=strict;domain=${getCurrentSite()}$`
        ),
        description: 'should set cookie domain when tracking accross subdomains',
      },
    ].forEach(({ description, initConfiguration, cookieString }) => {
      it(description, () => {
        const cookieSetSpy = spyOnProperty(document, 'cookie', 'set')
        initCookieStore(initConfiguration)
        expect(cookieSetSpy.calls.argsFor(0)[0]).toMatch(cookieString)
      })
    })
  })
})
