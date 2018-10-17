const mongoose = require('mongoose');

var AppSettingsSchema = mongoose.Schema({
  'timeout': {
    'default': { type: Number, required: true },
    'getStations': { type: Number, required: false },
    'createTransaction': { type: Number, required: false }
  },
  'beaconEnabled': {
    type: Boolean,
    required: true
  },
  'stationRadius': {
    type: Number,
    required: true
  },
  'platform': {
    type: String,
    required: true
  },
  'version': {
    type: String,
    required: true
  },
  'supported': {
    type: Boolean,
    required: true
  },
  'upgradeMessage': {
    type: String,
    required: true
  }
});

const AppSettings = mongoose.model('AppSettings', AppSettingsSchema);
module.exports = AppSettings;
