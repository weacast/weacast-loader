const createJob = require('./job-arome')

// Produced every 3h
const runInterval = 3 * 3600
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
// Up to T0+42
const upperLimit = (process.env.UPPER_LIMIT ? Number(process.env.UPPER_LIMIT) : 42 * 3600)

// Setup job name, model name, bounds and generation parameters
module.exports = createJob({
  id: 'weacast-arome-france-high',
  model: 'arome-france-high',
  dataStore: 'gridfs',
  request: {
    url: 'https://public-api.meteofrance.fr/public/arome/1.0/wcs/MF-NWP-HIGHRES-AROME-001-FRANCE-WCS/GetCoverage'
  },
  bounds: [-8, 38, 12, 53],
  origin: [-8, 53],
  size: [2001, 1501],
  resolution: [0.01, 0.01],
  tileResolution: [1, 1],
  nwp: {
    runInterval,
    oldestRunInterval,
    keepPastRuns,
    interval,
    ttl,
    lowerLimit,
    upperLimit
  }
})
