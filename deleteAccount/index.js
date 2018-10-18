'use strict';
require('../config/db');
const CustomerId = require('../models/CustomerId');
const CryptoJS = require('crypto-js');
const axios = require('axios');
const validateSwySsoToken = require('../middleware/validateSwySsoToken');
const validateAccessToken = require('../middleware/validateAccessToken');
const key = process.env.FD_KEY;
const secret = process.env.FD_SECRET;
const fdBaseUrl = process.env.FD_BASEURL;

const findFdCustId = (context, body) => {

  const GUID = body.GUID;
  const fdAccountId = body.fdAccountId;
  CustomerId
    .findOne({ "GUID": GUID })
    .then(customer => {
      if (customer === null) {
        const outputBody = {
          ack: '1',
          errors: [{
            code: '4004',
            message: 'fdCustomerId mapping not found in Azure DB',
            type: 'Mongo DB error',
            category: 'generic_error',
            vendor: 'OTF Backend'
          }]
        };
        context.log('deleteAccount log- Customer not present');
        context.res = {
          status: 200,
          body: outputBody
        };
        context.done();
      } else {
        const fdCustomerId = customer.fdCustomerId;
        context.log('deleteAccount log- fdCustomerId ', fdCustomerId);
        deleteAccount(context, fdCustomerId, fdAccountId);
      }
    })
    .catch(e => {
      let error = e.name === "ValidationError" ? e.errors : e;
      context.log('deleteAccount log- error ', JSON.stringify(error))
      const outputBody = {
        ack: '1',
        errors: [{
          code: '4004',
          message: 'fdCustomerId mapping not found in Azure DB',
          type: 'Mongo DB error',
          category: 'generic_error',
          vendor: 'OTF Backend'
        }]
      };
      context.res = {
        status: 200,
        body: outputBody
      };
      context.done();
    });
};

const deleteAccount = (context, fdCustomerId, fdAccountId) => {

  // request headers
  const time = new Date().getTime();
  let rawSignature = `${key}:${time}`;
  const method = 'DELETE';

  // Encryption
  if (method != 'GET' && method != 'DELETE') {
    const payload_digest = CryptoJS.SHA256(updateBody);
    const b64BodyContent = CryptoJS.enc.Base64.stringify(payload_digest);
    rawSignature = rawSignature + ":" + b64BodyContent;
  }
  const signature = CryptoJS.HmacSHA256(rawSignature, secret);
  const authorization = CryptoJS.enc.Base64.stringify(signature);

  // Make call to update account to FirstData

  const url = `https://${fdBaseUrl}/ucom/v1/customers/${fdCustomerId}/accounts/${fdAccountId}`;
  const configData = {
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': key,
      'Authorization': `HMAC ${authorization}`,
      'Timestamp': time
    },
    timeout: parseInt(process.env.DEFAULT_TIMEOUT)
  };

  axios.delete(url, configData)
    .then(res => {
      context.log(`deleteAccount log- First Data Response Status: ${res.status}`);
      context.log(`deleteAccount log- First Data Response Body: ${res.data}`);
      let outputBody;
      if (res.status === 204) {
        try {
          const outputBody = {
            ack: '0',
            data: JSON.parse(JSON.stringify(res.data)),
            message: 'Account deleted successfully!'
          };
          context.res = {
            status: 200,
            body: outputBody
          };
          context.log(`deleteAccount log- parsed output is: ${outputBody}`);
          context.done();
          return;
        } catch (error) {
          context.log(`deleteAccount log- catching parsing error: ${JSON.stringify(error)}`);
          const outputBody = {
            ack: '1',
            errors: [{
              code: '5000',
              message: 'Account deleted successfully but error parsing response from First Data on OTF backend',
              type: 'Backend error',
              category: 'generic_error',
              vendor: 'OTF Backend'
            }]
          };
          context.res = {
            status: 200,
            body: outputBody
          };
          context.log('deleteAccount log- context.res', JSON.stringify(context.res));
          context.done();
          return;
        }
      } else {
        const outputBody = {
          ack: '1',
          errors: [{
            code: '5000',
            message: 'Error deleting account on First Data',
            type: 'First Data error',
            category: 'generic_error',
            vendor: 'First Data'
          }]
        };
        context.res = {
          status: 200,
          body: outputBody
        };
        context.log('deleteAccount log- context.res', JSON.stringify(context.res));
        context.done();
        return;
      };
    })
    .catch(err => {
      if (err.response) {
        try {
          const errBody = JSON.stringify(err.response.data);
          context.log('deleteAccount log- Caught error calling First Data', errBody);
          const outputBody = {
            ack: '1',
            errors: [{
              code: err.response.data.code,
              message: err.response.data.message,
              type: 'First data error',
              category: 'generic_error',
              vendor: 'First Data'
            }]
          };
          context.res = {
            status: 200,
            body: outputBody
          };
          context.log('deleteAccount log- response', JSON.stringify(context.res));
          context.done();
          return;
        } catch (error) {
          context.log('deleteAccount log- Caught error parsing First Data error', error);
          const outputBody = {
            ack: '1',
            errors: [{
              code: '4000',
              message: 'Error parsing First Data error response',
              type: 'Backend error',
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
      } else {
        context.log('deleteAccount log- error ', err);
        const outputBody = {
          ack: '1',
          errors: [{
            code: '5003',
            message: 'Something went wrong on First Data / timeout',
            type: 'Connection / timeout',
            category: 'generic_error',
            vendor: 'First Data'
          }]
        };
        context.res = {
          status: 200,
          body: outputBody
        };
        context.log('deleteAccount log- response', JSON.stringify(context.res));
        context.done();
        return;
      }
    });
};

module.exports = (context, req) => {

  if (req.query && req.query.warmupflag) {
    context.done();
    return;
  }
  context.log('deleteAccount log- req.body', req.body);

  context.log('Input: ', req.body);
  //validateSwySsoToken(context, req, findFdCustId.bind(null, context, req.body));
  findFdCustId(context, req.body);
};
