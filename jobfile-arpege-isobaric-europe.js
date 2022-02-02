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
  id: 'weacast-arpege-isobaric-europe',
  model: 'arpege-europe',
  request: {
    url: 'https://public-api.meteofrance.fr/public/arpege/1.0/wcs/MF-NWP-GLOBAL-ARPEGE-01-EUROPE-WCS/GetCoverage'
  },
  bounds: [-32, 20, 42, 72],
  origin: [-32, 72],
  size: [741, 521],
  resolution: [0.1, 0.1],
  tileResolution: [4, 4],
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
