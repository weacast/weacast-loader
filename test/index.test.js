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
    expect(fs.existsSync(path.join(outputPath, 'arpege-world', 'temperature', '2', '0'))).beTrue()
    expect(fs.existsSync(path.join(outputPath, 'arpege-world', 'temperature', '2', '3'))).beTrue()
    expect(fs.existsSync(path.join(outputPath, 'arpege-world', 'temperature', '2', '0.json'))).beTrue()
    expect(fs.existsSync(path.join(outputPath, 'arpege-world', 'temperature', '2', '3.json'))).beTrue()
    const collection = db.collection('arpege-world-temperature')
    const results = await collection.find({}).toArray()
    expect(results.length).to.equal(2)
    expect(results[0].runTime).toExist()
    expect(results[0].forecastTime).toExist()
    expect(results[0].minValue).toExist()
    expect(results[0].maxValue).toExist()
    expect(results[0].data).toExist()
    expect(Array.isArray(results[0].data)).beTrue()
    fs.emptyDirSync(outputPath)
  })
  // Let enough time to process
  .timeout(30000)

  it('run ARPEGE WORLD dowloader once again', async () => {
    const tasks = await krawler(arpegeWorldJob)
    expect(tasks.length).to.equal(2)
    // Check nothing has been produced because DB is already up-to-date
    expect(fs.existsSync(path.join(outputPath, 'arpege-world', 'temperature', '2', '0'))).beFalse()
    expect(fs.existsSync(path.join(outputPath, 'arpege-world', 'temperature', '2', '3'))).beFalse()
    expect(fs.existsSync(path.join(outputPath, 'arpege-world', 'temperature', '2', '0.json'))).beFalse()
    expect(fs.existsSync(path.join(outputPath, 'arpege-world', 'temperature', '2', '3.json'))).beFalse()
    const collection = db.collection('arpege-world-temperature')
    const results = await collection.find({}).toArray()
    expect(results.length).to.equal(2)
    expect(results[0].runTime).toExist()
    expect(results[0].forecastTime).toExist()
    expect(results[0].minValue).toExist()
    expect(results[0].maxValue).toExist()
    expect(results[0].data).toExist()
    expect(Array.isArray(results[0].data)).beTrue()
  })
  // Let enough time to process
  .timeout(10000)

  it('run ARPEGE EUROPE dowloader', async () => {
    const tasks = await krawler(arpegeEuropeJob)
    expect(tasks.length).to.equal(2)
    // Check intermediate products have been produced and final product are here
    expect(fs.existsSync(path.join(outputPath, 'arpege-europe', 'temperature', '2', '0'))).beTrue()
    expect(fs.existsSync(path.join(outputPath, 'arpege-europe', 'temperature', '2', '1'))).beTrue()
    expect(fs.existsSync(path.join(outputPath, 'arpege-europe', 'temperature', '2', '0.json'))).beTrue()
    expect(fs.existsSync(path.join(outputPath, 'arpege-europe', 'temperature', '2', '1.json'))).beTrue()
    const collection = db.collection('arpege-europe-temperature')
    const results = await collection.find({}).toArray()
    expect(results.length).to.equal(2)
    expect(results[0].runTime).toExist()
    expect(results[0].forecastTime).toExist()
    expect(results[0].minValue).toExist()
    expect(results[0].maxValue).toExist()
    expect(results[0].data).toExist()
    expect(Array.isArray(results[0].data)).beTrue()
    fs.emptyDirSync(outputPath)
  })
  // Let enough time to process
  .timeout(30000)

  it('run ARPEGE EUROPE dowloader once again', async () => {
    const tasks = await krawler(arpegeEuropeJob)
    expect(tasks.length).to.equal(2)
    // Check nothing has been produced because DB is already up-to-date
    expect(fs.existsSync(path.join(outputPath, 'arpege-europe', 'temperature', '2', '0'))).beFalse()
    expect(fs.existsSync(path.join(outputPath, 'arpege-europe', 'temperature', '2', '1'))).beFalse()
    expect(fs.existsSync(path.join(outputPath, 'arpege-europe', 'temperature', '2', '0.json'))).beFalse()
    expect(fs.existsSync(path.join(outputPath, 'arpege-europe', 'temperature', '2', '1.json'))).beFalse()
    const collection = db.collection('arpege-europe-temperature')
    const results = await collection.find({}).toArray()
    expect(results.length).to.equal(2)
    expect(results[0].runTime).toExist()
    expect(results[0].forecastTime).toExist()
    expect(results[0].minValue).toExist()
    expect(results[0].maxValue).toExist()
    expect(results[0].data).toExist()
    expect(Array.isArray(results[0].data)).beTrue()
  })
  // Let enough time to process
  .timeout(10000)

  it('run AROME FRANCE dowloader', async () => {
    const tasks = await krawler(aromeFranceJob)
    expect(tasks.length).to.equal(2)
    // Check intermediate products have been produced and final product are here
    expect(fs.existsSync(path.join(outputPath, 'arome-france', 'temperature', '2', '0'))).beTrue()
    expect(fs.existsSync(path.join(outputPath, 'arome-france', 'temperature', '2', '1'))).beTrue()
    expect(fs.existsSync(path.join(outputPath, 'arome-france', 'temperature', '2', '0.json'))).beTrue()
    expect(fs.existsSync(path.join(outputPath, 'arome-france', 'temperature', '2', '1.json'))).beTrue()
    const collection = db.collection('arome-france-temperature')
    const results = await collection.find({}).toArray()
    expect(results.length).to.equal(2)
    expect(results[0].runTime).toExist()
    expect(results[0].forecastTime).toExist()
    expect(results[0].minValue).toExist()
    expect(results[0].maxValue).toExist()
    expect(results[0].data).toExist()
    expect(Array.isArray(results[0].data)).beTrue()
    fs.emptyDirSync(outputPath)
  })
  // Let enough time to process
  .timeout(30000)

  it('run AROME FRANCE dowloader once again', async () => {
    const tasks = await krawler(aromeFranceJob)
    expect(tasks.length).to.equal(2)
    // Check nothing has been produced because DB is already up-to-date
    expect(fs.existsSync(path.join(outputPath, 'arome-france', 'temperature', '2', '0'))).beFalse()
    expect(fs.existsSync(path.join(outputPath, 'arome-france', 'temperature', '2', '1'))).beFalse()
    expect(fs.existsSync(path.join(outputPath, 'arome-france', 'temperature', '2', '0.json'))).beFalse()
    expect(fs.existsSync(path.join(outputPath, 'arome-france', 'temperature', '2', '1.json'))).beFalse()
    const collection = db.collection('arome-france-temperature')
    const results = await collection.find({}).toArray()
    expect(results.length).to.equal(2)
    expect(results[0].runTime).toExist()
    expect(results[0].forecastTime).toExist()
    expect(results[0].minValue).toExist()
    expect(results[0].maxValue).toExist()
    expect(results[0].data).toExist()
    expect(Array.isArray(results[0].data)).beTrue()
  })
  // Let enough time to process
  .timeout(10000)

  it('run GFS WORLD dowloader', async () => {
    const tasks = await krawler(gfsWorldJob)
    expect(tasks.length).to.equal(2)
    // Check intermediate products have been produced and final product are here
    expect(fs.existsSync(path.join(outputPath, 'gfs-world', 'temperature', 'surface', '0'))).beTrue()
    expect(fs.existsSync(path.join(outputPath, 'gfs-world', 'temperature', 'surface', '3'))).beTrue()
    expect(fs.existsSync(path.join(outputPath, 'gfs-world', 'temperature', 'surface', '0.json'))).beTrue()
    expect(fs.existsSync(path.join(outputPath, 'gfs-world', 'temperature', 'surface', '3.json'))).beTrue()
    const collection = db.collection('gfs-world-temperature')
    const results = await collection.find({}).toArray()
    expect(results.length).to.equal(2)
    expect(results[0].runTime).toExist()
    expect(results[0].forecastTime).toExist()
    expect(results[0].minValue).toExist()
    expect(results[0].maxValue).toExist()
    expect(results[0].data).toExist()
    expect(Array.isArray(results[0].data)).beTrue()
    fs.emptyDirSync(outputPath)
  })
  // Let enough time to process
  .timeout(30000)

  it('run GFS WORLD dowloader once again', async () => {
    const tasks = await krawler(gfsWorldJob)
    expect(tasks.length).to.equal(2)
    // Check nothing has been produced because DB is already up-to-date
    expect(fs.existsSync(path.join(outputPath, 'gfs-world', 'temperature', 'surface', '0'))).beFalse()
    expect(fs.existsSync(path.join(outputPath, 'gfs-world', 'temperature', 'surface', '3'))).beFalse()
    expect(fs.existsSync(path.join(outputPath, 'gfs-world', 'temperature', 'surface', '0.json'))).beFalse()
    expect(fs.existsSync(path.join(outputPath, 'gfs-world', 'temperature', 'surface', '3.json'))).beFalse()
    const collection = db.collection('gfs-world-temperature')
    const results = await collection.find({}).toArray()
    expect(results.length).to.equal(2)
    expect(results[0].runTime).toExist()
    expect(results[0].forecastTime).toExist()
    expect(results[0].minValue).toExist()
    expect(results[0].maxValue).toExist()
    expect(results[0].data).toExist()
    expect(Array.isArray(results[0].data)).beTrue()
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
