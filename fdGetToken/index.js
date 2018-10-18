'use strict';
require('../config/db');
const axios = require('axios');
const CryptoJS = require('crypto-js');
const Customer = require('../models/CustomerId');
const hostName = require('../middleware/hostName');
const host = hostName();
const baseUrl = host.includes('localhost') ? `http://${host}` : `https://${host}`;
const validateSwySsoToken = require('../middleware/validateSwySsoToken');
const validateAccessToken = require('../middleware/validateAccessToken');
const key = process.env.FD_KEY;
const secret = process.env.FD_SECRET;
const fdBaseUrl = process.env.FD_BASEURL;

const createCustomer = (context, body) => {
  const config = {
    headers: { 'x-functions-key': process.env.X_FUNCTIONS_KEY }
  };
  const createFdCustomerUrl = `${baseUrl}/api/createfdcustomer/`;

  axios.post(createFdCustomerUrl, body, config)
    .then(response => {
      context.log('fdGetToken log- response from createFdCustomer', response);
      if (response.data) {
        try {
          const fdres = JSON.parse(JSON.stringify(response.data));
          getToken(context, fdres);
        } catch (error) {
          const outputBody = {
            ack: '1',
            errors: [{
              code: '4000',
              message: 'Error parsing createFdCustomer First Data response',
              type: 'First Data response format error',
              category: 'generic_error',
              vendor: 'First Data'
            }]
          };
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
          errors: [{
            code: '4000',
            message: 'Error finding customer Details',
            type: 'Azure mapping Error',
            category: 'generic_error',
            vendor: 'OTF Backend'
          }]
        };
        context.res = {
          status: 200,
          body: outputBody
        };
        context.done();
        return;
      }
    }).catch(err => {
      context.log('fdGetToken Log - Error: ', err.response.data);
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

const getToken = (context, fdres) => {

  function uniqueNumber() {
    var date = Date.now();

    // If created at same millisecond as previous
    if (date <= uniqueNumber.previous) {
      date = ++uniqueNumber.previous;
    } else {
      uniqueNumber.previous = date;
    }
    context.log('fdGetToken log- Unique client req id is ', date);
    return date;
  };

  const clientReqId = uniqueNumber();

  uniqueNumber.previous = 0;

  // Request Headers
  const time = new Date().getTime();
  let rawSignature = `${key}:${time}`;
  const method = 'POST';

  // Request Body
  const fdRequest = {
    token: {
      fdCustomerId: fdres.fdCustomerId
    },
    publicKeyRequired: true
  };
  const fdRequestBody = JSON.stringify(fdRequest);
  context.log('fdGetToken log- fdRequestBody', fdRequestBody);

  // Encryption
  if (method != 'GET' && method != 'DELETE') {
    const payload_digest = CryptoJS.SHA256(fdRequestBody);
    const b64BodyContent = CryptoJS.enc.Base64.stringify(payload_digest);
    rawSignature = rawSignature + ":" + b64BodyContent;
  }
  const signature = CryptoJS.HmacSHA256(rawSignature, secret);
  const authorization = CryptoJS.enc.Base64.stringify(signature);

  // Make call to FirstData to get token and public key for encryption
  const url = `https://${fdBaseUrl}/ucom/v1/tokens`;
  const configData = {
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': key,
      'Authorization': `HMAC ${authorization}`,
      'Timestamp': time,
      'Client-Request-Id': clientReqId
    },
    timeout: parseInt(process.env.DEFAULT_TIMEOUT)
  };
  context.log('fdGetToken log- calling url', url);
  axios.post(url, fdRequestBody, configData)
    .then(response => {
      context.log(`fdGetToken log- First Data Response Status: ${JSON.stringify(response.status)}`);
      context.log(`fdGetToken log- First Data Response Body: ${JSON.stringify(response.data)}`);
      try {
        if (response.data) {
          response.data.fdCustomerId = fdres.fdCustomerId;
          const outputBody = {
            data: response.data,
            ack: '0'
          }
          context.res = {
            status: 200,
            body: outputBody
          };
          context.done();
        } else {
          const outputBody = {
            ack: '1',
            errors: [{
              code: '4000',
              message: 'Error parsing response data',
              type: 'Backend error',
              category: 'generic_error',
              vendor: 'OTF Backend'
            }]
          }
          context.res = {
            status: 200,
            body: outputBody
          };
          context.done();
        }
      } catch (err) {
        context.log('fdGetToken Log - error: ', err);
        const outputBody = {
          ack: '1',
          errors: [{
            code: '4000',
            message: 'Error parsing response data',
            type: 'Backend error',
            category: 'generic_error',
            vendor: 'OTF Backend'
          }]
        }
        context.res = {
          status: 200,
          body: outputBody
        };
        context.done();
      }
    }).catch(err => {
      context.log('fdGetToken log- Caught error calling First Data', err);
      const outputBody = {
        ack: '1',
        errors: [{
          code: '5000',
          message: 'First Data server error or timeout',
          type: 'First Data error',
          category: 'generic_error',
          vendor: 'First Data'
        }]
      };
      context.res = {
        status: 200,
        body: outputBody
      };
      context.done();
    });
};

module.exports = (context, req) => {
  if (req.query && req.query.warmupflag) {
    context.done();
    return;
  }
  context.log('fdGetToken log- req.body', req.body);

  if (req.headers.swy_sso_token) {
    if (process.env.SSO_VALIDATION) {
      validateSwySsoToken(context, req, createCustomer.bind(null, context, req.body));
    } else {
      createCustomer(context, req.body);
    }
  } else if (process.env.OKTA_VALIDATION) {
    validateAccessToken(context, req, createCustomer.bind(null, context, req.body));
  } else {
    createCustomer(context, req.body);
  }
};
