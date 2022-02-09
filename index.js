const sanity = require('@sanity/client')
const fs = require('fs')
const EOL = require('os').EOL
const flatMap = require('lodash.flatmap')
const { subDays, isBefore } = require('date-fns')
const sanityExport = require('@sanity/export')

/**
* @param context {WebtaskContext}
*/
const backupHosts = function(context, cb) {
  const dfs = require('dropbox-fs')({
    apiKey: context.secrets.dropbox_token,
  })

  const { sanity_projectid, sanity_dataset } = context.meta

  const projectIds = sanity_projectid.split(';')
  const datasets = sanity_dataset.split(';').map(ds => ds.split(','))
  const tokens = context.secrets.sanity_token.split(';')

  const dfolder = context.meta.dropbox_folder

  const promises = flatMap(projectIds, (pid, i) =>
    datasets[i].map(
      ds =>
        new Promise((resolve, reject) => {
          const projectId = pid.trim()
          const dataset = ds.trim()
          const token = tokens[i].trim()

          const sanityClient = sanity({
            projectId,
            dataset,
            token,
          })

          console.log(projectId, dataset)

          const filename = `${projectId}-${dataset}-${new Date().toISOString()}.ndjson`

          sanityClient
            .fetch(`*[_type == "host"]`)
            .then(hosts => {
              console.log(`found ${hosts.length} hosts`)
              const ndjson = hosts.reduce(
                (acc, host) => acc + JSON.stringify(host) + EOL,
                ''
              )

              console.log(ndjson)

              dfs.writeFile(
                `${dfolder}${filename}`,
                ndjson,
                {},
                (err, stat) => {
                  if (err) reject(err, stat)

                  dfs.readdir(dfolder, (err, res) => {
                    const promises = res
                      .filter(f => {
                        const fileDate = new Date(f.split('-')[2].split('.')[0])
                        const twoMonthsAgo = subDays(new Date(), 60)
                        return isBefore(fileDate, twoMonthsAgo)
                      })
                      .map(
                        file =>
                          new Promise((resolve, reject) => {
                            console.log(
                              `Deleting ${file} from dropbox because it's older than 60 days`
                            )

                            dfs.unlink(
                              `${dfolder}${file}`,
                              err => (err ? reject(err) : resolve())
                            )
                          })
                      )
                    Promise.all(promises)
                      .then(() => resolve(stat))
                      .catch(err => reject(err))
                  })
                }
              )
            })
            .catch(err => reject(err))
        })
    )
  )

  Promise.all(promises)
    .then(stat => cb(null, stat))
    .catch((err, stat) => cb(err, stat))
}

module.exports = function(context, cb) {
  const dfs = require('dropbox-fs')({
    apiKey: context.secrets.dropbox_token,
  })

  const { sanity_projectid, sanity_dataset } = context.meta

  const projectIds = sanity_projectid.split(';')
  const datasets = sanity_dataset.split(';').map(ds => ds.split(','))
  const tokens = context.secrets.sanity_token.split(';')

  const dfolder = context.meta.dropbox_folder

  const promises = flatMap(projectIds, (pid, i) =>
    datasets[i].map(
      ds =>
        new Promise((resolve, reject) => {
          const projectId = pid.trim()
          const dataset = ds.trim()
          const token = tokens[i].trim()

          const sanityClient = sanity({
            projectId,
            dataset,
            token,
          })

          console.log(projectId, dataset)

          const folderPath = `${context.meta
            .dropbox_folder}${projectId}/${dataset}/`
          const filepath = `${folderPath}${new Date().toISOString()}.zip`

          sanityExport({
            // Instance of @sanity/client configured to correct project ID and dataset
            client: sanityClient,

            // Name of dataset to export
            dataset: dataset,

            // Path to write zip-file to, or `-` for stdout
            outputPath: `/tmp/sanity.zip`,

            // Whether or not to export assets. Note that this operation is currently slightly lossy;
            // metadata stored on the asset document itself (original filename, for instance) might be lost
            // Default: `true`
            assets: false,

            // Exports documents only, without downloading or rewriting asset references
            // Default: `false`
            raw: false,

            // Whether or not to export drafts
            // Default: `true`
            drafts: true,

            // Export only given document types (`_type`)
            // Optional, default: all types
            //types: ['products', 'shops']
          })
            .then(() => {
              fs.readFile('/tmp/sanity.zip', (err, data) => {
                if (err) return reject(err)

                console.log('Writing to', filepath)
                dfs.writeFile(
                  filepath,
                  data,
                  { encoding: 'gzip' },
                  (err, stat) => {
                    if (err) return reject(err, stat)

                    dfs.readdir(folderPath, (err, files) => {
                      const promises = files
                        .filter(f => {
                          const dateString = f.split('.zip')[0]
                          console.log('File date string:', dateString)
                          const fileDate = new Date(dateString)
                          const twoMonthsAgo = subDays(new Date(), 60)
                          console.log('File date:', fileDate)
                          return isBefore(fileDate, twoMonthsAgo)
                        })
                        .map(
                          file =>
                            new Promise((resolve, reject) => {
                              console.log(
                                `Deleting ${folderpath}${file} from dropbox because it's older than 60 days`
                              )

                              dfs.unlink(
                                `${folderpath}/${file}`,
                                err => (err ? reject(err) : resolve())
                              )
                            })
                        )
                      Promise.all(promises)
                        .then(() => resolve(stat))
                        .catch(err => reject(err))
                    })
                  }
                )
              })
            })
            .catch(err => reject(err))
        })
    )
  )

  Promise.all(promises)
    .then(stat => cb(null, stat))
    .catch((err, stat) => cb(err, stat))
}
