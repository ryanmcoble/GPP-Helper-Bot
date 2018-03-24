let rp = require('request-promise');

module.exports = function() {

    // get settings files
    async function getSettings(settingsURL) {
        return new Promise((resolve, reject) => {
            rp({
                method: 'GET',
                uri: settingsURL,
                json: true
            }).then((res) => {
                resolve(res);
            }).catch((err) => {
                console.log('ERROR: ' + err.message);
                reject(err.message);
            });
        });
    }


    return {
        getSettings
    };
};