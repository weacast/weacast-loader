const path = require('path')
const util = require('util')
const outputPath = path.join(__dirname, 'forecast-data')

const defaults = (options) => ({
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
    accumulated: true,
    lowerLimit: 3 * 3600, // Accumulation from T to T-3H
    levels: [undefined] // Implicit surface level
  }, {
    element: 'temperature',
    name: 'TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND',
    levels: [ 2 ]
  }],
  // By naming files locally by the number of hours from run time we reuse the same names and avoid having to purge
  filepath: `<%= element %>/<%= level ? level : 'surface' %>/<%= runTime.format('HH') %>/<%= timeOffset / 3600 %>`,
  collection: '<% if (levels.length > 1) { %><%= model %>-<%= element %>-<%= level %><% } else { %><%= model %>-<%= element %><% } %>',
  archiveId: (options.isobaric ? 'archive/<%= model %>-isobaric' : 'archive/<%= model %>') +
    `/<%= runTime.format('YYYY/MM/DD/HH') %>/<%= element %>/<%= level ? level : 'surface' %>/<%= forecastTime.format('YYYY-MM-DD-HH') %>`,
  cog: true
})

module.exports = (options) => {
  options = Object.assign({}, defaults(options), options)
  const filepath = options.filepath
  const id = `${options.model}/${filepath}`
  const archiveId = options.archiveId
  const collection = options.collection
  const bucket = collection
  const keepPastRuns = options.nwp.keepPastRuns
  const indices = (item) => {
    let expiration = item.interval || options.nwp.interval
    // Extend the expiration period if we need to keep past data
    if (keepPastRuns) expiration += options.nwp.oldestRunInterval
    return [
      { x: 1, y: 1 },
      { geometry: 1 },
      { geometry: '2dsphere' },
      [{ forecastTime: 1 }, { expireAfterSeconds: expiration }],
      { forecastTime: 1, geometry: 1 }
    ]
  }
  // Forward global data store to elements
  if (options.dataStore) options.elements.forEach(element => Object.assign(element, { dataStore: options.dataStore }))
  // Check if we archive on S3
  let stores = [{
    id: 'fs',
    options: {
      path: outputPath
    }
  }]
  if (process.env.S3_BUCKET) {
    stores.push({
      id: 's3',
      options: {
        client: {
          accessKeyId: process.env.S3_ACCESS_KEY,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          endpoint: process.env.S3_ENDPOINT
        },
        bucket: process.env.S3_BUCKET
      }
    })
  }

  return {
    id: options.id,
    store: 'fs',
    options: {
      workersLimit: (process.env.WORKERS_LIMIT ? Number(process.env.WORKERS_LIMIT) : (options.workersLimit || 2)),
      faultTolerant: true
    },
    taskTemplate: {
      id,
      type: 'wcs',
      // Common options for models, some will be setup on a per-model basis
      options: Object.assign({
        url: 'https://public-api.meteofrance.fr/public/arpege/1.0/wcs/MF-NWP-GLOBAL-ARPEGE-025-GLOBE-WCS/GetCoverage',
        version: '2.0.1',
        apikey: process.env.METEO_FRANCE_TOKEN,
        coverageid: '<%= name %>___<%= runTime.format() %>',
        subsets: Object.assign({
          long: [options.bounds[0], options.bounds[2]],
          lat: [options.bounds[1], options.bounds[3]],
          time: '<%= forecastTime.format() %>'
        }, (options.isobaric ? { pressure: '<%= level %>' } : { height: '<%= level %>' }), options.subsets)
      }, options.request)
    },
    hooks: {
      tasks: {
        before: {
          // Avoid hitting rate limit by adding a delay between requests
          waitBeforeRequest: {
            hook: 'apply',
            function: async () => {
              await util.promisify(setTimeout)(process.env.REQUEST_DELAY || 3000)
            }
          },
          readMongoCollection: {
            collection,
            dataPath: 'data.previousData',
            // When keeping only the most recent forecast check if it comes from an older run time
            // When keeping all run times check if it already exist for the current run time
            query: Object.assign({ forecastTime: '<%= forecastTime.format() %>', geometry: { $exists: false } },
              keepPastRuns ? { runTime: '<%= runTime.format() %>' } : {}),
            project: { _id: 1, runTime: 1, forecastTime: 1 },
            transform: { asObject: true }
          },
          // Do not download data if already here
          discardIf: {
            predicate: (item) => item.previousData.runTime && (item.runTime.valueOf() === item.previousData.runTime.getTime())
          },
          // For surface cariables the height parameter is implicit, remove it from request as the WCS service does not like it
          surface: {
            hook: 'apply',
            function: (item) => {
              if (!item.level) delete item.options.subsets.height
            }
          },
          // When the accumulation period X is less than 1 day suffix is PTXH otherwise the suffix is PXD.
          accumulation: {
            hook: 'apply',
            match: { accumulated: true },
            function: (item) => {
              var accumulationPeriod = item.lowerLimit / 3600
              if (accumulationPeriod < 24) item.options.coverageid += '_PT' + accumulationPeriod + 'H'
              else item.options.coverageid += '_P' + (accumulationPeriod / 24) + 'D'
            }
          }
        },
        after: {
          // Generate Cloud optimized GeoTIFF for archiving
          // Move from [0°, 360°] longitude range to [-180°, 180°] longitude range whenever required
          processAndSwipeRawData: {
            match: { predicate: () => process.env.S3_BUCKET && options.cog && (options.bounds[2] > 180) },
            hook: 'runCommand',
            command: [
            // Create first a replication from [0, 360] to [-360, 0] and a VRT covering [-360, 360]
            // Then extract the portion between [-180, 180] from this VRT
              `gdal_translate -a_ullr -360.125 90.125 -0.125 -90.125 ${outputPath}/<%= id %> ${outputPath}/<%= id %>_shifted`,
              `gdalbuildvrt ${outputPath}/<%= id %>.vrt ${outputPath}/<%= id %> ${outputPath}/<%= id %>_shifted`,
              `gdal_translate ${outputPath}/<%= id %>.vrt ${outputPath}/<%= id %>_180.vrt -projwin -180.125 90.125 179.875 -90.125 -of VRT`,
              `gdalwarp -overwrite -ot Float32 -wo NUM_THREADS=6 -wo SOURCE_EXTRA=100 ${outputPath}/<%= id %>_180.vrt ${outputPath}/<%= id %>_180.tif`,
              `gdal_translate ${outputPath}/<%= id %>_180.tif ${outputPath}/<%= id %>.tif -ot Float32 -co COMPRESS=DEFLATE -co NUM_THREADS=ALL_CPUS -co TILED=YES -co BLOCKXSIZE=256 -co BLOCKYSIZE=256 -co COPY_SRC_OVERVIEWS=YES`
            ]
          },
          processRawData: {
            match: { predicate: () => process.env.S3_BUCKET && options.cog && (options.bounds[2] <= 180) },
            hook: 'runCommand',
            command: `gdal_translate ${outputPath}/<%= id %> ${outputPath}/<%= id %>.tif -ot Float32 -co COMPRESS=DEFLATE -co NUM_THREADS=ALL_CPUS -co TILED=YES -co BLOCKXSIZE=256 -co BLOCKYSIZE=256 -co COPY_SRC_OVERVIEWS=YES`
          },
          // Upload raw archive data to S3
          archiveRawData: {
            match: { predicate: () => !options.cog && process.env.S3_BUCKET },
            hook: 'copyToStore',
            input: { key: '<%= id %>', store: 'fs' },
            output: { key: `${archiveId}.tif`,
              store: 's3',
              params: { ACL: 'public-read' }
            }
          },
          archiveProcessedData: {
            match: { predicate: () => options.cog && process.env.S3_BUCKET },
            hook: 'copyToStore',
            input: { key: '<%= id %>.tif', store: 'fs' },
            output: { key: `${archiveId}.cog`,
              store: 's3',
              params: { ACL: 'public-read' }
            }
          },
          runCommand: {
            command: `weacast-gtiff2json ${outputPath}/<%= id %> -p <%= (element.precision || 2) %> -o ${outputPath}/<%= id %>.json`
          },
          // This will add grid data in a data field
          readJson: {
            key: '<%= id %>.json'
          },
          transformJson: {
            dataPath: 'result',
            pick: ['id', 'model', 'element', 'level', 'levels', 'runTime', 'forecastTime', 'data', 'dataStore', 'client']
          },
          // Convert temperature from K to C°
          // Although it would be required according to documentation it does not seem to be
          /*
          apply: {
            match: { element: 'temperature' },
            function: (item) => {
              for (let i = 0; i < item.data.length; i++) {
                item.data[i] = item.data[i] - 273.15
              }
            }
          },
          */
          computeStatistics: { dataPath: 'result.data', min: 'minValue', max: 'maxValue' },
          // Erase previous data if any
          deleteMongoCollection: {
            // Do not delete any previous data if keeping all run times
            match: { predicate: () => !keepPastRuns },
            collection,
            filter: { forecastTime: '<%= forecastTime.format() %>' }
          },
          writeRawData: {
            match: { dataStore: { $ne: 'gridfs' } },
            hook: 'writeMongoCollection',
            dataPath: 'result',
            collection,
            transform: {
              omit: ['id', 'model', 'levels', 'element', 'dataStore', 'client']
            }
          },
          writeMetaData: {
            match: { dataStore: { $eq: 'gridfs' } },
            hook: 'writeMongoCollection',
            dataPath: 'result',
            collection,
            transform: {
              omit: ['id', 'model', 'levels', 'element', 'data', 'dataStore', 'client'],
              merge: { filePath: '<%= id %>', convertedFilePath: '<%= id %>.json' }
            }
          },
          writeRawFile: {
            match: { dataStore: { $eq: 'gridfs' } },
            hook: 'writeMongoBucket',
            key: `<%= id %>.json`,
            bucket,
            metadata: { forecastTime: '<%= forecastTime.format() %>' }
          },
          emitEvent: { name: collection, pick: [ 'runTime', 'forecastTime' ] },
          tileGrid: {
            match: { predicate: (item) => options.tileResolution },
            dataPath: 'result.data',
            input: { bounds: options.bounds, origin: options.origin, size: options.size, resolution: options.resolution },
            output: { resolution: options.tileResolution },
            transform: {
              merge: { forecastTime: '<%= forecastTime.format() %>', runTime: '<%= runTime.format() %>', timeseries: false }
            }
          },
          writeTiles: {
            hook: 'writeMongoCollection',
            dataPath: 'result.data',
            collection,
            match: { predicate: (item) => options.tileResolution },
            transform: {
              unitMapping: { forecastTime: { asDate: 'utc' }, runTime: { asDate: 'utc' } }
            }
          },
          clearData: {} // This will free memory for grid data
        }
      },
      jobs: {
        before: {
          createStores: stores,
          connectMongo: {
            url: options.dbUrl,
            // Required so that client is forwarded from job to tasks
            clientPath: 'taskTemplate.client'
          },
          createCollections: {
            hook: 'parallel',
            hooks: options.elements.map(item => (item.levels || [null]).map(level => ({
              hook: 'createMongoCollection',
              collection: (item.levels && item.levels.length > 1 ? `${options.model}-${item.element}-${level}` : `${options.model}-${item.element}`),
              indices: indices(item),
              // Required so that client is forwarded from job to tasks
              clientPath: 'taskTemplate.client'
            }))).reduce((hooks, hooksForLevels) => hooks.concat(hooksForLevels), [])
          },
          createBuckets: {
            hook: 'parallel',
            hooks: options.elements.filter(item => item.dataStore === 'gridfs').map(item => (item.levels || [null]).map(level => ({
              hook: 'createMongoBucket',
              bucket: (item.levels && item.levels.length > 1 ? `${options.model}-${item.element}-${level}` : `${options.model}-${item.element}`),
              // Required so that client is forwarded from job to tasks
              clientPath: 'taskTemplate.client'
            }))).reduce((hooks, hooksForLevels) => hooks.concat(hooksForLevels), [])
          },
          // Common options for models, some will be setup on a per-model basis
          generateNwpTasks: Object.assign({
            runIndex: 0, // -1 is not current run but previous one to ensure it is already available
            keepPastForecasts: true, // We'd like to keep forecast data since the start of the run for archiving
            elements: options.elements.map(element => Object.assign({ model: options.model }, element))
          }, options.nwp)
        },
        after: {
          disconnectMongo: {
            clientPath: 'taskTemplate.client'
          },
          clearOutputs: {},
          removeStores: stores.map(store => store.id)
        }
      }
    }
  }
}
