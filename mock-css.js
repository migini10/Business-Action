const fs = require('fs');
require.extensions['.css'] = () => { return module.exports = {}; };
global.WebSocket = class WebSocket {};
