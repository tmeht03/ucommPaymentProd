require("../config/db");
const CustomerId = require('../models/CustomerId');
const axios = require('axios');
const host = process.env.WEBSITE_HOSTNAME;
const baseUrl = host.includes('localhost') ? `http://${host}` : `https://${host}`;

// This function can be used to update any of the user profile information when the user preferance changes

const updatePaymentProfile = (context, body) => {
    CustomerId.findOneAndUpdate({ GUID: body.GUID }, body.updates, { new: false })
        .then(customer => {
            if (customer === null) {
                // create customer on FD and azure DB
                createCustomer(context, body);
            } else {
                const outputBody = {
                    message: 'Customer profile updated',
                    ack: '0'
                }
                context.res = {
                    status: 200,
                    body: outputBody
                };
                context.log('updateProfile log - Output: ', context.res);
                context.done();
            }
        })
        .catch(e => {
            const error = e.name === "ValidationError" ? e.errors : e;
            context.res = {
                status: 400,
                body: JSON.stringify(error)
            };
            context.log('updateProfile log - Error: ', context.res);
            context.done();
        });
};

const createCustomer = (context, body) => {
    const config = {
        headers: { 'x-functions-key': process.env.X_FUNCTIONS_KEY }
    };
    const createFdCustomerUrl = `${baseUrl}/api/createfdcustomer/`;
    axios.post(createFdCustomerUrl, body, config)
        .then(response => {
            context.log(`updateProfile log - response from createFdCustomer ${JSON.stringify(response.data)}`);

            if (response.data) {
                try {
                    const fdres = JSON.parse(JSON.stringify(response.data));
                    updatePaymentProfile(context, body);
                } catch (error) {
                    const outputBody = {
                        ack: '1',
                        errors: [
                            {
                                code: '4000',
                                message: 'Error parsing create fdCustomer Frist Data response',
                                type: 'First Data response format error',
                                category: 'generic_error',
                                vendor: 'First Data'
                            }
                        ]
                    }
                    context.res = {
                        status: 200,
                        body: outputBody
                    };
                    context.done();
                    return;
                }
            } else {
                const outputBody = {
                    ack: '1',
                    errors: [
                        {
                            code: '4000',
                            message: 'Error finding customer Details',
                            type: 'Azure mapping Error',
                            category: 'generic_error',
                            vendor: 'OTF Backend'
                        }
                    ]
                }
                context.res = {
                    status: 200,
                    body: outputBody
                };
                context.done();
                return;
            }
        }).catch(err => {
            context.log('updateProfile Log - Error: ', err);
            const outputBody = {
                ack: '1',
                errors: [{
                    code: '5000',
                    message: 'Error on createFdCustomer function',
                    type: 'Backend server error',
                    category: 'generic_error',
                    vendor: 'OTF Backend'
                }]
            };
            context.res = {
                status: 200,
                body: outputBody
            };
            context.done();
        })
};


module.exports = function (context, req) {

    if (req.query && req.query.warmupflag) {
        context.done();
        return;
    }
    context.log('Input: ', req.body);
    updatePaymentProfile(context, req.body);
};