"use strict";
const Dropbox = require('dropbox').Dropbox;
const dropboxV2Api = require('dropbox-v2-api');
const fs = require('fs');
const axios = require('axios');
const fetch2 = require('node-fetch');
const core = require('@actions/core');
const github = require('@actions/github');
const glob = require('glob');
const accessToken = core.getInput('DROPBOX_ACCESS_TOKEN');
const globSource = core.getInput('GLOB');
const dropboxPathPrefix = core.getInput('DROPBOX_DESTINATION_PATH_PREFIX');
const isDebug = core.getInput('DEBUG');
const key = core.getInput('GIT_KEY');
// const dropbox = new Dropbox({accessToken: accessToken, fetch: fetch2});
const dropbox = dropboxV2Api.authenticate({
    token: accessToken
});
// const uploadMuhFile = (filePath) => {
//     const file = fs.readFileSync(filePath);
//     const destinationPath = `${dropboxPathPrefix}/${filePath}`;
//     if (isDebug)
//         console.log('uploaded file to Dropbox at: ', destinationPath);
//     return dropbox
//         .filesUpload({ path: destinationPath, contents: file })
//         .then(response => {
//         if (isDebug)
//             console.log(response);
//         return response;
//     })
//         .catch(error => {
//         if (isDebug)
//             console.error(error);
//         return error;
//     });
// }
axios
    .get('https://api.github.com/repos/maxshadov/test/actions/artifacts', {
        headers: {
            'Authorization': `Bearer ${key}`
        }
    })
    .then(res => {
        let file;
        axios({
            url: res.data.artifacts[0].archive_download_url,
            method: 'GET',
            responseType: 'stream',
            headers: {
                'Authorization': `Bearer ${key}`
            }
        }).then((response) => {
            file = response.data.pipe(fs.createWriteStream("back.zip"));
            const stream = dropbox({
                resource: 'files/upload_session/start',
                parameters: {
                    'close': false
                }
            }, (err, result, response) => {
                console.log(err);
            });

            fs.createReadStream(file).pipe(stream);
        })
        // .then(() => {
        //     const destinationPath = `${dropboxPathPrefix}.zip`;
        //     if (isDebug)
        //         console.log('uploaded file to Dropbox at: ', destinationPath);
        //     return dropbox
        //         .filesUpload({path: destinationPath, contents: file})
        //         .then(response => {
        //             if (isDebug)
        //                 console.log(response);
        //             return response;
        //         })
        //         .catch(error => {
        //             if (isDebug)
        //                 console.error(error);
        //             return error;
        //         });
        // });

    })
    .catch(() => console.log('Some error'));

// glob(globSource, {}, (err, files) => {
//     if (err)
//         core.setFailed('Error: glob failed', err);
//     Promise.all(files.map(uploadMuhFile))
//         .then(all => {
//         console.log('all files uploaded', all);
//     })
//         .catch(err => {
//         console.error('error', err);
//     });
// });
