import { expect } from 'chai'
import * as sinon from 'sinon'

describe('rum module', () => {
  it('init should log an error with no rum project id', () => {
    require('../rum')

    const errorStub = sinon.stub(console, 'error')
    window.Datadog.init({ publicApiKey: 'yes' })
    expect(errorStub.callCount).to.eq(1)

    window.Datadog.init({ publicApiKey: 'yes', rumProjectId: 'yes' })
    expect(errorStub.callCount).to.eq(1)

    sinon.restore()
  })
})
