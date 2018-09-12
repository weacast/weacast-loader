// import path from 'path'
// import fs from 'fs'
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import loader from '..'

describe('weacast-loader', () => {
  before(() => {
    chailint(chai, util)
  })

  it('is CommonJS compatible', () => {
    expect(typeof loader.createArpegeJob).to.equal('function')
    expect(typeof loader.createAromeJob).to.equal('function')
    expect(typeof loader.createGfsJob).to.equal('function')
  })
})
