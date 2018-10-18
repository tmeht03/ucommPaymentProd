'use strict';
require('../config/db');
const CustomerId = require('../models/CustomerId');
const hostName = require('../middleware/hostName');
const host = hostName();
const baseUrl = host.includes('localhost') ? `http://${host}` : `https://${host}`;
const validateSwySsoToken = require('../middleware/validateSwySsoToken');
const validateAccessToken = require('../middleware/validateAccessToken');
const CryptoJS = require('crypto-js');
const axios = require('axios');
const key = process.env.FD_KEY;
const secret = process.env.FD_SECRET;
const fdBaseUrl = process.env.FD_BASEURL;

const findFdCustId = (context, body) => {

  CustomerId
    .findOne({ "GUID": body.GUID })
    .then(customer => {
      if (customer === null) {
        errorbody = {
          ack: '1',
          code: '200',
          message: 'Customer not found in OTF DB'
        }
        context.log('updateAccount log - Customer not present');
        context.res = {
          status: 200,
          body: errorbody
        };
        context.done();

      } else {
        const fdCustomerId = customer.fdCustomerId;
        context.log('updateAccount log - fdCustomerID is: ', fdCustomerId);
        updateAccount(context, fdCustomerId, body);
      }
    })
    .catch(e => {
      var error = e.name === "ValidationError" ? e.errors : e;
      context.res = {
        status: 200,
        body: JSON.stringify(error)
      };
      context.log('updateAccount log - catching error: ', context.res);
      context.done();
    });

};

const updateAccount = (context, fdCustomerId, body) => {

  let updateAccountBody = {
    account: {
      type: body.cardType,
      credit: {
        securityCode: body.securityCode,
        expiryDate: {
          month: body.expiryMonth,
          year: body.expiryYear
        }
      }
    }
  };

  updateAccountBody = JSON.stringify(updateAccountBody);
  // request headers

  const time = new Date().getTime();
  let rawSignature = `${key}:${time}`;
  const method = 'PATCH';

  // Encryption
  if (method != 'GET' && method != 'DELETE') {
    const payload_digest = CryptoJS.SHA256(updateAccountBody);
    const b64BodyContent = CryptoJS.enc.Base64.stringify(payload_digest);
    rawSignature = rawSignature + ":" + b64BodyContent;
  }
  const signature = CryptoJS.HmacSHA256(rawSignature, secret);
  const authorization = CryptoJS.enc.Base64.stringify(signature);

  // Make call to update account to FirstData

  const url = `https://${fdBaseUrl}/ucom/v1/customers/${fdCustomerId}/accounts/${body.fdAccountId}`;
  const configData = {
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': key,
      'Authorization': `HMAC ${authorization}`,
      'Timestamp': time
    }
  };

  axios.post(url, updateAccountBody, configData)
    .then(response => {
      context.log(`updateAccount log - First data response status is: ${response.status}`);
      context.log(`updateAccount log - First data response body is: ${response.data}`);
      if (response.status && (response.status === 204 || response.status === 201)) {
        const outputBody = {
          ack: '0',
          data: JSON.parse(JSON.stringify(response.data))
        }
        context.res = {
          status: 200,
          body: outputBody
        };
        context.done();
      } else {
        const outputBody = {
          ack: '1',
          data: JSON.parse(JSON.stringify(response.data))
        }
        context.res = {
          status: 200,
          body: outputBody
        };
        context.done();
      }

    }).catch(error => {
      context.log('updateAccount log- Caught error calling FirstData', error);
      try {
        const outputBody = error.response.data;
        context.res = {
          status: 200,
          body: outputBody
        };
        context.done();
      } catch (err) {
        context.res = {
          status: 200,
          body: err
        };
        context.done();
      }

    });
};

module.exports = (context, req) => {
  if (req.query && req.query.warmupflag) {
    context.done();
    return;
  }
  context.log('updateAccount log- req.body', req.body);

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
