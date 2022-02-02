const createJob = require('./job-arpege')

// Produced every 6h
const runInterval = 6 * 3600
// Don't go back in time older than 1 day
const oldestRunInterval = (process.env.OLDEST_RUN_INTERVAL ? Number(process.env.OLDEST_RUN_INTERVAL) : 24 * 3600)
// Don't keep past runs
const keepPastRuns = process.env.KEEP_PAST_RUNS || false
// Steps of 1h
const interval = 1 * 3600
// Expand data TTL if required
const ttl = (process.env.TTL ? Number(process.env.TTL) : undefined)
// From T0
const lowerLimit = 0
// Up to T0+102
const upperLimit = (process.env.UPPER_LIMIT ? Number(process.env.UPPER_LIMIT) : 102 * 3600)

// Setup job name, model name, bounds and generation parameters
module.exports = createJob({
  id: 'weacast-arpege-isobaric-world',
  model: 'arpege-world',
  bounds: [0, -90, 360, 90],
  origin: [0, 90],
  size: [1440, 721],
  resolution: [0.25, 0.25],
  tileResolution: [10, 10],
  nwp: {
    runInterval,
    oldestRunInterval,
    keepPastRuns,
    interval,
    ttl,
    lowerLimit,
    upperLimit
  },
  elements: [{
    element: 'u-wind',
    name: 'U_COMPONENT_OF_WIND__ISOBARIC_SURFACE',
    levels: [ 1000, 700, 450, 300, 200 ]
  }, {
    element: 'v-wind',
    name: 'V_COMPONENT_OF_WIND__ISOBARIC_SURFACE',
    levels: [ 1000, 700, 450, 300, 200 ]
  }, {
    element: 'temperature',
    name: 'TEMPERATURE__ISOBARIC_SURFACE',
    levels: [ 1000, 700, 450, 300, 200 ]
  }],
  isobaric: true
})
