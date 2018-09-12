const path = require('path')

const defaults = {
  id: 'weacast-gfs',
  model: 'gfs',
  request: {},
  nwp: {},
  elements: [{
    element: 'u-wind',
    name: 'var_UGRD',
    levels: [ 'lev_10_m_above_ground' ]
  }, {
    element: 'v-wind',
    name: 'var_VGRD',
    levels: [ 'lev_10_m_above_ground' ]
  }, {
    element: 'gust',
    name: 'var_GUST',
    levels: [ 'lev_surface' ]
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
      // id: 'gfs/<%= element %>/<%= level %>/<%= forecastTime.format(\'YYYY-MM-DD[_]HH-mm-ss\') %>',
      id: `${options.model}/<%= element %>/<%= level.split('_')[1] %>/<%= timeOffset / 3600 %>`,
      type: 'http',
      // Common options for models, some will be setup on a per-model basis
      options: Object.assign({
        url: 'http://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p50.pl',
        dir: '/gfs.<%= runTime.format(\'YYYYMMDDHH\') %>',
        file: 'gfs.t<%= runTime.format(\'HH\') %>z.pgrb2full.0p50.f<%= (timeOffset / 3600).toString().padStart(3, \'0\') %>',
        subregion: null,
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
            query: { forecastTime: '<%= forecastTime.format() %>' },
            project: { _id: 1, runTime: 1, forecastTime: 1 }
          },
          // Do not download data if already here
          discardIf: { 'previousData.runTime': '<%= runTime.format() %>' }
        },
        after: {
          runCommand: {
            command: 'weacast-grib2json ./output/<%= id %> -d -o ./output/<%= id %>.json'
          },
          // This will add grid data in a data field
          readJson: {
            objectPath: '[0].data',
            key: '<%= id %>.json'
          },
          transformJson: { dataPath: 'result', pick: ['id', 'model', 'element', 'level', 'runTime', 'forecastTime', 'data'] },
          writeMongoCollection: { dataPath: 'result', collection: '<%= model %>-<%= element %>', transform: { omit: ['id', 'model', 'element'] } },
          clearData: { dataPath: 'result.data' } // This will free memory for grid data
        }
      },
      jobs: {
        before: {
          createStores: [{
            id: 'fs',
            options: {
              path: path.join(__dirname, 'forecast-data')
            }
          }],
          connectMongo: {
            url: 'mongodb://127.0.0.1:27017/weacast',
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
