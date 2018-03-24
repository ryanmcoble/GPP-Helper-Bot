let fs    = require('fs');
let async = require('async');

let IO       = require('./IO')();
let facebook = require('./facebookRepo')();
let analysis = require('./analysis')();

module.exports = function(config) {
    let isInitialized      = false;
    let tokenCloseToExpire = false;
    let settings           = '';

    // process a single post
    async function processPost(post) {
        return new Promise((resolve, reject) => {
            let searchResults = analysis.search(post.message);
            // has results
            if(!searchResults || !searchResults.length) {
                return resolve(false);
            }

            // check if category exist within settings
            if(!settings || typeof settings[searchResults[0].id] === 'undefined') {
                return resolve(false);
            }

            let category = settings[searchResults[0].id];
            let redirectPost = {
                message: category.redirectMessage
            };

            facebook.postComment(post.id, redirectPost).then((comment) => {
                console.log('REDIRECT POST (' + comment.id + ') ADDED!');
                return resolve(true);
            }).catch((err) => {
                return resolve(false);
            });
        });
    }

    // check if a post has already been processed
    async function hasBeenProcessed(post) {
        return new Promise((resolve, reject) => {
            facebook.getPostComments(post.id).then((comments) => {
                // no comments on the post
                if(comments && !comments.length) {
                    return resolve(false);
                }

                for(let iComment in comments) {
                    let comment = comments[iComment];
                    if(comment.from.id == config.botUserId) {
                        console.log('REDIRECT POST ALREADY FOUND!');
                        return resolve(true);
                    }
                }
                return resolve(false);
            }).catch((err) => {
                return resolve(false);
            });
        });
    }

    // initialize system
    async function initialize() {
        return new Promise((resolve, reject) => {
            // only the first time
            if(!isInitialized) {
                facebook.initialize(config.pageAccessToken, config.fbVersion);

                // get settings file before we start processing
                (async() => {
                    settings = await IO.getSettings(config.settingsURL);
                    if(!settings) {
                        console.log('ERROR: Settings file not found!');
                        return resolve(false);
                    }

                    // load up all known documents
                    for(let iSection in settings) {
                        let section = settings[iSection];
                        analysis.addDocument({
                            id: iSection,
                            body: section.words.join(' '),
                            message: section.redirectMessage
                        });
                    }
                })();
            }
            // extend the access token
            facebook.extendAccessToken(config.appId, config.secret, config.pageAccessToken).then((accessToken) => {
                config.pageAccessToken = accessToken;
                fs.writeFileSync('config.json', JSON.stringify(config, null, 4));
                isInitialized = true;
                return resolve(true);
            }).catch(function(err) {
                return resolve(false);
            });
        });
    }

    // run a session of processing posts
    async function runSession() {
        // every time we run a session we check if the access token is valid and system has been initialized
        if(!isInitialized || tokenCloseToExpire) await initialize();

        // get all recent posts
        facebook.getGroupFeed(config.groupId).then(async(posts) => {
            for(let iPost in posts) {
                let post = posts[iPost];
                if(typeof post.message === 'undefined') continue;

                // check if post has already been processed
                let beenProcessed = await hasBeenProcessed(post);
                if(!beenProcessed)  await processPost(post);
            }
        }).catch((err) => {
            console.log('ERROR: ' + err.message);
        });
    }


    return {
        run: runSession
    };
};