'use strict';
require('../config/db');
const CryptoJS = require('crypto-js');
const request = require('request');
const key = process.env.FD_KEY;
const secret = process.env.FD_SECRET;
const fdBaseUrl = process.env.FD_BASEURL;

const voidSale = (context, body) => {
  const fdSaleId = body.fdSaleID;
  //update transaction details aion azure DB when sales has been void 
  const clientReqtId = body.txnId;

  //request body

  let voidsalebody = {
  }

  voidsalebody = JSON.stringify(voidsalebody);
  // request headers

  const time = new Date().getTime();
  let rawSignature = `${key}:${time}`;
  const method = 'POST';

  // Encryption
  if (method != 'GET' && method != 'DELETE') {
    const payload_digest = CryptoJS.SHA256(voidsalebody);
    const b64BodyContent = CryptoJS.enc.Base64.stringify(payload_digest);
    rawSignature = rawSignature + ":" + b64BodyContent;
  }
  const signature = CryptoJS.HmacSHA256(rawSignature, secret);
  const authorization = CryptoJS.enc.Base64.stringify(signature);

  // Make call to update account to FirstData

  const options = {
    url: `https://${fdBaseUrl}/ucom/v1/payments/sales/${fdSaleId}/void`,
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': key,
      'Authorization': `HMAC ${authorization}`,
      'Timestamp': time
    },
    body: voidsalebody
  }

  const callback = (error, response, body) => {

    // Log First Data Response since we don't get visibility from output
    context.log(`First Data Response Status: ${response.statusCode}`);
    context.log(`First Data Response Body: ${response.body}`);
    let outputBody;
    if (response.body) {
      try {
        outputBody = JSON.parse(response.body);
      } catch (error) {
        context.res = {
          status: 400,
          body: error.message
        };
        context.done();
        return;
      }
      responseFunc(error, response, body, outputBody);
    } else {
      responseFunc(error, response, body, outputBody);
    };
  };


  const responseFunc = (error, response, body, outputBody) => {
    if (!error && response.statusCode === 200) {
      outputBody.ack = '0';
      const output = {
        status: 200,
        body: outputBody
      };
      context.res = output;
      context.done();
    } else {
      context.log(outputBody);
      outputBody.ack = '1';
      context.res = {
        status: 400,
        body: outputBody
      };
      context.done();

    }
  };

  request.post(options, callback);
};
module.exports = (context, req) => {

  if (req.query && req.query.warmupflag) {
    context.done();
    return;
  }

  context.log('Input: ', req.body);
  voidSale(context, req.body);
};