const createJob = require('./job-arome')

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
    runInterval: 3 * 3600,            // Produced every 3h
    oldestRunInterval: process.env.OLDEST_RUN_INTERVAL || (24 * 3600),     // Don't go back in time older than 1 day
    keepPastRuns: process.env.KEEP_PAST_RUNS || false, // Don't keep past runs
    interval: 1 * 3600,               // Steps of 1h
    ttl: process.env.TTL,             // Expand data TTL if required
    lowerLimit: 0,                    // From T0
    // upperLimit: 3 * 3600,             // Up to T0 + 3h for testing
    upperLimit: process.env.UPPER_LIMIT || (42 * 3600)             // Up to T0+42
  }
})
