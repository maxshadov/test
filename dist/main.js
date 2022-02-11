"use strict";
const Dropbox = require('dropbox').Dropbox;
const axios = require('axios');
const fetch2 = require('node-fetch');
const core = require('@actions/core');

const accessToken = core.getInput('DROPBOX_ACCESS_TOKEN');
const dropboxPathPrefix = core.getInput('DROPBOX_DESTINATION_PATH_PREFIX');
const isDebug = core.getInput('DEBUG');
const key = core.getInput('GIT_KEY');
const dropbox = new Dropbox({accessToken: accessToken, fetch: fetch2});

axios
    .get('https://api.github.com/repos/maxshadov/test/actions/artifacts', {
        headers: {
            'Authorization': `Bearer ${key}`
        }
    })
    .then(res => {
        console.log(res.data.artifacts[0].created_at);
        axios({
            url: res.data.artifacts[0].archive_download_url,
            method: 'GET',
            responseType: 'arraybuffer',
            headers: {
                'Authorization': `Bearer ${key}`
            }
        }).then(blob => {
            const destinationPath = `/Sanity/${dropboxPathPrefix}/backup-${res.data.artifacts[0].created_at}.zip`;
            if (isDebug)
                console.log('uploaded file to Dropbox at: ', destinationPath);
            return dropbox
                .filesUpload({path: destinationPath, contents: blob.data}).then(response => {
                    if (isDebug)
                        console.log(response);
                    return response;
                })
                .catch(error => {
                    if (isDebug)
                        console.error(error);
                    core.setFailed(error)
                    return error;
                });
        });

    })
    .catch(error => {
        core.setFailed(error)
    });
