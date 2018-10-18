require("../config/db");
const storeClose = require('../models/StoreClose');
const axios = require('axios');
const host = process.env.WEBSITE_HOSTNAME;
const baseUrl = host.includes('localhost') ? `http://${host}` : `https://${host}`;

// This function is used to update store close timing for each day

const updateStoreCloseInfo = (context, body) => {

    new storeClose(body)
        .save()
        .then(newstoreClose => {
            context.res = {
                status: 200,
                body: JSON.parse(JSON.stringify(newstoreClose))
            };
            // log the result for new document in cosmosDB
            context.log(`updateStoreClose log- result: ${JSON.parse(JSON.stringify(newstoreClose))}`);
            context.done();
        })
        .catch(err => {
            const error = err.name === 'ValidationError' ? err.errors : err;
            context.res = {
                status: 400,
                body: JSON.parse(JSON.stringify(error))
            };
            context.log(`updateStoreClose log- error: ${context.res}`);
            context.done();
        });
};

module.exports = function (context, req) {

    if (req.query && req.query.warmupflag) {
        context.done();
        return;
    }
    context.log('Input: ', req.body);
    updateStoreCloseInfo(context, req.body);
};