import { createTest, flushEvents } from '../../lib/framework'
import { browserExecuteAsync } from '../../lib/helpers/browser'

describe('vital collection', () => {
  createTest('send custom duration vital')
    .withRum({
      enableExperimentalFeatures: ['custom_vitals'],
    })
    .run(async ({ intakeRegistry }) => {
      await browserExecuteAsync<void>((done) => {
        // TODO remove cast and unsafe calls when removing the flag
        const global = window.DD_RUM! as any
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        global.startDurationVital('foo')
        setTimeout(() => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          global.stopDurationVital('foo')
          done()
        }, 5)
      })
      await flushEvents()

      expect(intakeRegistry.rumVitalEvents.length).toBe(1)
      expect(intakeRegistry.rumVitalEvents[0].vital.custom).toEqual({ foo: jasmine.any(Number) })
    })
})
