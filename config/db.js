'use strict';
const mongoose = require('mongoose');

// Database URI
// In Azure Portal, see Function App -> Platform Features
// -> Application Settings -> MONGODB_CONNECTION
// For local development, see local.settings.json
const dbURI = process.env.MONGODB_CONNECTION;

mongoose.debug = true;
mongoose.Promise = global.Promise;
mongoose.connect(dbURI, { useNewUrlParser: true  });

module.exports = mongoose;
