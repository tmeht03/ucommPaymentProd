// This function will send a "fdAuthorizationId" token on successful authorization of payment method

'use strict';
require('../config/db');
const CustomerId = require('../models/CustomerId');
const Transaction = require('../models/Transaction');
const CryptoJS = require('crypto-js');
const axios = require('axios');
const key = process.env.FD_KEY;
const secret = process.env.FD_SECRET;
const fdBaseUrl = process.env.FD_BASEURL;
let fundingSource = '';

const getFdCustId = (context, body) => {
  const GUID = body.GUID;
  CustomerId
    .findOne({ "GUID": GUID })
    .then(customer => {
      if (customer === null) {
        const errorbody = {
          message: 'Customer not found in OTF-DB'
        };
        context.log('authorizePayment log- Customer not present');
        context.res = {
          status: 400,
          body: errorbody
        };
        const updates = {
          fdAuthorizationId: 'DB - fdCustomer not present'
        };
        Transaction.findByIdAndUpdate(body._id, updates, { new: true })
          .then(res => {
            context.done();
          }).catch(err => {
            context.done();
          });
      } else {
        const fdCustomerId = customer.fdCustomerId;
        context.log('authorizePayment log- fdCustomerID', fdCustomerId);
        authPayment(context, fdCustomerId, body);
      }
    })
    .catch(e => {
      var error = e.name === "ValidationError" ? e.errors : e;
      context.res = {
        status: 400,
        body: JSON.parse(JSON.stringify(error))
      };
      context.log('authorizePayment log- catching mongo error', e);
      context.done();
    });
};

const authPayment = (context, fdCustomerId, body) => {
  context.log('authorizePayment log- body in authPayment', body);
  const transactionReceived = body;
  // Request Headers
  const time = new Date().getTime();
  let rawSignature = `${key}:${time}`;
  const method = 'POST';

  if (body.paymentSource == 'vaulted_account') {
    context.log('authorizePayment log - vaulted account');
    fundingSource = {
      vaultedAccount: {
        fdAccountId: body.fdAccountId
      }
    }
  } else if (body.paymentSource == 'apple_pay') {
    context.log('authorizePayment log - apple pay');
    fundingSource = {
      applePay: {
        version: body.applePayVersion,
        data: body.applePaydata,
        signature: body.applePaySignature,
        applicationData: body.applePayApplicationData,
        header: {
          ephemeralPublicKey: body.applePayEphemeralPublicKey,
          publicKeyHash: body.applePayPublicKeyHash,
          transactionId: body.applePayTransactionId
        }
      }
    }
  }
  // Request Body
  let requestBody = {
    fdCustomerId: fdCustomerId,
    authorization: {
      orderId: body._id,
      merchantId: body.merchantId,
      outdoorSale: true,
      requestedAmount: '125.00',
      currencyCode: {
        number: 840
      },
      fundingSource,
      industrySpecificInfo: {
        fuelPurchaseInfo: {
          pumpNumber: body.pumpNumber
        }
      }
    }
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

  const url = `https://${fdBaseUrl}/ucom/v1/payments/auths`;
  const configData = {
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': key,
      'Authorization': `HMAC ${authorization}`,
      'Timestamp': time,
      'Client-Request-Id': body._id
    },
    timeout: parseInt(process.env.DEFAULT_TIMEOUT)
  };

  axios.post(url, fdRequestBody, configData)
    .then(res => {
      const result = JSON.stringify(res.data);
      context.log(`authorizePayment log- First Data Response Body: ${result}`);
      const resultbody = res.data;
      resultbody.transactionReceived = transactionReceived;
      try {
        if (res.status && res.status === 201) {
          const outputBody = JSON.parse(JSON.stringify(resultbody));
          context.res = {
            status: 200,
            body: outputBody
          };
          context.log('authorizePayment log- outputBody', context.res);
          context.done();
        } else {
          const outputBody = JSON.parse(JSON.stringify(res.data));
          context.res = {
            status: res.status,
            body: outputBody
          };
          context.log('authorizePayment log- output', context.res);
          context.done();
        }
      } catch (error) {
        context.res = {
          status: 400,
          body: error
        };
        const updates = {
          fdAuthorizationId: '5000 - Response parse error'
        };
        Transaction.findByIdAndUpdate(body._id, updates, { new: true })
          .then(res => {
            context.done();
          }).catch(err => {
            context.done();
          });
      }
    })
    .catch(err => {
      context.log('authorizePayment log- error calling First Data', err);
      if (err.response) {
        try {
          const errBody = JSON.parse(JSON.stringify(err.response.data));
          const output = {
            status: err.response.status,
            body: errBody
          };
          context.res = output;
          const updates = {
            fdAuthorizationId: `${errBody.code}-${errBody.message}`
          };
          Transaction.findByIdAndUpdate(body._id, updates, { new: true })
            .then(res => {
              context.done();
            }).catch(err => {
              context.done();
            });
        } catch (error) {
          context.res = {
            status: 400,
            body: error
          };
          const updates = {
            fdAuthorizationId: '5000 - Generic error'
          };
          Transaction.findByIdAndUpdate(body._id, updates, { new: true })
            .then(res => {
              context.done();
            }).catch(err => {
              context.done();
            });
        }
      } else {
        context.res = {
          status: 400,
          body: {
            message: 'Error attempting to reach First Data'
          }
        };
        const updates = {
          fdAuthorizationId: '5003 - Service Unavailable'
        };
        Transaction.findByIdAndUpdate(body._id, updates, { new: true })
          .then(res => {
            context.done();
          })
          .catch(err => {
            context.done();
          });
      }
    })
};

module.exports = (context, req) => {
  if (req.query && req.query.warmupflag) {
    context.done();
    return;
  }
  getFdCustId(context, req.body);
}
