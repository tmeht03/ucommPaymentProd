'use strict';
require('../config/db');
const counter = require('../models/counter');

const getNextSequenceValue = (context, sequenceName) => {

    counter.findByIdAndUpdate(sequenceName, { $inc: { sequence_value: 1 } }, { new: true, upsert: true, select: { sequence_value: 1 } })
        .then(response => {
            context.res = {
                status: 200,
                body: {
                    'ack': '0',
                    sequenceValue: response.sequence_value
                }
            };
            context.log('IncrementCounter log - counter is ', context.res);
            context.done();
        }).catch(err => {
            context.res = {
                status: 400,
                body: {
                    ack: '1',
                    errors: [{
                        code: 5000,
                        message: 'Error increementing counter value',
                        type: 'Mongo DB error',
                        vendor: 'Payment Backend',
                        category: 'generic_error'
                    }]
                }
            };
            context.log('IncrementCounter log - error incrementing counter ', err);
            context.done();
        });
};

module.exports = (context, req) => {
    if (req.query && req.query.warmupflag) {
        context.done();
        return;
    }
    getNextSequenceValue(context, req.params.sequenceName);
};