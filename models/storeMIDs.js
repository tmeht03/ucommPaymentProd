
const mongoose = require('mongoose');
// Stores Merchant Ids for each station where OTF or scan and go is enabled. This MID is used to send to FD to recognize the source store for a particular transaction
var storeMidSchema = mongoose.Schema({
    // unique id for each store
    'STORE #': {
        type: String,
        required: true
    },
    // MID for the stores where OTF or SNG is enabled
    'OtfMerchantId': {
        type: String,
        required: false
    },
    'SngMerchantId': {
        type: String,
        required: false
    },
    'divisionName': {
        type: String,
        required: false
    }
});

const StoreMid = mongoose.model('StoreMid', storeMidSchema);
module.exports = StoreMid;
