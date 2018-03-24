let graph = require('fbgraph');

module.exports = function() {
    // initialize the facebook API connection
    function initialize(acccessToken, facebookAPIVersion = '2.12') {
        // setup facebook Graph API connection
        graph.setAccessToken(acccessToken);
        graph.setVersion(facebookAPIVersion);
    }

    // extend a facebook access token
    function extendAccessToken(appId, appSecret, accessToken) {
        return new Promise((resolve, reject) => {
            // extend the access token
            graph.extendAccessToken({
                client_id:     appId,
                client_secret: appSecret,
                access_token:  accessToken
            }, (err, res) => {
                if(err) {
                    console.log('ERROR: ' + err.message);
                    return reject(err);
                }
                if(typeof res.access_token !== 'undefined') {
                    graph.setAccessToken(res.access_token);
                    return resolve(res.access_token);
                }
            });
        });
    }

    // get the post feed of a group
    function getGroupFeed(groupId) {
        return new Promise((resolve, reject) => {
            graph.get('/' + groupId + '/feed', async (err, res) => {
                if(err) {
                    console.log('ERROR: ' + err.message);
                    return reject(err);
                }
                return resolve(res.data);
            });
        });
    }

    // get the comments on a post
    function getPostComments(postId) {
        return new Promise((resolve, reject) => {
            graph.get('/' + postId + '/comments', (err, res) => {
                if(err) {
                    console.log('ERROR: ' + err.message);
                    return reject(err);
                }
                return resolve(res.data);
            });
        });
    }

    // post a comment to post
    function postComment(postId, comment) {
        return new Promise((resolve, reject) => {
            graph.post('/' + postId + '/comments', comment, (err, res) => {
                if(err) {
                    console.log('ERROR: ' + err.message);
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }


    return {
        initialize,
        extendAccessToken,
        getGroupFeed,
        getPostComments,
        postComment
    };

};