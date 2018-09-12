const path = require('path')
const outputPath = path.join(__dirname, 'forecast-data')

const defaults = {
  id: 'weacast-arpege',
  model: 'arpege',
  dbUrl: 'mongodb://127.0.0.1:27017/weacast',
  request: {},
  subsets: {},
  nwp: {},
  elements: [{
    element: 'u-wind',
    name: 'U_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND',
    levels: [ 10 ]
  }, {
    element: 'v-wind',
    name: 'V_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND',
    levels: [ 10 ]
  }, {
    element: 'gust',
    name: 'WIND_SPEED_GUST__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND',
    levels: [ 10 ]
  }]
}

module.exports = (options) => {
  options = Object.assign(defaults, options)

  return {
    id: options.id,
    store: 'fs',
    options: {
      workersLimit: 4,
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
        token: '__qEMDoIC2ogPRlSoRQLGUBOomaxJyxdEd__',
        coverageid: '<%= name %>___<%= runTime.format() %>',
        subsets: Object.assign({
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
            query: { forecastTime: '<%= forecastTime.format() %>' },
            project: { _id: 1, runTime: 1, forecastTime: 1 }
          },
          // Do not download data if already here
          discardIf: { 'previousData.runTime': '<%= runTime.format() %>' }
        },
        after: {
          runCommand: {
            command: `weacast-gtiff2json ${outputPath}/<%= id %> -o ${outputPath}/<%= id %>.json`
          },
          // This will add grid data in a data field
          readJson: {
            key: '<%= id %>.json'
          },
          transformJson: { dataPath: 'result', pick: ['id', 'model', 'element', 'level', 'runTime', 'forecastTime', 'data'] },
          computeStatistics: { dataPath: 'result.data', min: 'minValue', max: 'maxValue' },
          writeMongoCollection: { dataPath: 'result', collection: '<%= model %>-<%= element %>', transform: { omit: ['id', 'model', 'element'] } },
          clearData: { dataPath: 'result.data' } // This will free memory for grid data
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
            index: [{ forecastTime: 1 }, { expireAfterSeconds: options.nwp.interval }],
            // Required so that client is forwarded from job to tasks
            clientPath: 'taskTemplate.client'
          })),
          // Common options for models, some will be setup on a per-model basis
          generateNwpTasks: Object.assign({
            runIndex: -1, // -1 is not current run but previous one to ensure it is already available
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
