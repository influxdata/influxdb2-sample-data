import { readJSON } from 'https://deno.land/x/flat@0.0.10/src/json.ts'
import { writeTXT } from 'https://deno.land/x/flat@0.0.10/src/txt.ts'
import { Point } from 'https://cdn.skypack.dev/@influxdata/influxdb-client-browser?dts'

const earthquakeJSON = await readJSON('./usgs-earthquake-data/all_week.geojson')

let lpLines = []
earthquakeJSON.features.forEach((feature, index) => {
    let point = new Point(feature.properties.type)
      .timestamp(feature.properties.time * 1000000)

      .floatField('lon', feature.geometry.coordinates[0])
      .floatField('lat', feature.geometry.coordinates[1])
      .floatField('depth', feature.geometry.coordinates[2])
      .floatField('mag', feature.properties.mag || 0.0)
      .stringField('place', feature.properties.place)
      .stringField('url', feature.properties.url)
      .stringField('detail', feature.properties.detail)
      .intField('felt', feature.properties.felt || 0)
      .floatField('cdi', feature.properties.cdi || 0.0)
      .floatField('mmi', feature.properties.mmi || 0.0)
      .stringField('alert', feature.properties.alert)
      .stringField('status', feature.properties.status)
      .intField('tsunami', feature.properties.tsunami || 0)
      .intField('sig', feature.properties.sig || 0)
      .stringField('ids', feature.properties.ids)
      .stringField('sources', feature.properties.sources)
      .stringField('types', feature.properties.types)
      .intField('nst', feature.properties.nst || 0)
      .floatField('dmin', feature.properties.dmin || 0.0)
      .floatField('rms', feature.properties.rms || 0.0)
      .floatField('gap', feature.properties.gap || 0.0)
      
      .tag('net', feature.properties.net)
      .tag('code', feature.properties.code)
      .tag('magType', feature.properties.magType)
      .tag('title', feature.properties.title)
      .tag('id', feature.id)
        
    lpLines.push(point.toLineProtocol())
})

const newFilename = `./usgs-earthquake-data/all_week.lp`
await writeTXT(newFilename, lpLines.join('\n'))
