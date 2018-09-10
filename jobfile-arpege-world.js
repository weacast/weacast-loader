const job = require('./jobfile-arpege')

// Setup job name
Object.assign(job, {
  id: 'weacast-arpege-world'
})

// Setup model name and bounds
Object.assign(job.taskTemplate, {
  model: 'arpege-world'
})
Object.assign(job.taskTemplate.options.subsets, {
  long: [-180, 180],
  lat: [-90, 90]
})

// Setup model generation parameters
Object.assign(job.hooks.jobs.before.generateNwpTasks, {
  runInterval: 6 * 3600,          // Produced every 6h
  interval: 3 * 3600,             // Steps of 3h
  lowerLimit: 0 * 3600,           // From T0
  upperLimit: 3 * 3600,           // Up to T0 + 3h for testing
})

module.exports = job
