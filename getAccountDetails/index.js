'use strict';
require('../config/db');
const CustomerId = require('../models/CustomerId');
const CryptoJS = require('crypto-js');
const axios = require('axios');
const validateSwySsoToken = require('../middleware/validateSwySsoToken');
const validateAccessToken = require('../middleware/validateAccessToken');
const sendError = require('../middleware/sendError');
const key = process.env.FD_KEY;
const secret = process.env.FD_SECRET;
const fdBaseUrl = process.env.FD_BASEURL;

const findFdCustId = (context, body) => {

  const GUID = body.GUID;
  const fdAccountId = body.fdAccountId;
  context.log(GUID);
  CustomerId
    .findOne({ "GUID": GUID })
    .then(customer => {
      if (customer === null) {
        context.log('getAccountDetails log - Customer not present');
        const errorbody = {
          ack: '1',
          code: '200',
          message: 'fdCustomerId for this GUID is available'
        };
        context.res = {
          status: 200,
          body: errorbody,
        };
        context.done();
        return;
      } else {
        const fdCustomerId = customer.fdCustomerId;
        context.log('getAccountDetails log - fdCustomerID is: ', fdCustomerId);
        getAccountDetails(context, fdCustomerId, fdAccountId);
      }
    })
    .catch(e => {
      const error = e.name === "ValidationError" ? e.errors : e;
      context.res = {
        status: 200,
        body: JSON.parse(JSON.stringify(error))
      };
      context.log('catching error: ', context.res);
      context.done();
    });
};

const getAccountDetails = (context, fdCustomerId, fdAccountId) => {

  // request headers

  const time = new Date().getTime();
  let rawSignature = `${key}:${time}`;
  const method = 'GET';

  // Encryption
  if (method != 'GET' && method != 'DELETE') {
    const payload_digest = CryptoJS.SHA256(updateBody);
    const b64BodyContent = CryptoJS.enc.Base64.stringify(payload_digest);
    rawSignature = rawSignature + ":" + b64BodyContent;
  }
  const signature = CryptoJS.HmacSHA256(rawSignature, secret);
  const authorization = CryptoJS.enc.Base64.stringify(signature);

  // Make call to get account details to FirstData

  const url = `https://${fdBaseUrl}/ucom/v1/customers/${fdCustomerId}/accounts/${fdAccountId}`;
  const configData = {
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': key,
      'Authorization': `HMAC ${authorization}`,
      'Timestamp': time
    },
    timeout: process.env.DEFAULT_TIMEOUT
  };

  axios.get(url, configData)
    .then(response => {
      context.log(`getAccountDetails log- First Data response status is: ${response.status}`);
      context.log('getAccountDetails log- First Data response body', JSON.stringify(response.data));
      context.res = {
        status: 200,
        body: {
          ack: '0',
          data: response.data
        }
      };
      context.log('getAccountDetails log- response', JSON.stringify(context.res));
      context.done();
      // TODO: Can we simplify like above and remove the code below?
      // try {
      //   let outputBody = JSON.parse(JSON.stringify(body));
      // } catch (err) {
      //   context.res = {
      //     status: 200,
      //     body: err
      //   };
      //   context.done();
      // }
      // if (response.statusCode === 201) {
      //   outputBody.ack = '0';
      //   const output = {
      //     status: 200,
      //     body: outputBody
      //   };
      //   context.res = output;
      //   context.log('getAccountDetails log- response', JSON.stringify(context.res));
      //   context.done();
      // } else {
      //   outputBody.ack = '1';
      //   context.res = {
      //     status: 200,
      //     body: outputBody
      //   };
      //   context.done();
      // }
    })
    .catch(error => {
      context.log('getAccountDetails log - Caught error calling FirstData', error);
      if (error.response && error.response.data) {
        sendError(context, error.response.data.code, error.response.data.message, 'Vendor error', 'First Data', 'generic_error');
        // TODO: Can we simplify this block by using above error handling module and removing below?
        // try {
        //   const outputBody = error.response.data;
        //   context.res = {
        //     status: 200,
        //     body: outputBody
        //   };
        //   context.log('getAccountDetails log- response', JSON.stringify(context.res));
        //   context.done();
        // } catch (err) {
        //   context.res = {
        //     status: 200,
        //     body: err
        //   };
        //   context.done();
        // }
      } else {
        sendError(context, '5003', 'Connection or timeout error', 'Connection or timeout', 'First Data', 'generic_error');
      }
    });
};

module.exports = (context, req) => {

  if (req.query && req.query.warmupflag) {
    context.done();
    return;
  }
  context.log('getAccountDetails log- req.body', req.body);

  // Validate SSO token if sent, otherwise do not
  if (req.headers.swy_sso_token) {
    if (process.env.SSO_VALIDATION) {
      validateSwySsoToken(context, req, findFdCustId.bind(null, context, req.body));
    } else {
      findFdCustId(context, req.body);
    }
  } else if (process.env.OKTA_VALIDATION) {
    validateAccessToken(context, req, findFdCustId.bind(null, context, req.body));
  } else {
    findFdCustId(context, req.body);
  }
};
