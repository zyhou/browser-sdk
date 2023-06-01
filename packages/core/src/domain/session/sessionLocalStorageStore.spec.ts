import { LOCAL_STORAGE_KEY, initLocalStorage } from './sessionLocalStorageStore'
import type { SessionState } from './sessionStore'

describe('session local storage store', () => {
  const sessionState: SessionState = { id: '123', created: '0' }

  afterEach(() => {
    window.localStorage.clear()
  })

  it('should report local storage as available', () => {
    const localStorageStore = initLocalStorage()
    expect(localStorageStore).toBeDefined()
  })

  it('should report local storage as not available', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('Unavailable')
    const localStorageStore = initLocalStorage()
    expect(localStorageStore).not.toBeDefined()
  })

  it('should persist a session in local storage', () => {
    const localStorageStore = initLocalStorage()
    localStorageStore?.persistSession(sessionState)
    const session = localStorageStore?.retrieveSession()
    expect(session).toEqual({ ...sessionState })
    expect(window.localStorage.getItem(LOCAL_STORAGE_KEY)).toMatch(/.*id=.*created/)
  })

  it('should delete the local storage item holding the session', () => {
    const localStorageStore = initLocalStorage()
    localStorageStore?.persistSession(sessionState)
    localStorageStore?.clearSession()
    const session = localStorageStore?.retrieveSession()
    expect(session).toEqual({})
    expect(window.localStorage.getItem(LOCAL_STORAGE_KEY)).toBeNull()
  })

  it('should not interfere with other keys present in local storage', () => {
    window.localStorage.setItem('test', 'hello')
    const localStorageStore = initLocalStorage()
    localStorageStore?.persistSession(sessionState)
    localStorageStore?.retrieveSession()
    localStorageStore?.clearSession()
    expect(window.localStorage.getItem('test')).toEqual('hello')
  })

  it('should return an empty object if session string is invalid', () => {
    const localStorageStore = initLocalStorage()
    localStorage.setItem(LOCAL_STORAGE_KEY, '{test:42}')
    const session = localStorageStore?.retrieveSession()
    expect(session).toEqual({})
  })
})
