const createJob = require('./job-arpege')

// Setup job name, model name, bounds and generation parameters
module.exports = createJob({
  id: 'weacast-arpege-world',
  model: 'arpege-world',
  bounds: [0, -90, 360, 90],
  origin: [0, 90],
  size: [1440, 721],
  resolution: [0.25, 0.25],
  tileResolution: [10, 10],
  nwp: {
    runInterval: 6 * 3600,          // Produced every 6h
    oldestRunInterval: 24 * 3600,   // Don't go back in time older than 1 day
    interval: 3 * 3600,             // Steps of 3h
    lowerLimit: 0 * 3600,           // From T0
    // upperLimit: 3 * 3600,           // Up to T0 + 3h for testing
    upperLimit: process.env.UPPER_LIMIT || (102 * 3600)          // Up to T0+102
  }
})
