const createJob = require('./job-gfs')

// Setup job name, model name, bounds and generation parameters
module.exports = createJob({
  id: 'weacast-gfs-world',
  model: 'gfs-world',
  bounds: [0, -90, 360, 90],
  origin: [0, 90],
  size: [720, 361],
  resolution: [0.5, 0.5],
  tileResolution: [20, 20],
  nwp: {
    runInterval: 6 * 3600,          // Produced every 6h
    oldestRunInterval: 24 * 3600,   // Don't go back in time older than 1 day
    interval: 3 * 3600,             // Steps of 3h
    lowerLimit: 0 * 3600,           // From T0
    // upperLimit: 3 * 3600,           // Up to T0 + 3h for testing
    upperLimit: process.env.UPPER_LIMIT || (240 * 3600)          // Up to T0+240
  }
})
