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
const sendError = require('../middleware/sendError');
const key = process.env.FD_KEY;
const secret = process.env.FD_SECRET;
const fdBaseUrl = process.env.FD_BASEURL;

const nonceEnrollment = (context, body, updateAddCardDetails, _id) => {

  const nonceToken = body.nonceToken;
  const fdCustomerId = body.fdCustomerId;
  function uniqueNumber() {
    var date = Date.now();

    // If created at same millisecond as previous
    if (date <= uniqueNumber.previous) {
      date = ++uniqueNumber.previous;
    } else {
      uniqueNumber.previous = date;
    }
    context.log('fdNonceEnrollment log - Unique client req id is ', date);
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
    account: {
      token: {
        tokenId: nonceToken,
        tokenProvider: 'UCOM',
        tokenType: 'CLAIM_CHECK_NONCE'
      }
    }
  };

  const fdRequestBody = JSON.stringify(fdRequest);
  context.log(fdRequestBody);

  // Encryption
  if (method != 'GET' && method != 'DELETE') {
    const payload_digest = CryptoJS.SHA256(fdRequestBody);
    const b64BodyContent = CryptoJS.enc.Base64.stringify(payload_digest);
    rawSignature = rawSignature + ":" + b64BodyContent;
  }
  const signature = CryptoJS.HmacSHA256(rawSignature, secret);
  const authorization = CryptoJS.enc.Base64.stringify(signature);

  const url = `https://${fdBaseUrl}/ucom/v1/customers/${fdCustomerId}/accounts`;
  const configData = {
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': key,
      'Client-Token': body.OAuthToken,
      'Timestamp': time,
      'Client-Request-Id': clientReqId
    },
    timeout: parseInt(process.env.DEFAULT_TIMEOUT)
  };
  axios.post(url, fdRequestBody, configData)
    .then(response => {
      context.log(`fdNonceEnrollment log - - First Data Response Status: ${response}`);
      context.log(`fdNonceEnrollment log - - First Data Response Body: ${response}`);
      try {
        if (response.data) {
          context.log('update details are', updateAddCardDetails);
          Customer.update({ "fdCustomerId": fdCustomerId }, { "defaultCard": response.data.fdAccountId, "addCardTime": updateAddCardDetails.addCardTime, "cardCounter": updateAddCardDetails.cardCounter }, { new: true })
            .then(res => {
              const outputBody = {
                data: {
                  fdAccountId: response.data.fdAccountId
                },
                ack: '0'
              }
              context.res = {
                status: 200,
                body: outputBody
              };
              context.done();
            }).catch(err => {
              const outputBody = {
                data: {
                  fdAccountId: response.data.fdAccountId
                },
                ack: '0',
                message: 'Error updating card details to azure DB'
              }
              context.res = {
                status: 200,
                body: outputBody
              };
              context.log(`fdNonceEnrollment log - Error updating details to Azure DB: ${JSON.stringify(context.res)}`);
              context.done();
            })

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
        context.log('fdNonceEnrollment Log - error ', err);
        const outputBody = {
          ack: '1',
          errors: [{
            code: '5000',
            message: 'Server error',
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
      context.log('fdNonceEnrollment log- Caught error calling FirstData', err);
      if (err.response) {
        try {
          const outputBody = {
            ack: '1',
            errors: [{
              code: err.response.data.code,
              message: err.response.data.message,
              type: 'First Data error',
              category: 'generic_error',
              vendor: 'First Data'
            }]
          };
          if (err.response.data.code === '269801') {
            outputBody.errors[0].category = 'client_blocked';
          } else if (err.response.data.code === '274001') {
            outputBody.errors[0].category = 'incorrect_card_info';
          } else if (err.response.data.code === '274002') {
            outputBody.errors[0].category = 'duplicate_card';
          }
          context.res = {
            status: 200,
            body: outputBody
          };
          context.log('fdNonceEnrollment log - Error', JSON.stringify(context.res));
          context.done();
        } catch (err) {
          const outputBody = {
            ack: '1',
            errors: [{
              code: '5000',
              message: 'Server error',
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
        }
      } else {
        sendError(context, '5003', 'Connection or timeout error', 'Connection error', 'First Data', 'generic_error');
      }
    });
};

const compareTime = (context, body) => {

  Customer.find({ "fdCustomerId": body.fdCustomerId }, { "cardCounter": 1, "addCardTime": 1 })
    .then(res => {
      context.log("fdNonceEnrollment log - result is ", res);
      const currentTime = new Date().getTime();
      if (!res[0].addCardTime || !res[0].cardCounter) {
        // add card logic
        const updateAddCardDetails = {
          addCardTime: currentTime,
          cardCounter: 1
        };

        nonceEnrollment(context, body, updateAddCardDetails, res._id);
      } else if (res[0].addCardTime && res[0].cardCounter) {
        const time1 = new Date(parseInt(res[0].addCardTime));
        const time2 = new Date(parseInt(currentTime));
        const diff = time2.getTime() - time1.getTime();
        const diffInHours = Math.ceil(diff / 1000 / 60 / 60);
        context.log("difference in hours ", diffInHours);
        if (diffInHours <= 24 && res[0].cardCounter === 3) {
          const outputBody = {
            ack: '1',
            errors: [{
              message: 'Maximum limit of adding cards in 24hrs has been reached. Please try again later',
              type: 'First Data error',
              category: 'max_hr_limit_error',
              vendor: 'First Data'
            }]
          };
          context.res = {
            status: 200,
            body: outputBody
          };
          context.log(`fdNonceEnrollment log - `, context.res);
          context.done();
        } else if (diffInHours > 24) {
          // you can add a card
          // add the new time2 into DB
          // Alsoo reset cardCounter to 1
          const updateAddCardDetails = {
            addCardTime: currentTime,
            cardCounter: 1
          };
          nonceEnrollment(context, body, updateAddCardDetails, res._id);

        } else if (diffInHours <= 24 && res[0].cardCounter < 3) {
          // you can add a card
          const updateAddCardDetails = {
            cardCounter: res[0].cardCounter + 1,
            addCardTime: res[0].addCardTime
          };
          nonceEnrollment(context, body, updateAddCardDetails, res._id);
          // increment the counter by 1 and update in DB
          // leave the time in DB as it is
        } else {
          context.done();
        }
      }
    }).catch(err => {
      const outputBody = {
        ack: '1',
        errors: [{
          code: '5000',
          message: 'Server error',
          type: 'Backend error',
          category: 'generic_error',
          vendor: 'OTF Backend'
        }]
      };

      context.res = {
        status: 200,
        body: outputBody
      };
      context.log('fdNonceEnrollment log - Error comparing time', context.res);
      context.done();
    });
};

module.exports = (context, req) => {
  if (req.query && req.query.warmupflag) {
    context.done();
    return;
  }
  context.log('fdNonceEnrollment log- req.body', req.body);

  if (process.env.OKTA_VALIDATION) {
    validateAccessToken(context, req, compareTime.bind(null, context, req.body));
  } else if (process.env.SSO_VALIDATION) {
    validateSwySsoToken(context, req, compareTime.bind(null, context, req.body));
  } else {
    // Ignore SSO token
    compareTime(context, req.body);
  }
};