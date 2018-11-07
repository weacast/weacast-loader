const path = require('path')
const outputPath = path.join(__dirname, 'forecast-data')

const defaults = {
  id: 'weacast-arpege',
  model: 'arpege',
  dbUrl: process.env.DB_URL || 'mongodb://127.0.0.1:27017/weacast',
  request: {},
  subsets: {},
  nwp: {},
  elements: [{
    element: 'u-wind',
    name: 'U_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND',
    levels: [ 10 ]
  }, {
    element: 'gust',
    name: 'WIND_SPEED_GUST__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND',
    levels: [ 10 ]
  }, {
    element: 'v-wind',
    name: 'V_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND',
    levels: [ 10 ]
  }, {
    element: 'precipitations',
    name: 'TOTAL_PRECIPITATION__GROUND_OR_WATER_SURFACE',
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
      // id: 'arpege/<%= element %>/<%= level %>/<%= forecastTime.format(\'YYYY-MM-DD[_]HH-mm-ss\') %>',
      id: `${options.model}/<%= element %>/<%= level %>/<%= timeOffset / 3600 %>`,
      type: 'wcs',
      // Common options for models, some will be setup on a per-model basis
      options: Object.assign({
        url: 'https://geoservices.meteofrance.fr/services/MF-NWP-GLOBAL-ARPEGE-05-GLOBE-WCS',
        version: '2.0.1',
        token: process.env.METEO_FRANCE_TOKEN || '__qEMDoIC2ogPRlSoRQLGUBOomaxJyxdEd__',
        coverageid: '<%= name %>___<%= runTime.format() %>',
        subsets: Object.assign({
          long: [options.bounds[0], options.bounds[2]],
          lat: [options.bounds[1], options.bounds[3]],
          time: '<%= forecastTime.format() %>',
          height: '<%= level %>'
        }, options.subsets)
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
          discardIf: { predicate: (item) => item.previousData.runTime && (item.runTime.valueOf() === item.previousData.runTime.getTime()) },
          // When the accumulation period X is less than 1 day suffix is PTXH otherwise the suffix is PXD.
          apply: {
            match: { element: 'precipitations' },
            function: (item) => {
              var accumulationPeriod = item.lowerLimit / 3600
              if (accumulationPeriod < 24) item.options.coverageid += '_PT' + accumulationPeriod + 'H'
              else item.options.coverageid += '_P' + (accumulationPeriod / 24) + 'D'
              delete item.options.subsets.height
            }
          }
        },
        after: {
          runCommand: {
            command: `weacast-gtiff2json ${outputPath}/<%= id %> -o ${outputPath}/<%= id %>.json`
          },
          // This will add grid data in a data field
          readJson: {
            key: '<%= id %>.json'
          },
          transformJson: { dataPath: 'result', pick: ['id', 'model', 'element', 'level', 'runTime', 'forecastTime', 'data', 'client'] },
          computeStatistics: { dataPath: 'result.data', min: 'minValue', max: 'maxValue' },
          // Erase previous data if any
          deleteMongoCollection: {
            collection: '<%= model %>-<%= element %>',
            filter: { forecastTime: '<%= forecastTime.format() %>' }
          },
          writeRawData: { hook: 'writeMongoCollection', dataPath: 'result', collection: '<%= model %>-<%= element %>',
            transform: { omit: ['id', 'model', 'element', 'client'] } },
          emitEvent: { name: '<%= model %>-<%= element %>', pick: [ 'runTime', 'forecastTime' ] },
          tileGrid: {
            match: { predicate: (item) => options.tileResolution },
            dataPath: 'result.data',
            input: { bounds: options.bounds, origin: options.origin, size: options.size, resolution: options.resolution },
            output: { resolution: options.tileResolution },
            transform: { merge: { forecastTime: '<%= forecastTime.format() %>', runTime: '<%= runTime.format() %>', timeseries: false } }
          },
          writeTiles: { hook: 'writeMongoCollection', dataPath: 'result.data', collection: '<%= model %>-<%= element %>',
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
            index: [{ forecastTime: 1 }, { expireAfterSeconds: item.interval || options.nwp.interval }],
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
