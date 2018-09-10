const path = require('path')
const fs = require('fs')

module.exports = {
  store: 'fs',
  options: {
    workersLimit: 4,
    faultTolerant: true
  },
  taskTemplate: {
    //id: 'gfs/<%= element %>/<%= level %>/<%= forecastTime.format(\'YYYY-MM-DD[_]HH-mm-ss\') %>',
    id: 'gfs/<%= element %>/<%= level.split(\'_\')[1] %>/<%= timeOffset / 3600 %>',
    type: 'http',
    options: {
      url: 'http://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p50.pl',
      dir: '/gfs.<%= runTime.format(\'YYYYMMDDHH\') %>',
      file: 'gfs.t<%= runTime.format(\'HH\') %>z.pgrb2full.0p50.f<%= (timeOffset / 3600).toString().padStart(3, \'0\') %>',
      subregion: true,
      leftlon: 0,
      rightlon: 360,
      bottomlat: -90,
      toplat: 90,
      '<%= name %>': 'on',
      '<%= level %>': 'on'
    }
  },
  taskTemplate: {
    //id: 'arpege/<%= element %>/<%= level %>/<%= forecastTime.format(\'YYYY-MM-DD[_]HH-mm-ss\') %>',
    id: 'arpege/<%= element %>/<%= level %>/<%= timeOffset / 3600 %>',
    type: 'wcs',
    options: {
      url: 'https://geoservices.meteofrance.fr/services/MF-NWP-GLOBAL-ARPEGE-05-GLOBE-WCS',
      version: '2.0.1',
      token: '__qEMDoIC2ogPRlSoRQLGUBOomaxJyxdEd__',
      coverageid: '<%= name %>___<%= runTime.format() %>',
      subsets: {
        time: '<%= forecastTime.format() %>',
        height: '<%= level %>',
        long: [-180, 180],
        lat: [-90, 90]
      }
    }
  },
  hooks: {
    tasks: {
      before: {
        readMongoCollection: {
          collection: '<%= model %>-<%= element %>', dataPath: 'data.previousData',
          query: { forecastTime: '<%= forecastTime.format() %>' },
          project: { _id: 1, runTime: 1, forecastTime: 1 }
        },
        // Do not download data if already here
        discardIf: { 'previousData.runTime': '<%= runTime.format() %>' }
      },
      after: {
        runCommand: {
          command: 'weacast-gtiff2json ./output/<%= id %> -o ./output/<%= id %>.json'
        },
        runCommand: {
          command: 'weacast-grib2json ./output/<%= id %> -d -o ./output/<%= id %>.json'
        },
        // This will add grid data in a data field
        readJson: {
          key: '<%= id %>.json'
        },
        readJson: {
          objectPath: '[0].data',
          key: '<%= id %>.json'
        },
        transformJson: { dataPath: 'result', pick: ['id', 'element', 'level', 'runTime', 'forecastTime', 'data'] },
        writeMongoCollection: { dataPath: 'result', collection: '<%= model %>-<%= element %>', transform: { omit: ['id', 'element'] } },
        clearData: { dataPath: 'result.data' } // This will free memory for grid data
      }
    },
    jobs: {
      before: {
        createStores: [{
          id: 'fs',
          options: {
            path: path.join(__dirname, 'output')
          }
        }],
        generateNwpTasks: {
          runInterval: 6 * 3600,          // Produced every 6h
          interval: 3 * 3600,             // Steps of 3h
          lowerLimit: 0 * 3600,           // From T0
          upperLimit: 3 * 3600,           // Up to T0 + 3h for testing
          runIndex: 0,                    // -1 is not current run but previous one to ensure it is already available
          elements: [{
            element: 'u-wind',
            model: 'gfs-world',
            name: 'var_UGRD',
            levels: [ 'lev_10_m_above_ground' ]
          }, {
            element: 'v-wind',
            model: 'gfs-world',
            name: 'var_VGRD',
            levels: [ 'lev_10_m_above_ground' ]
          }, {
            element: 'gust',
            model: 'gfs-world',
            name: 'var_GUST',
            levels: [ 'surface' ]
          }]
        }
      },
        generateNwpTasks: {
          runInterval: 6 * 3600,          // Produced every 6h
          interval: 3 * 3600,             // Steps of 3h
          lowerLimit: 0 * 3600,           // From T0
          upperLimit: 3 * 3600,           // Up to T0 + 3h for testing
          runIndex: 0,                    // -1 is not current run but previous one to ensure it is already available
          elements: [{
            element: 'u-wind',
            model: 'arpege-world',
            name: 'U_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND',
            levels: [ 10 ]
          }, {
            element: 'v-wind',
            model: 'arpege-world',
            name: 'V_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND',
            levels: [ 10 ]
          }, {
            element: 'gust',
            model: 'arpege-world',
            name: 'WIND_SPEED_GUST__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND',
            levels: [ 10 ]
          }]
        }
      },
      after: {
        clearOutputs: {},
        removeStores: ['fs']
      }
    }
  }
}
