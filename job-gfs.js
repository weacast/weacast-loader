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
  }, {
    element: 'temperature',
    name: 'var_TMP',
    levels: [ 'lev_2_m_above_ground' ]
  }]
}

module.exports = (options) => {
  options = Object.assign({}, defaults, options)
  const filepath = `<%= element %>/<%= level.split('_')[1] %>/<%= timeOffset / 3600 %>`
  const id = `${options.model}/${filepath}`
  const archiveId = `archive/${options.model}/<%= runTime.format('YYYY/MM/DD/HH') %>/<%= element %>/<%= level.split('_')[1] %>/<%= forecastTime.format('YYYY-MM-DD-HH') %>`
  const collection = (options.isobaric
    ? `${options.model}-<%= element %>-<%= level.split('_')[1] %>` : '<%= model %>-<%= element %>')
  const indices = (item) => [
    { x: 1, y: 1 },
    { geometry: 1 },
    { geometry: '2dsphere' },
    [{ forecastTime: 1 }, { expireAfterSeconds: item.interval || options.nwp.interval }],
    { forecastTime: 1, geometry: 1 }
  ]
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
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
        },
        bucket: process.env.S3_BUCKET
      }
    })
  }

  return {
    id: options.id,
    store: 'fs',
    options: {
      workersLimit: options.workersLimit || 2,
      faultTolerant: true
    },
    taskTemplate: {
      id,
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
            collection,
            dataPath: 'data.previousData',
            query: { forecastTime: '<%= forecastTime.format() %>', geometry: { $exists: false } },
            project: { _id: 1, runTime: 1, forecastTime: 1 },
            transform: { asObject: true }
          },
          // Do not download data if already here
          discardIf: { predicate: (item) => item.previousData.runTime && (item.runTime.valueOf() === item.previousData.runTime.getTime()) }
        },
        after: {
          // Generate Cloud optimized GeoTIFF for archiving
          // Move from [0°, 360°] longitude range to [-180°, 180°] longitude range whenever required
          processAndSwipeRawData: {
            match: { predicate: () => process.env.S3_BUCKET && (options.bounds[2] > 180) },
            hook: 'runCommand',
            command: [
            // First convert from Grib to GeoTiff
            // Then create a replication from [0, 360] to [-360, 0] and a VRT covering [-360, 360]
            // Last extract the portion between [-180, 180] from this VRT
            `gdal_translate ${outputPath}/<%= id %> ${outputPath}/<%= id %>_raw`,
            `gdal_translate -a_ullr -360.25 90.25 -0.25 -90.25 ${outputPath}/<%= id %>_raw ${outputPath}/<%= id %>_shifted`,
            `gdalbuildvrt ${outputPath}/<%= id %>.vrt ${outputPath}/<%= id %>_raw ${outputPath}/<%= id %>_shifted`,
            `gdal_translate ${outputPath}/<%= id %>.vrt ${outputPath}/<%= id %>_180.vrt -projwin -180.25 90.25 179.75 -90.25 -of VRT`,
            `gdalwarp -overwrite -ot Float32 -wo NUM_THREADS=6 -wo SOURCE_EXTRA=100 ${outputPath}/<%= id %>_180.vrt ${outputPath}/<%= id %>_180.tif`,
            `gdal_translate ${outputPath}/<%= id %>_180.tif ${outputPath}/<%= id %>.tif -ot Float32 -co COMPRESS=DEFLATE -co NUM_THREADS=ALL_CPUS -co TILED=YES -co BLOCKXSIZE=256 -co BLOCKYSIZE=256 -co COPY_SRC_OVERVIEWS=YES`
            ]
          },
          processRawData: {
            match: { predicate: () => process.env.S3_BUCKET && (options.bounds[2] <= 180) },
            hook: 'runCommand',
            command: `gdal_translate ${outputPath}/<%= id %> ${outputPath}/<%= id %>.tif -ot Float32 -co COMPRESS=DEFLATE -co NUM_THREADS=ALL_CPUS -co TILED=YES -co BLOCKXSIZE=256 -co BLOCKYSIZE=256 -co COPY_SRC_OVERVIEWS=YES`
          },
          // Upload archive data to S3
          /* Raw data is too big to be archived right now
          archiveRawData: {
            match: { predicate: () => process.env.S3_BUCKET },
            hook: 'copyToStore',
            input: { key: '<%= id %>', store: 'fs' },
            output: { key: `${archiveId}.grib`, store: 's3',
              params: { ACL: 'public-read' }
            }
          },
          */
          archiveProcessedData: {
            match: { predicate: () => process.env.S3_BUCKET },
            hook: 'copyToStore',
            input: { key: '<%= id %>.tif', store: 'fs' },
            output: { key: `${archiveId}.cog`, store: 's3',
              params: { ACL: 'public-read' }
            }
          },
          runCommand: {
            command: `weacast-grib2json ${outputPath}/<%= id %> -d -p <%= (element.precision || 2) %> -o ${outputPath}/<%= id %>.json`
          },
          // This will add grid data in a data field
          readJson: {
            objectPath: '[0].data',
            key: '<%= id %>.json'
          },
          transformJson: { dataPath: 'result', pick: ['id', 'model', 'element', 'level', 'runTime', 'forecastTime', 'data', 'client'] },
          // For forecast hours evenly divisible by 6, the accumulation period is from T-6h to T,
          // while for other forecast hours (divisible by 3 but not 6) it is from T-3h to T.
          // We unify everything to 3H accumulation period.
          normalizePrecipitations: { hook: 'apply',
            match: { element: 'precipitations', predicate: (item) => item.forecastTime.hours() % 6 === 0 },
            function: (item) => {
              for (let i = 0; i < item.data.length; i++) {
                item.data[i] = 0.5 * item.data[i]
              }
            }
          },
          // Convert temperature from K to C°
          convertTemperature: { hook: 'apply',
            match: { element: 'temperature' },
            function: (item) => {
              for (let i = 0; i < item.data.length; i++) {
                item.data[i] = item.data[i] - 273.15
              }
            }
          },
          computeStatistics: { dataPath: 'result.data', min: 'minValue', max: 'maxValue' },
          // Erase previous data if any
          deleteMongoCollection: {
            collection,
            filter: { forecastTime: '<%= forecastTime.format() %>' }
          },
          writeRawData: { hook: 'writeMongoCollection',
            dataPath: 'result',
            collection,
            transform: { omit: ['id', 'model', 'element', 'client'] } },
          emitEvent: { name: collection, pick: [ 'runTime', 'forecastTime' ] },
          tileGrid: {
            match: { predicate: (item) => options.tileResolution },
            dataPath: 'result.data',
            input: { bounds: options.bounds, origin: options.origin, size: options.size, resolution: options.resolution },
            output: { resolution: options.tileResolution },
            transform: { merge: { forecastTime: '<%= forecastTime.format() %>', runTime: '<%= runTime.format() %>', timeseries: false } }
          },
          writeTiles: { hook: 'writeMongoCollection',
            dataPath: 'result.data',
            collection,
            match: { predicate: (item) => options.tileResolution },
            transform: { unitMapping: { forecastTime: { asDate: 'utc' }, runTime: { asDate: 'utc' } } }
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
          parallel: (options.isobaric
            ? options.elements.map(item => item.levels.map(level => ({
              hook: 'createMongoCollection',
              collection: `${options.model}-${item.element}-${level.split('_')[1]}`,
              indices: indices(item),
              // Required so that client is forwarded from job to tasks
              clientPath: 'taskTemplate.client'
            }))).reduce((hooks, hooksForLevels) => hooks.concat(hooksForLevels), [])
            : options.elements.map(item => ({
              hook: 'createMongoCollection',
              collection: `${options.model}-${item.element}`,
              indices: indices(item),
              // Required so that client is forwarded from job to tasks
              clientPath: 'taskTemplate.client'
            }))
          ),
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
          removeStores: stores.map(store => store.id)
        }
      }
    }
  }
}
