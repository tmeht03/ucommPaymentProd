'use strict';
require('../config/db');
const counter = require('../models/counter');
const CustomerId = require('../models/CustomerId');
const Transaction = require('../models/Transaction')
const CryptoJS = require('crypto-js');
const axios = require('axios');
const host = process.env.WEBSITE_HOSTNAME;
const baseUrl = host.includes('0.0.0.0') ? `http://${host}` : `https://${host}`;
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
        context.log('salesTransaction log- Customer not present');
        context.res = {
          status: 400,
          body: errorbody
        };
        const updates = {
          fdTransactionId: 'DB - fdCustomer not present'
        };
        Transaction.findOneAndUpdate({ txnId: body.txnId }, updates, { new: true })
          .then(res => {
            context.res = {
              status: 200,
              body: {
                ack: '1',
                errors: [{
                  code: 5000,
                  message: 'Error finding FD customer mapping in Azure DB',
                  type: 'Mongo DB error',
                  vendor: 'Ucomm Backend',
                  category: 'generic_error'
                }]
              }
            };
            context.done();
          }).catch(err => {
            context.res = {
              status: 200,
              body: {
                ack: '1',
                errors: [{
                  code: 4004,
                  message: 'Error finding FD customer mapping in Azure DB',
                  type: 'Mongo DB error',
                  vendor: 'Ucomm Backend',
                  category: 'generic_error'
                }, {
                  code: 5000,
                  message: 'Error updating txn info with previous error',
                  type: 'Mongo DB error',
                  vendor: 'Ucomm Backend',
                  category: 'generic_error'
                }
                ]
              }
            };
            context.done();
          });
      } else {
        body.fdCustomerId = customer.fdCustomerId;
        context.log('salesTransaction log- updated body ', body);
        salesTransaction(context, body);
      }
    })
    .catch(e => {
      var error = e.name === "ValidationError" ? e.errors : e;
      context.res = {
        status: 200,
        body: {
          ack: '1',
          errors: [{
            code: 5000,
            message: 'Error finding FD customer mapping in Azure DB',
            type: 'Mongo DB error',
            vendor: 'Ucomm Backend',
            category: 'generic_error'
          }]
        }
      };
      context.log('salesTransaction log- catching mongo error', e);
      context.done();
    });
};

const salesTransaction = (context, body) => {
  // Request Headers
  const time = new Date().getTime();
  let rawSignature = `${key}:${time}`;
  const method = 'POST';
  if (body.paymentSource == 'vaulted_account') {
    fundingSource = {
      vaultedAccount: {
        fdAccountId: body.fdAccountId
      }
    };
  } else if (body.paymentSource == 'apple_pay') {
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
    };
  }
  // Request Body
  let requestBody = {
    fdCustomerId: body.fdCustomerId,
    sale: {
      orderId: '1234',
      merchantId: body.merchantId,
      requestedAmount: '125.00',
      currencyCode: {
        number: 840
      },
      fundingSource
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

  const url = `https://${fdBaseUrl}/ucom/v1/payments/sales`;
  const configData = {
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': key,
      'Authorization': `HMAC ${authorization}`,
      'Timestamp': time
      //'Client-Request-Id': '1234554'
    }
  };
  axios.post(url, fdRequestBody, configData)
    .then(res => {
      const result = JSON.stringify(res.data);
      context.log(`salesTransaction log- First Data Response Body: ${result}`);
      try {
        if (res.status && res.status === 201) {
          const outputBody = JSON.parse(JSON.stringify(res.data));
          outputBody.ack = '0';
          context.res = {
            status: 200,
            body: outputBody
          };
          context.log('salesTransaction log- outputBody', context.res);
          const updates = {
            fdTransactionId: outputBody.fdSaleId,
            paymentStatus: outputBody.status,
            txnAmount: outputBody.approvedAmount,
            paymentSource: body.paymentSource
          };
          Transaction.findOneAndUpdate({ txnId: body.txnId }, updates, { new: true })
            .then(res => {
              context.done();
            }).catch(err => {
              context.done();
            });
          //context.done();
        } else {
          const outputBody = JSON.parse(JSON.stringify(res.data));
          outputBody.ack = '0';
          context.res = {
            status: 200,
            body: outputBody
          };
          context.log('salesTransaction log- output', context.res);
          context.done();
        }
      } catch (error) {
        const outputBody = {
          ack: '1',
          errors: [{
            code: '50000',
            message: 'response parse error',
            type: 'Backend error',
            category: 'generic_error',
            vendor: 'Ucomm Backend'
          }]
        }
        context.res = {
          status: 200,
          body: error
        };
        const updates = {
          fdTransactionId: '5000 - Fd Response parse error'
        };
        // context.done();
        Transaction.findOneAndUpdate({ txnId: body.txnId }, updates, { new: true })
          .then(res => {
            context.done();
          }).catch(err => {
            context.done();
          });
      }
    }).catch(err => {
      const outputBody = {
        ack: '1',
        errors: [{
          code: err.response.data.code,
          message: err.response.data.message,
          type: 'First Data error',
          category: 'generic_error',
          vendor: 'First Data'
        }]
      }
      context.res = {
        status: 200,
        body: outputBody
      };
      context.log('salesTransaction log - error', context.res);
      const updates = {
        fdTransactionId: `${err.response.data.code} - ${err.response.data.message}`,
        paymentStatus: 'FAILED'
      };
      //context.done();
      Transaction.findOneAndUpdate({ txnId: body.txnId }, updates, { new: true })
        .then(res => {
          context.done();
        }).catch(err => {
          context.done();
        });
    });
};

const createTxn = (context, body) => {
  const config = {
    headers: { 'x-functions-key': process.env.X_FUNCTIONS_KEY }
  };
  const sequenceName = 'orderId';
  const increementCounterUrl = `${baseUrl}/api/getNextCounterValue/${sequenceName}`;
  axios.get(increementCounterUrl, config)
    .then(response => {
      context.log('salesTransaction log - txnId is ', response.data.sequenceValue);
      body.txnId = response.data.sequenceValue;
      body.source = 'SNG';
      body.transactionCat = 'SALES'
      new Transaction(body)
        .save()
        .then(newTxn => {
          context.log('salesTransaction log - new txn docuemnt is ', newTxn);
          getFdCustId(context, body);
        }).catch(err => {
          context.log('salesTransaction log - error creating new txn docuemnt ', err);
          context.done();
        });
    }).catch(error => {
      const outputBody = {
        ack: '1',
        errors: [{
          code: '50000',
          message: 'Error generating new order Id sequence',
          type: 'Backend error',
          category: 'generic_error',
          vendor: 'Ucomm Backend'
        }]
      }
      context.res = {
        status: 200,
        body: outputBody
      };
      context.log('salesTransaction log - error getting next value in sequence ', context.res);
    });
};

module.exports = (context, req) => {
  if (req.query && req.query.warmupflag) {
    context.done();
    return;
  }
  context.log('Input: ', req.body);
  createTxn(context, req.body);
};
