
const mongoose = require('mongoose');
// Stores the store closing time for each store each day which can be used to generate the reconciliation report
var storeCloseSchema = mongoose.Schema({
    // unique id for each store
    'store#': {
        type: String,
        required: true
    },
    // date for which store close will be updated
    'date': {
        type: Date,
        required: true
    },
    // Determines the time at which the store was closed on that day
    'storeCloseTime': {
        type: Date,
        required: true
    },
    // stores the time when the store was opened
    'storeOpenTime': {
        type: Number,
        required: false
    }
});

const StoreClose = mongoose.model('StoreClose', storeCloseSchema);
module.exports = StoreClose;
