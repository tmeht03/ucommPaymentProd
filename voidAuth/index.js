/**
 *  This function will void the auth amount whenever fueling is cancelled
 *  after pre-authorization and before capture.
 */

'use strict';
require('../config/db');
const CustomerId = require('../models/CustomerId');
const CryptoJS = require('crypto-js');
const axios = require('axios');
const key = process.env.FD_KEY;
const secret = process.env.FD_SECRET;
const fdBaseUrl = process.env.FD_BASEURL;

const getFdCustId = (context, body) => {
  const fdAuthorizationId = body.fdAuthorizationId;
  const GUID = body.GUID;
  context.log('voidAuth log- GUID', GUID);
  CustomerId
    .findOne({ "GUID": GUID })
    .then(customer => {
      if (customer === null) {
        const errorbody = {
          message: 'Customer not found in OTF-DB'
        };
        context.log('voidAuth log- Customer not present');
        context.res = {
          status: 400,
          body: errorbody
        };
        context.done();
      } else {
        const fdId = customer.fdCustomerId;
        context.log('voidAuth log- fdCustomerID', fdId);
        voidAuth(context, fdId, fdAuthorizationId);
      }
    })
    .catch(e => {
      var error = e.name === "ValidationError" ? e.errors : e;
      context.log('voidAuth log- catching mongo error', e);
      context.res = {
        status: 400,
        body: JSON.parse(JSON.stringify(error))
      };
      context.done();
    });
};

const voidAuth = (context, fdId, fdAuthorizationId) => {
  // Request Headers
  const time = new Date().getTime();
  let rawSignature = `${key}:${time}`;
  const method = 'POST';
  // Request Body
  let requestBody = {
    fdCustomerId: fdId
  };
  const fdRequestBody = JSON.stringify(requestBody);
  // Encryption
  if (method != 'GET' && method != 'DELETE') {
    const payload_digest = CryptoJS.SHA256(fdRequestBody);
    const b64BodyContent = CryptoJS.enc.Base64.stringify(payload_digest);
    rawSignature = rawSignature + ":" + b64BodyContent;
  }
  const signature = CryptoJS.HmacSHA256(rawSignature, secret);
  const authorization = CryptoJS.enc.Base64.stringify(signature);
  const url = `https://${fdBaseUrl}/ucom/v1/payments/auths/${fdAuthorizationId}/void`;
  const configData = {
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': key,
      'Authorization': `HMAC ${authorization}`,
      'Timestamp': time
    }
  };
  // Make void auth call to FirstData
  context.log('voidAuth log- url', url);
  context.log('voidAuth log- fdRequestBody', fdRequestBody);
  context.log('voidAuth log- configData', configData);
  axios.post(url, fdRequestBody, configData)
    .then(res => {
      context.log('voidAuth log- First Data response', res);
      const result = JSON.stringify(res.data);
      context.log('voidAuth log- First Data call result res.data', result);
      if (res.status === 200) {
        try {
          const outputBody = JSON.parse(JSON.stringify(res.data));
          const output = {
            status: 200,
            body: outputBody
          };
          context.res = output;
          context.log('voidAuth log- output', output);
          context.done();
          return context.res;
        } catch (error) {
          context.res = {
            status: 400,
            body: JSON.parse(JSON.stringify(error))
          };
          context.done();
          return;
        }
      } else {
        try {
          const outputBody = JSON.parse(JSON.stringify(res.data));
          const output = {
            status: res.status,
            body: outputBody
          };
          context.res = output;
          context.log('voidAuth log- output', output);
          context.done();
          return context.res;
        } catch (error) {
          context.res = {
            status: 400,
            body: JSON.parse(JSON.stringify(error))
          };
          context.done();
          return;
        }
      }
    })
    .catch(err => {
      context.log('voidAuth log- err.response.status', err.response.status);
      try {
        const errBody = JSON.parse(JSON.stringify(err.response.data));
        const output = {
          status: err.response.status,
          body: errBody
        };
        context.res = output;
        context.log('voidAuth log- output', output);
        context.done();
        return context.res;
      } catch (error) {
        context.res = {
          status: 400,
          body: JSON.parse(JSON.stringify(error))
        };
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

  getFdCustId(context, req.body);
}
