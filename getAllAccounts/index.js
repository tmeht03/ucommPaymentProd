require("../config/db");
const CustomerId = require("../models/CustomerId"),
  CryptoJS = require('crypto-js'),
  axios = require('axios');
const validateSwySsoToken = require('../middleware/validateSwySsoToken');
const validateAccessToken = require('../middleware/validateAccessToken');
const sendError = require('../middleware/sendError');
const key = process.env.FD_KEY;
const secret = process.env.FD_SECRET;
const fdBaseUrl = process.env.FD_BASEURL;
let outputBody = '';
let defaultSelectedCard = '';

const getFdCustomerId = (context, body) => {
  CustomerId
    .findOne({ "GUID": body.GUID })
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
        context.log('getAllaccounts log - Customer not present');
        context.res = {
          status: 200,
          body: outputBody
        };
        context.done();
      } else {
        const fdId = customer.fdCustomerId;
        context.log("getAllaccounts log - fdCustomerID is: " + fdId);
        getAllAccounts(context, fdId, body.GUID);
      }
    })
    .catch(e => {
      const error = e.name === "ValidationError" ? e.errors : e;
      context.log('getAllaccounts log - error ', JSON.stringify(error))
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

// This function gets details of all the vaulted accounts in first data for a user
const getAllAccounts = (context, fdId, GUID) => {
  // Request Headers
  const time = new Date().getTime();
  let rawSignature = key + ":" + time;
  const method = 'GET';
  if (method != 'GET' && method != 'DELETE') {
    const payload_digest = CryptoJS.SHA256(requestBody);
    const b64BodyContent = CryptoJS.enc.Base64.stringify(payload_digest);
    rawSignature = rawSignature + ":" + b64BodyContent;
  }
  const signature = CryptoJS.HmacSHA256(rawSignature, secret);
  const authorization = CryptoJS.enc.Base64.stringify(signature);
  const url = `https://${fdBaseUrl}/ucom/v1/customers/${fdId}/accounts`;
  const configData = {
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': key,
      'Authorization': 'HMAC ' + authorization,
      'Timestamp': time
    },
    timeout: parseInt(process.env.DEFAULT_TIMEOUT)
  };
  axios.get(url, configData)
    .then(response => {
      context.log('getAllaccounts log - First Data Response Status: ', response.status);
      context.log('getAllaccounts log - First Data Response Body: ', JSON.parse(JSON.stringify(response.data)));
      if (response.status && response.status == 200) {
        if (response.data) {
          try {
            outputBody = JSON.parse(JSON.stringify(response.data));
            context.log('getAllAccounts log- outputBody', JSON.stringify(outputBody));
            CustomerId
              .findOne({ "GUID": GUID }, { "defaultCard": 1, "addCardTime": 1, "cardCounter": 1 })
              .then(res => {
                context.log(`getAllaccounts log - Result from DB is: ${res}`);
                let arrayofaccounts = outputBody.accounts;
                const activeAccounts = arrayofaccounts.filter(account => account.status === 'ACTIVE');
                outputBody.accounts = activeAccounts;
                outputBody.ack = '0';
                const diff = parseInt(time) - parseInt(res.addCardTime);
                const diffInHours = diff / 1000 / 60 / 60;
                context.log('getAllAccounts log- difference in hours', diffInHours);
                if (diffInHours) {
                  if (diffInHours < 24 && res.cardCounter === 3) {
                    context.log('getAllAccounts log- 24hr limit reached and nomore cards can be added');
                    outputBody.hrLimitReached = true;
                  } else if (diffInHours > 24 || (diffInHours < 24 && res.cardCounter < 3)) {
                    context.log('getAllAccounts log- you can add more cards until limit for max cards is reached');
                    outputBody.hrLimitReached = false;
                  }
                } else {
                  context.log('getAllAccounts log- 24 Hour limit details not available for this account');
                  outputBody.hrLimitReached = "not available";
                }
                if (res.defaultCard) {
                  outputBody.defaultCard = res.defaultCard;
                } else {
                  outputBody.defaultCard = '';
                }
                context.res = {
                  status: 200,
                  body: outputBody
                };
                context.log('getAllAccounts log - Result is', context.res);
                context.done();
              })
              .catch(err => {
                context.log(`getAllAccounts log- err ${err}`);
                const outputBody = {
                  ack: '1',
                  errors: [{
                    code: '4004',
                    message: 'Error while finding defaultCard for this user',
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
              });
          } catch (error) {
            context.log('getAllaccounts log - error ', error);
            const outputBody = {
              ack: '1',
              errors: [{
                code: '4004',
                message: error.message,
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
        }
      } else {
        if (response.body) {
          try {
            outputBody = {
              ack: '0',
              data: JSON.parse(JSON.stringify(response.body))
            }
            context.res = {
              status: 200,
              body: outputBody
            };
            context.done();
            return;
          } catch (error) {
            context.log('getAllaccounts log - error ', error);
            const outputBody = {
              ack: '1',
              errors: [{
                code: '4004',
                message: error.message,
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
          const outputBody = {
            ack: '1',
            errors: [{
              code: '5000',
              message: 'Something went wrong on the Backend',
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
      }
    }).catch(err => {
      context.log('getAllaccounts log- Caught error calling FirstData', err);
      if (err.response && err.response.data) {
        const outputBody = {
          ack: '1',
          errors: [{
            code: err.response.data.code,
            message: err.response.data.message,
            type: 'First Data error',
            vendor: 'First Data',
            category: 'generic_error'
          }]
        }
        context.res = {
          status: 200,
          body: outputBody
        };
        context.done();
      } else {
        sendError(context, '5003', 'Connection / timeout error', 'Connection / timeout', 'First Data', 'generic_error');
      }
    });
};

module.exports = function (context, req) {

  if (req.query && req.query.warmupflag) {
    context.done();
    return;
  }
  context.log('getAllAccounts log- req.body.GUID', req.body.GUID);

  if (req.headers.swy_sso_token) {
    if (process.env.SSO_VALIDATION) {
      validateSwySsoToken(context, req, getFdCustomerId.bind(null, context, req.body));
    } else {
      getFdCustomerId(context, req.body);
    }
  } else if (process.env.OKTA_VALIDATION) {
    validateAccessToken(context, req, getFdCustomerId.bind(null, context, req.body));
  } else {
    getFdCustomerId(context, req.body);
  }
};
