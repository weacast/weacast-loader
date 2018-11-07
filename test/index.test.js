import path from 'path'
import fs from 'fs-extra'
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import { MongoClient } from 'mongodb'
import { cli as krawler } from '@kalisio/krawler'
import loader from '..'

// Helper function to update NWP tasks generation options
function updateJobOptions (job, element) {
  let beforeHooks = job.hooks.jobs.before
  let afterHooks = job.hooks.jobs.after
  let nwpOptions = beforeHooks.generateNwpTasks
  // Keep track of intermediate files
  delete afterHooks.clearOutputs
  // Change DB to test
  beforeHooks.connectMongo.url = 'mongodb://127.0.0.1:27017/weacast-test'
  // Simplify job for testing and only request 1 element and 2 forecast times
  Object.assign(nwpOptions, {
    runIndex: -2, // previous run to ensure it is already available
    upperLimit: nwpOptions.lowerLimit + nwpOptions.interval,
    elements: [element]
  })
  afterHooks = job.hooks.tasks.after
  let bounds = afterHooks.tileGrid.input.bounds
  afterHooks.tileGrid.output.resolution = [ 0.5 * (bounds[2] - bounds[0]), 0.5 * (bounds[3] - bounds[1]) ]
  return job
}

describe('weacast-loader', () => {
  let dbClient, db
  const outputPath = path.join(__dirname, '..', 'forecast-data')
  const arpegeWorldJob = updateJobOptions(require(path.join(__dirname, '..', 'jobfile-arpege-world.js')), {
    element: 'temperature',
    model: 'arpege-world',
    name: 'TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND',
    levels: [ 2 ]
  })
  const arpegeEuropeJob = updateJobOptions(require(path.join(__dirname, '..', 'jobfile-arpege-europe.js')), {
    element: 'temperature',
    model: 'arpege-europe',
    name: 'TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND',
    levels: [ 2 ]
  })
  const aromeFranceJob = updateJobOptions(require(path.join(__dirname, '..', 'jobfile-arome-france.js')), {
    element: 'temperature',
    model: 'arome-france',
    name: 'TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND',
    levels: [ 2 ]
  })
  const gfsWorldJob = updateJobOptions(require(path.join(__dirname, '..', 'jobfile-gfs-world.js')), {
    element: 'temperature',
    model: 'gfs-world',
    name: 'var_TMP',
    levels: [ 'lev_surface' ]
  })

  function expectFiles(model, element, level, interval, present) {
    // Check intermediate products have been produced and final product are here
    expect(fs.existsSync(path.join(outputPath, model, element, level, '0'))).to.equal(present)
    expect(fs.existsSync(path.join(outputPath, model, element, level, interval))).to.equal(present)
    expect(fs.existsSync(path.join(outputPath, model, element, level, '0.json'))).to.equal(present)
    expect(fs.existsSync(path.join(outputPath, model, element, level, interval + '.json'))).to.equal(present)
  }

  async function expectResults(collectionName) {
    const collection = db.collection(collectionName)
    let results = await collection.find({ geometry: { $exists: false } }).toArray()
    expect(results.length).to.equal(2)
    expect(results[0].runTime).toExist()
    expect(results[0].runTime.toISOString).toExist()
    expect(results[0].forecastTime).toExist()
    expect(results[0].forecastTime.toISOString).toExist()
    expect(results[0].minValue).toExist()
    expect(typeof results[0].minValue === 'number').toExist()
    expect(results[0].maxValue).toExist()
    expect(typeof results[0].maxValue === 'number').toExist()
    expect(results[0].data).toExist()
    expect(Array.isArray(results[0].data)).beTrue()
    expect(typeof results[0].data[0] === 'number').toExist()
  }

  async function expectTileResults(collectionName) {
    const collection = db.collection(collectionName)
    let results = await collection.find({ geometry: { $exists: true } }).toArray()
    expect(results.length).to.equal(2 * 4)
    expect(results[0].runTime).toExist()
    expect(results[0].runTime.toISOString).toExist()
    expect(results[0].forecastTime).toExist()
    expect(results[0].forecastTime.toISOString).toExist()
    /* Not yet done
    expect(results[0].minValue).toExist()
    expect(typeof results[0].minValue === 'number').toExist()
    expect(results[0].maxValue).toExist()
    expect(typeof results[0].maxValue === 'number').toExist()
    */
    expect(results[0].x).toExist()
    expect(typeof results[0].x === 'number').toExist()
    expect(results[0].y).toExist()
    expect(typeof results[0].y === 'number').toExist()
    expect(results[0].bounds).toExist()
    expect(Array.isArray(results[0].bounds)).toExist()
    expect(typeof results[0].bounds[0] === 'number').toExist()
    expect(results[0].origin).toExist()
    expect(Array.isArray(results[0].origin)).toExist()
    expect(typeof results[0].origin[0] === 'number').toExist()
    expect(results[0].size).toExist()
    expect(Array.isArray(results[0].size)).toExist()
    expect(typeof results[0].size[0] === 'number').toExist()
    expect(results[0].resolution).toExist()
    expect(Array.isArray(results[0].resolution)).toExist()
    expect(typeof results[0].resolution[0] === 'number').toExist()
    expect(results[0].geometry).toExist()
    expect(typeof results[0].geometry === 'object').toExist()
    expect(results[0].timeseries).toExist()
    expect(typeof results[0].timeseries === 'boolean').toExist()
    expect(results[0].data).toExist()
    expect(Array.isArray(results[0].data)).beTrue()
    expect(typeof results[0].data[0] === 'number').toExist()
  }

  before(async () => {
    chailint(chai, util)

    dbClient = await MongoClient.connect('mongodb://127.0.0.1:27017')
    db = dbClient.db('weacast-test')
  })

  it('is CommonJS compatible', () => {
    expect(typeof loader.createArpegeJob).to.equal('function')
    expect(typeof loader.createAromeJob).to.equal('function')
    expect(typeof loader.createGfsJob).to.equal('function')
  })

  it('run ARPEGE WORLD dowloader', async () => {
    const tasks = await krawler(arpegeWorldJob)
    expect(tasks.length).to.equal(2)
    // Check intermediate products have been produced and final product are here
    expectFiles('arpege-world', 'temperature', '2', 3, true)
    await expectResults('arpege-world-temperature')
    // Tiles
    await expectTileResults('arpege-world-temperature')
    fs.emptyDirSync(outputPath)
  })
  // Let enough time to process
  .timeout(30000)

  it('run ARPEGE WORLD dowloader once again', async () => {
    const tasks = await krawler(arpegeWorldJob)
    expect(tasks.length).to.equal(2)
    // Check nothing has been produced because DB is already up-to-date
    expectFiles('arpege-world', 'temperature', '2', 3, false)
    await expectResults('arpege-world-temperature')
    // Tiles
    await expectTileResults('arpege-world-temperature')
  })
  // Let enough time to process
  .timeout(10000)

  it('run ARPEGE EUROPE dowloader', async () => {
    const tasks = await krawler(arpegeEuropeJob)
    expect(tasks.length).to.equal(2)
    // Check intermediate products have been produced and final product are here
    expectFiles('arpege-europe', 'temperature', '2', 1, true)
    await expectResults('arpege-europe-temperature')
    // Tiles
    await expectTileResults('arpege-europe-temperature')
    fs.emptyDirSync(outputPath)
  })
  // Let enough time to process
  .timeout(30000)

  it('run ARPEGE EUROPE dowloader once again', async () => {
    const tasks = await krawler(arpegeEuropeJob)
    expect(tasks.length).to.equal(2)
    // Check nothing has been produced because DB is already up-to-date
    expectFiles('arpege-europe', 'temperature', '2', 1, false)
    await expectResults('arpege-europe-temperature')
    // Tiles
    await expectTileResults('arpege-europe-temperature')
  })
  // Let enough time to process
  .timeout(10000)

  it('run AROME FRANCE dowloader', async () => {
    const tasks = await krawler(aromeFranceJob)
    expect(tasks.length).to.equal(2)
    // Check intermediate products have been produced and final product are here
    expectFiles('arome-france', 'temperature', '2', 1, true)
    await expectResults('arome-france-temperature')
    // Tiles
    await expectTileResults('arome-france-temperature')
    fs.emptyDirSync(outputPath)
  })
  // Let enough time to process
  .timeout(30000)

  it('run AROME FRANCE dowloader once again', async () => {
    const tasks = await krawler(aromeFranceJob)
    expect(tasks.length).to.equal(2)
    // Check nothing has been produced because DB is already up-to-date
    expectFiles('arome-france', 'temperature', '2', 1, false)
    await expectResults('arome-france-temperature')
    // Tiles
    await expectTileResults('arome-france-temperature')
  })
  // Let enough time to process
  .timeout(10000)

  it('run GFS WORLD dowloader', async () => {
    const tasks = await krawler(gfsWorldJob)
    expect(tasks.length).to.equal(2)
    // Check intermediate products have been produced and final product are here
    expectFiles('gfs-world', 'temperature', 'surface', 3, true)
    await expectResults('gfs-world-temperature')
    // Tiles
    await expectTileResults('gfs-world-temperature')
    fs.emptyDirSync(outputPath)
  })
  // Let enough time to process
  .timeout(30000)

  it('run GFS WORLD dowloader once again', async () => {
    const tasks = await krawler(gfsWorldJob)
    expect(tasks.length).to.equal(2)
    // Check nothing has been produced because DB is already up-to-date
    expectFiles('gfs-world', 'temperature', 'surface', 3, false)
    await expectResults('gfs-world-temperature')
    // Tiles
    await expectTileResults('gfs-world-temperature')
  })
  // Let enough time to process
  .timeout(10000)

  // Cleanup
  after(async () => {
    await db.collection('arpege-world-temperature').drop()
    await db.collection('arpege-europe-temperature').drop()
    await db.collection('arome-france-temperature').drop()
    await db.collection('gfs-world-temperature').drop()
    fs.emptyDirSync(outputPath)
    await dbClient.close()
  })
})
