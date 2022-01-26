const createJob = require('./job-arpege')

// Setup job name, model name, bounds and generation parameters
module.exports = createJob({
  id: 'weacast-arpege-europe',
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
    runInterval: 6 * 3600,            // Produced every 6h
    oldestRunInterval: process.env.OLDEST_RUN_INTERVAL || (24 * 3600),     // Don't go back in time older than 1 day
    keepPastRuns: process.env.KEEP_PAST_RUNS || false, // Don't keep past runs
    interval: 1 * 3600,               // Steps of 1h
    ttl: process.env.TTL,             // Expand data TTL if required
    lowerLimit: 0,                    // From T0
    // upperLimit: 3 * 3600,             // Up to T0 + 3h for testing
    upperLimit: process.env.UPPER_LIMIT || (102 * 3600)            // Up to T0+102
  }
})
