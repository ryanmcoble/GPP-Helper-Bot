let fs = require('fs');
let System = require('./system');

// get config file
let config = JSON.parse(fs.readFileSync('config.json'));

// setup
systemInstance = System(config);

//setInterval(systemInstance.run, 1000 * config.intervalSec);
systemInstance.run();


