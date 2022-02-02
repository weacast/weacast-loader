const createJob = require('./job-gfs')

// Produced every 6h
const runInterval = 6 * 3600
// Don't go back in time older than 1 day
const oldestRunInterval = (process.env.OLDEST_RUN_INTERVAL ? Number(process.env.OLDEST_RUN_INTERVAL) : 24 * 3600)
// Don't keep past runs
const keepPastRuns = process.env.KEEP_PAST_RUNS || false
// Steps of 3h
const interval = 3 * 3600
// Expand data TTL if required
const ttl = (process.env.TTL ? Number(process.env.TTL) : undefined)
// From T0
const lowerLimit = 0
// Up to T0+240
const upperLimit = (process.env.UPPER_LIMIT ? Number(process.env.UPPER_LIMIT) : 240 * 3600)

// Setup job name, model name, bounds and generation parameters
module.exports = createJob({
  id: 'weacast-gfs-isobaric-world',
  model: 'gfs-world',
  bounds: [0, -90, 360, 90],
  origin: [0, 90],
  size: [720, 361],
  resolution: [0.5, 0.5],
  tileResolution: [20, 20],
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
    name: 'var_UGRD',
    levels: [ 'lev_1000_mb', 'lev_700_mb', 'lev_450_mb', 'lev_300_mb', 'lev_200_mb' ]
  }, {
    element: 'v-wind',
    name: 'var_VGRD',
    levels: [ 'lev_1000_mb', 'lev_700_mb', 'lev_450_mb', 'lev_300_mb', 'lev_200_mb' ]
  }, {
    element: 'temperature',
    name: 'var_TMP',
    levels: [ 'lev_1000_mb', 'lev_700_mb', 'lev_450_mb', 'lev_300_mb', 'lev_200_mb' ]
  }],
  isobaric: true
})
