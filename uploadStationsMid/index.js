require('../config/db');
var Station = require('../models/StoreMIDs');
var parse = require('csv-parse/lib/sync');
var request = require('request');

module.exports = function (context, req) {

    if (req.query && req.query.warmupflag) {
        context.done();
        return;
    }

    context.log('Input: ', req.params);
    var swyFuelCentersAPI = 'https://ucommpaymentdev.blob.core.windows.net/ucommdevcontainer/Dev-Mid.csv';
    var file = request(swyFuelCentersAPI, function (error, response, body) {
        context.log('storeMIDupateAPI call: ', swyFuelCentersAPI);
        if (!error && response.statusCode == 200) {
            var stations = parse(body.toString(), { auto_parse: true, columns: true });
            var numOfStations = stations.length;
            Station
                .remove()
                .then(() => {
                    var bulkWriteArray = []
                    for (var i = 0; i < numOfStations; i++) {
                        bulkWriteArray.push({
                            insertOne: {
                                document: stations[i]
                            }
                        })
                    }
                    return Station.bulkWrite(bulkWriteArray);
                })
                .then(() => {
                    context.res = {
                        status: 200,
                        body: numOfStations + " stations Added to the Stations Table"
                    }
                    context.log('Output: ', context.res);
                    context.done();
                })
                .catch(e => {
                    context.res = {
                        status: 400,
                        body: JSON.stringify(e)
                    };
                    context.log('Output: ', context.res);
                    context.done();
                })
        } else if (error) {
            context.log('storeMIDupateAPI error - ', error);
            context.done();
        } else {
            context.log('storeMIDupateAPI response - ', response.statusCode + response.statusMessage);
            context.done();
        }
    })
};