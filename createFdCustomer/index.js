'use strict';
require('../config/db');
const CustomerId = require('../models/CustomerId');
const CryptoJS = require('crypto-js');
const axios = require('axios');
const sendError = require('../middleware/sendError');

const createCustomerAPI = (context, GUID) => {
  context.log(process.env.DEFAULT_TIMEOUT);

  function uniqueNumber() {
    let date = Date.now();

    // If created at same millisecond as previous
    if (date <= uniqueNumber.previous) {
      date = ++uniqueNumber.previous;
    } else {
      uniqueNumber.previous = date;
    }
    return date;
  };
  const clientReqId = uniqueNumber();
  context.log('createFdCustomer log - client req id is: ', clientReqId);
  uniqueNumber.previous = 0;

  const time = new Date().getTime();
  // Request Headers
  let rawSignature = `${process.env.FD_KEY}:${time}`;
  const method = 'POST';
  // Request Body
  const fdRequest = {
    customer: {
      externalId: GUID
    }
  };

  const fdRequestBody = JSON.stringify(fdRequest);

  // Encryption
  if (method != 'GET' && method != 'DELETE') {
    const payload_digest = CryptoJS.SHA256(fdRequestBody);
    const b64BodyContent = CryptoJS.enc.Base64.stringify(payload_digest);
    rawSignature = rawSignature + ":" + b64BodyContent;
  }
  const signature = CryptoJS.HmacSHA256(rawSignature, process.env.FD_SECRET);
  const authorization = CryptoJS.enc.Base64.stringify(signature);

  // Make call to add new customer to FirstData
  const url = `https://${process.env.FD_BASEURL}/ucom/v1/customers`;
  const configData = {
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': process.env.FD_KEY,
      'Authorization': `HMAC ${authorization}`,
      'Timestamp': time,
      'Client-Request-Id': clientReqId
    },
    timeout: parseInt(process.env.DEFAULT_TIMEOUT)
  };

  axios.post(url, fdRequestBody, configData)
    .then(response => {
      context.log(`createFdCustomer log - First data response status is: ${response.status}`);
      context.log('createFdCustomer log - First Data response body', JSON.stringify(response.data));
      if (response.status && response.status === 201) {
        const fdCustId = response.data.id;
        const createCustomerOnLocalBody = {
          GUID: GUID,
          fdCustomerId: fdCustId,
          status: 'Active'
        };
        // add customer mapping between GUID and fdcustonmerid on azure cosmosDB
        new CustomerId(createCustomerOnLocalBody)
          .save()
          .then(newCustomer => {
            context.res = {
              status: 200,
              body: JSON.parse(JSON.stringify(newCustomer))
            };
            // Log the result for new document in cosmosDB
            context.log('createFdCustomer log- response', JSON.stringify(context.res));
            context.done();
          })
          .catch(err => {
            const error = err.name === 'ValidationError' ? err.errors : err;
            context.res = {
              status: 400,
              body: JSON.parse(JSON.stringify(error))
            };
            context.log(`createFdCustomer log- error: ${context.res}`);
            context.done();
          });
      } else {
        const outputBody = response.data;
        context.res = {
          status: 400,
          body: outputBody
        };
        context.done();
      }
    })
    .catch(error => {
      context.log(`createFdCustomer log - error calling First Data`, error);

      if (error.response && error.response.status && error.response.status === 409) {
        // Customer already exists in First Data
        context.res = {
          status: 400,
          body: 'Customer already exists in First Data. Customer mapping not present in OTF Cosmos DB'
        };
        context.log('createFdCustomer log- response', JSON.stringify(context.res));
        context.done();
      } else if (error.response && error.response.data) {
        try {
          const outputBody = error.response.data;
          context.res = {
            status: 400,
            body: outputBody
          };
          context.log(`createFdCustomer log - First data error body is: ${JSON.parse(JSON.stringify(outputBody))}`);
          context.done();
        } catch (err) {
          context.res = {
            status: 400,
            body: err
          };
          context.log(`createFdCustomer log - First data error parsing response: ${err}`);
          context.done();
        }
      } else {
        // Connection or timeout error
        context.res = {
          status: 500,
          body: {
            errors: [{
              code: '5003',
              message: 'Connection / timeout error',
              type: 'Connection / timeout',
              vendor: 'First Data',
              category: 'generic_error'
            }]
          }
        };
        context.log('createFdCustomer log- response', JSON.stringify(context.res));
        context.done();
      }
    });
};

const findFdCustomerId = (context, body) => {
  const GUID = body.GUID;
  // find fdCustomerId from Azure cosmosDb
  CustomerId
    .findOne({ GUID: GUID })
    .then(customer => {
      if (customer === null) {
        context.log('createFdCustomer log- Customer mapping not present in Azure DB');
        createCustomerAPI(context, GUID);
      } else {
        context.res = {
          status: 200,
          body: JSON.parse(JSON.stringify(customer))
        };
        context.log('createFdCustomer log- response ', JSON.stringify(context.res));
        context.done();
      }
    })
    .catch(err => {
      const error = err.name === 'ValidationError' ? err.errors : err;
      context.res = {
        status: 400,
        body: JSON.parse(JSON.stringify(error))
      };
      context.log(`createFdCustomer log- error: ${context.res}`);
      context.done();
    });
};

module.exports = (context, req) => {

  if (req.query && req.query.warmupflag) {
    context.done();
    return;
  }

  context.log('createFdCustomer log- Input for fdCust: ', req.body);
  findFdCustomerId(context, req.body);
};