// This function will capture the payment for the pre-auth that was done earlier
'use strict';
require('../config/db');
const CustomerId = require('../models/CustomerId');
const CryptoJS = require('crypto-js');
const axios = require('axios');
const sendError = require('../middleware/sendError');
const key = process.env.FD_KEY;
const secret = process.env.FD_SECRET;
const fdBaseUrl = process.env.FD_BASEURL;

const captureAuthPayment = (context, body) => {

  const pumpNumber = body.pumpNumber,
    fuelType = body.fuelGrade,
    fuelPrice = body.unitPrice,
    numberOfGallons = body.fuelVolume,
    fdAuthorizationId = body.fdAuthorizationId,
    txnId = body._id,
    totalSalesAmount = body.txnAmount;

  // Request Headers
  const time = new Date().getTime();
  let rawSignature = `${key}:${time}`;
  const method = 'POST';

  // Request Body
  let fdRequestBody = {
    capture: {
      currencyCode: {
        number: 840
      },
      requestedAmount: totalSalesAmount,
      industrySpecificInfo: {
        fuelPurchaseInfo: {
          pumpNumber: pumpNumber,
          items: [{
            posCode: "001",
            itemDescription: fuelType,
            itemPrice: fuelPrice,
            unitsSold: numberOfGallons,
            totalItemSaleAmount: totalSalesAmount,
            unitOfMeasurement: "gallonUS"
          }]
        }
      }
    }
  };
  fdRequestBody = JSON.stringify(fdRequestBody);

  // Encryption
  if (method != 'GET' && method != 'DELETE') {
    const payload_digest = CryptoJS.SHA256(fdRequestBody);
    const b64BodyContent = CryptoJS.enc.Base64.stringify(payload_digest);
    rawSignature = rawSignature + ":" + b64BodyContent;
  }
  const signature = CryptoJS.HmacSHA256(rawSignature, secret);
  const authorization = CryptoJS.enc.Base64.stringify(signature);
  const url = `https://${fdBaseUrl}/ucom/v1/payments/auths/${fdAuthorizationId}/captures`;
  const configData = {
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': key,
      'Authorization': `HMAC ${authorization}`,
      'Timestamp': time,
      'Client-Req-Id': txnId
    },
    timeout: parseInt(process.env.DEFAULT_TIMEOUT)
  };
  context.log('captureAuth log- fdRequestBody', fdRequestBody);
  axios.post(url, fdRequestBody, configData)
    .then(res => {
      context.log('captureAuth log- First Data response', res);
      if (res.status === 201) {
        try {
          const outputBody = JSON.parse(JSON.stringify(res.data));
          const output = {
            status: 200,
            body: outputBody
          };
          context.log('captureAuth log- Success output', output);
          context.res = output;
          context.done();
          return;
        } catch (error) {
          context.res = {
            status: 400,
            body: error
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
          context.log('captureAuth log- output', output);
          context.done();
          return;
        } catch (error) {
          context.res = {
            status: 400,
            body: error
          };
          context.done();
          return;
        }
      }
    })
    .catch(err => {
      context.log('captureAuth log- error calling First Data', err);
      if (err.response) {
        context.res = {
          status: err.response.status,
          body: err.response.data
        };
        context.done();
        return;
      } else {
        context.res = {
          status: 503,
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
        context.log('captureAuth log- response', JSON.stringify(context.res));
        context.done();
      }
    });
};

module.exports = (context, req) => {
  if (req.query && req.query.warmupflag) {
    context.done();
    return;
  }
  context.log('captureAuth log- req', req);
  captureAuthPayment(context, req.body);
}
