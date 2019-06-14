const path = require('path')
const outputPath = path.join(__dirname, 'forecast-data')

const defaults = {
  id: 'weacast-gfs',
  model: 'gfs',
  dbUrl: process.env.DB_URL || 'mongodb://127.0.0.1:27017/weacast',
  request: {},
  nwp: {},
  elements: [{
    element: 'u-wind',
    name: 'var_UGRD',
    levels: [ 'lev_10_m_above_ground' ]
  }, {
    element: 'gust',
    name: 'var_GUST',
    levels: [ 'lev_surface' ]
  }, {
    element: 'v-wind',
    name: 'var_VGRD',
    levels: [ 'lev_10_m_above_ground' ]
  }, {
    element: 'precipitations',
    name: 'var_APCP',
    levels: [ 'lev_surface' ],
    lowerLimit: 3 * 3600 // Accumulation from T to T-3H
  }]
}

module.exports = (options) => {
  options = Object.assign(defaults, options)

  return {
    id: options.id,
    store: 'fs',
    options: {
      workersLimit: options.workersLimit || 2,
      faultTolerant: true
    },
    taskTemplate: {
      // id: 'gfs/<%= element %>/<%= level %>/<%= forecastTime.format(\'YYYY-MM-DD[_]HH-mm-ss\') %>',
      id: `${options.model}/<%= element %>/<%= level.split('_')[1] %>/<%= timeOffset / 3600 %>`,
      type: 'http',
      // Common options for models, some will be setup on a per-model basis
      options: Object.assign({
        url: 'http://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p50.pl',
        dir: '/gfs.<%= runTime.format(\'YYYYMMDD/HH\') %>',
        file: 'gfs.t<%= runTime.format(\'HH\') %>z.pgrb2full.0p50.f<%= (timeOffset / 3600).toString().padStart(3, \'0\') %>',
        subregion: null,
        leftlon: options.bounds[0],
        rightlon: options.bounds[2],
        bottomlat: options.bounds[1],
        toplat: options.bounds[3],
        '<%= name %>': 'on',
        '<%= level %>': 'on'
      }, options.request)
    },
    hooks: {
      tasks: {
        before: {
          readMongoCollection: {
            collection: '<%= model %>-<%= element %>',
            dataPath: 'data.previousData',
            query: { forecastTime: '<%= forecastTime.format() %>', geometry: { $exists: false } },
            project: { _id: 1, runTime: 1, forecastTime: 1 },
            transform: { asObject: true }
          },
          // Do not download data if already here
          discardIf: { predicate: (item) => item.previousData.runTime && (item.runTime.valueOf() === item.previousData.runTime.getTime()) }
        },
        after: {
          runCommand: {
            command: `weacast-grib2json ${outputPath}/<%= id %> -d -p <%= (element.precision || 2) %> -o ${outputPath}/<%= id %>.json`
          },
          // This will add grid data in a data field
          readJson: {
            objectPath: '[0].data',
            key: '<%= id %>.json'
          },
          transformJson: { dataPath: 'result', pick: ['id', 'model', 'element', 'level', 'runTime', 'forecastTime', 'data', 'client'] },
          computeStatistics: { dataPath: 'result.data', min: 'minValue', max: 'maxValue' },
          // For forecast hours evenly divisible by 6, the accumulation period is from T-6h to T,
          // while for other forecast hours (divisible by 3 but not 6) it is from T-3h to T.
          // We unify everything to 3H accumulation period.
          apply: {
            match: { element: 'precipitations', predicate: (item) => item.forecastTime.hours() % 6 === 0 },
            function: (item) => {
              for (let i = 0; i < item.data.length; i++) {
                item.data[i] = 0.5 * item.data[i]
              }
            }
          },
          // Erase previous data if any
          deleteMongoCollection: {
            collection: '<%= model %>-<%= element %>',
            filter: { forecastTime: '<%= forecastTime.format() %>' }
          },
          writeRawData: { hook: 'writeMongoCollection',
            dataPath: 'result',
            collection: '<%= model %>-<%= element %>',
            transform: { omit: ['id', 'model', 'element', 'client'] } },
          emitEvent: { name: '<%= model %>-<%= element %>', pick: [ 'runTime', 'forecastTime' ] },
          tileGrid: {
            match: { predicate: (item) => options.tileResolution },
            dataPath: 'result.data',
            input: { bounds: options.bounds, origin: options.origin, size: options.size, resolution: options.resolution },
            output: { resolution: options.tileResolution },
            transform: { merge: { forecastTime: '<%= forecastTime.format() %>', runTime: '<%= runTime.format() %>', timeseries: false } }
          },
          writeTiles: { hook: 'writeMongoCollection',
            dataPath: 'result.data',
            collection: '<%= model %>-<%= element %>',
            match: { predicate: (item) => options.tileResolution },
            transform: { unitMapping: { forecastTime: { asDate: 'utc' }, runTime: { asDate: 'utc' } } }
          },
          clearData: {} // This will free memory for grid data
        }
      },
      jobs: {
        before: {
          createStores: {
            id: 'fs',
            options: {
              path: outputPath
            }
          },
          connectMongo: {
            url: options.dbUrl,
            // Required so that client is forwarded from job to tasks
            clientPath: 'taskTemplate.client'
          },
          parallel: options.elements.map(item => ({
            hook: 'createMongoCollection',
            collection: `${options.model}-${item.element}`,
            indices: [
              { x: 1, y: 1 },
              { geometry: '2dsphere' },
              [{ forecastTime: 1 }, { expireAfterSeconds: item.interval || options.nwp.interval }],
              { forecastTime: 1, geometry: 1 }
            ],
            // Required so that client is forwarded from job to tasks
            clientPath: 'taskTemplate.client'
          })),
          // Common options for models, some will be setup on a per-model basis
          generateNwpTasks: Object.assign({
            runIndex: 0, // -1 is not current run but previous one to ensure it is already available
            elements: options.elements.map(element => Object.assign({ model: options.model }, element))
          }, options.nwp)
        },
        after: {
          disconnectMongo: {
            clientPath: 'taskTemplate.client'
          },
          clearOutputs: {},
          removeStores: ['fs']
        }
      }
    }
  }
}
