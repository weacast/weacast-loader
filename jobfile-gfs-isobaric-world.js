const createJob = require('./job-gfs')

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
    runInterval: 6 * 3600,          // Produced every 6h
    oldestRunInterval: 24 * 3600,   // Don't go back in time older than 1 day
    interval: 3 * 3600,             // Steps of 3h
    lowerLimit: 0 * 3600,           // From T0
    // upperLimit: 3 * 3600,           // Up to T0 + 3h for testing
    upperLimit: 240 * 3600          // Up to T0+240
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
