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
  if (element.dataStore && (element.dataStore === 'gridfs')) {
    beforeHooks.createBuckets.hooks[0].bucket = `${element.model}-${element.element}`
  }
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
  const arpegeIsobaricWorldJob = updateJobOptions(require(path.join(__dirname, '..', 'jobfile-arpege-isobaric-world.js')), {
    element: 'temperature-isobaric',
    model: 'arpege-world',
    name: 'TEMPERATURE__ISOBARIC_SURFACE',
    levels: [ 1000 ]
  })
  const arpegeEuropeJob = updateJobOptions(require(path.join(__dirname, '..', 'jobfile-arpege-europe.js')), {
    element: 'temperature',
    model: 'arpege-europe',
    name: 'TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND',
    levels: [ 2 ]
  })
  const arpegeIsobaricEuropeJob = updateJobOptions(require(path.join(__dirname, '..', 'jobfile-arpege-isobaric-europe.js')), {
    element: 'temperature-isobaric',
    model: 'arpege-europe',
    name: 'TEMPERATURE__ISOBARIC_SURFACE',
    levels: [ 1000 ]
  })
  const aromeFranceJob = updateJobOptions(require(path.join(__dirname, '..', 'jobfile-arome-france.js')), {
    element: 'temperature',
    model: 'arome-france',
    name: 'TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND',
    levels: [ 2 ]
  })
  const aromeFranceHighJob = updateJobOptions(require(path.join(__dirname, '..', 'jobfile-arome-france-high.js')), {
    element: 'temperature',
    model: 'arome-france-high',
    dataStore: 'gridfs',
    name: 'TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND',
    levels: [ 2 ]
  })
  const gfsWorldJob = updateJobOptions(require(path.join(__dirname, '..', 'jobfile-gfs-world.js')), {
    element: 'temperature',
    model: 'gfs-world',
    name: 'var_TMP',
    levels: [ 'lev_surface' ]
  })
  const gfsIsobaricWorldJob = updateJobOptions(require(path.join(__dirname, '..', 'jobfile-gfs-isobaric-world.js')), {
    element: 'temperature-isobaric',
    model: 'gfs-world',
    name: 'var_TMP',
    levels: [ 'lev_1000_mb' ]
  })

  function expectFiles (model, element, level, interval, present) {
    // Check intermediate products have been produced and final product are here
    expect(fs.existsSync(path.join(outputPath, model, element, level, '0'))).to.equal(present)
    expect(fs.existsSync(path.join(outputPath, model, element, level, interval))).to.equal(present)
    expect(fs.existsSync(path.join(outputPath, model, element, level, '0.json'))).to.equal(present)
    expect(fs.existsSync(path.join(outputPath, model, element, level, interval + '.json'))).to.equal(present)
  }

  async function expectResults (collectionName) {
    const collection = db.collection(collectionName)
    let results = await collection.find({ geometry: { $exists: false } }).toArray()
    expect(results.length).to.equal(2)
    expect(results[0].runTime).toExist()
    expect(results[0].runTime.toISOString).toExist()
    expect(results[0].forecastTime).toExist()
    expect(results[0].forecastTime.toISOString).toExist()
    expect(results[0].minValue).toExist()
    expect(typeof results[0].minValue === 'number').beTrue()
    expect(results[0].maxValue).toExist()
    expect(typeof results[0].maxValue === 'number').beTrue()
  }

  async function expectDataResults (collectionName) {
    const collection = db.collection(collectionName)
    let results = await collection.find({ geometry: { $exists: false } }).toArray()
    expect(results[0].data).toExist()
    expect(Array.isArray(results[0].data)).beTrue()
    expect(typeof results[0].data[0] === 'number').beTrue()
  }

  async function expectGridFSResults (collectionName) {
    const collection = db.collection(collectionName)
    let results = await collection.find({ geometry: { $exists: false } }).toArray()
    expect(results[0].convertedFilePath).toExist()
    expect(typeof results[0].convertedFilePath === 'string').beTrue()
    const filesCollection = db.collection(collectionName + '.files')
    results = await filesCollection.find({}).toArray()
    expect(results.length).to.equal(2)
    expect(results[0].filename).toExist()
    expect(results[0].metadata).toExist()
    expect(results[0].metadata.forecastTime).toExist()
  }

  async function expectTileResults (collectionName) {
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

  it('run GFS WORLD dowloader', async () => {
    const tasks = await krawler(gfsWorldJob)
    expect(tasks.length).to.equal(2)
    // Check intermediate products have been produced and final product are here
    expectFiles('gfs-world', 'temperature', 'surface', '3', true)
    await expectResults('gfs-world-temperature')
    await expectDataResults('gfs-world-temperature')
    // Tiles
    await expectTileResults('gfs-world-temperature')
    fs.emptyDirSync(outputPath)
  })
  // Let enough time to process
  .timeout(180000)

  it('run GFS WORLD dowloader once again', async () => {
    const tasks = await krawler(gfsWorldJob)
    expect(tasks.length).to.equal(2)
    // Check nothing has been produced because DB is already up-to-date
    expectFiles('gfs-world', 'temperature', 'surface', '3', false)
    await expectResults('gfs-world-temperature')
    await expectDataResults('gfs-world-temperature')
    // Tiles
    await expectTileResults('gfs-world-temperature')
  })
  // Let enough time to process
  .timeout(60000)

  it('run GFS ISOBARIC WORLD dowloader', async () => {
    const tasks = await krawler(gfsIsobaricWorldJob)
    expect(tasks.length).to.equal(2)
    // Check intermediate products have been produced and final product are here
    expectFiles('gfs-world', 'temperature-isobaric', '1000', '3', true)
    await expectResults('gfs-world-temperature-isobaric')
    await expectDataResults('gfs-world-temperature-isobaric')
    // Tiles
    await expectTileResults('gfs-world-temperature-isobaric')
    fs.emptyDirSync(outputPath)
  })
  // Let enough time to process
  .timeout(180000)

  it('run ARPEGE WORLD dowloader', async () => {
    const tasks = await krawler(arpegeWorldJob)
    expect(tasks.length).to.equal(2)
    // Check intermediate products have been produced and final product are here
    expectFiles('arpege-world', 'temperature', '2', '3', true)
    await expectResults('arpege-world-temperature')
    await expectDataResults('arpege-world-temperature')
    // Tiles
    await expectTileResults('arpege-world-temperature')
    fs.emptyDirSync(outputPath)
  })
  // Let enough time to process
  .timeout(180000)

  it('run ARPEGE WORLD downloader once again', async () => {
    const tasks = await krawler(arpegeWorldJob)
    expect(tasks.length).to.equal(2)
    // Check nothing has been produced because DB is already up-to-date
    expectFiles('arpege-world', 'temperature', '2', '3', false)
    await expectResults('arpege-world-temperature')
    await expectDataResults('arpege-world-temperature')
    // Tiles
    await expectTileResults('arpege-world-temperature')
  })
  // Let enough time to process
  .timeout(60000)

  it('run ARPEGE ISOBARIC WORLD dowloader', async () => {
    const tasks = await krawler(arpegeIsobaricWorldJob)
    expect(tasks.length).to.equal(2)
    // Check intermediate products have been produced and final product are here
    expectFiles('arpege-world', 'temperature-isobaric', '1000', '3', true)
    await expectResults('arpege-world-temperature-isobaric')
    await expectDataResults('arpege-world-temperature-isobaric')
    // Tiles
    await expectTileResults('arpege-world-temperature-isobaric')
    fs.emptyDirSync(outputPath)
  })
  // Let enough time to process
  .timeout(180000)

  it('run ARPEGE EUROPE downloader', async () => {
    const tasks = await krawler(arpegeEuropeJob)
    expect(tasks.length).to.equal(2)
    // Check intermediate products have been produced and final product are here
    expectFiles('arpege-europe', 'temperature', '2', '1', true)
    await expectResults('arpege-europe-temperature')
    await expectDataResults('arpege-europe-temperature')
    // Tiles
    await expectTileResults('arpege-europe-temperature')
    fs.emptyDirSync(outputPath)
  })
  // Let enough time to process
  .timeout(180000)

  it('run ARPEGE EUROPE downloader once again', async () => {
    const tasks = await krawler(arpegeEuropeJob)
    expect(tasks.length).to.equal(2)
    // Check nothing has been produced because DB is already up-to-date
    expectFiles('arpege-europe', 'temperature', '2', '1', false)
    await expectResults('arpege-europe-temperature')
    await expectDataResults('arpege-europe-temperature')
    // Tiles
    await expectTileResults('arpege-europe-temperature')
  })
  // Let enough time to process
  .timeout(60000)

  it('run ARPEGE ISOBARIC EUROPE downloader', async () => {
    const tasks = await krawler(arpegeIsobaricEuropeJob)
    expect(tasks.length).to.equal(2)
    // Check intermediate products have been produced and final product are here
    expectFiles('arpege-europe', 'temperature-isobaric', '1000', '1', true)
    await expectResults('arpege-europe-temperature-isobaric')
    await expectDataResults('arpege-europe-temperature-isobaric')
    // Tiles
    await expectTileResults('arpege-europe-temperature-isobaric')
    fs.emptyDirSync(outputPath)
  })
  // Let enough time to process
  .timeout(180000)

  it('run AROME FRANCE downloader', async () => {
    const tasks = await krawler(aromeFranceJob)
    expect(tasks.length).to.equal(2)
    // Check intermediate products have been produced and final product are here
    expectFiles('arome-france', 'temperature', '2', '1', true)
    await expectResults('arome-france-temperature')
    await expectDataResults('arome-france-temperature')
    // Tiles
    await expectTileResults('arome-france-temperature')
    fs.emptyDirSync(outputPath)
  })
  // Let enough time to process
  .timeout(180000)

  it('run AROME FRANCE downloader once again', async () => {
    const tasks = await krawler(aromeFranceJob)
    expect(tasks.length).to.equal(2)
    // Check nothing has been produced because DB is already up-to-date
    expectFiles('arome-france', 'temperature', '2', '1', false)
    await expectResults('arome-france-temperature')
    await expectDataResults('arome-france-temperature')
    // Tiles
    await expectTileResults('arome-france-temperature')
  })
  // Let enough time to process
  .timeout(60000)

  it('run AROME FRANCE HIGH downloader', async () => {
    const tasks = await krawler(aromeFranceHighJob)
    expect(tasks.length).to.equal(2)
    // Check intermediate products have been produced and final product are here
    expectFiles('arome-france-high', 'temperature', '2', '1', true)
    await expectResults('arome-france-high-temperature')
    await expectGridFSResults('arome-france-high-temperature')
    // Tiles
    await expectTileResults('arome-france-high-temperature')
    fs.emptyDirSync(outputPath)
  })
  // Let enough time to process
  .timeout(360000)

  it('run AROME FRANCE HIGH downloader once again', async () => {
    const tasks = await krawler(aromeFranceHighJob)
    expect(tasks.length).to.equal(2)
    // Check nothing has been produced because DB is already up-to-date
    expectFiles('arome-france-high', 'temperature', '2', '1', false)
    await expectResults('arome-france-high-temperature')
    await expectGridFSResults('arome-france-high-temperature')
    // Tiles
    await expectTileResults('arome-france-high-temperature')
  })
  // Let enough time to process
  .timeout(60000)

  // Cleanup
  after(async function () {
    // Let enough time to process
    this.timeout(30000)
    fs.emptyDirSync(outputPath)
    await db.dropDatabase()
    await dbClient.close()
  })
})
