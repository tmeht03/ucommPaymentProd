'use strict';
require('../config/db');
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
        context.log('salesTransaction log- Customer not present in Azure DB');
        const updates = {
          paymentStatus: 'FAILED',
          fdTransactionId: 'DB - fdCustomer not present'
        };
        Transaction.findOneAndUpdate({ orderId: body.orderId }, updates, { new: true })
          .then(res => {
            const outputBody = {
              ack: '1',
              errors: [{
                code: '50000',
                message: 'Customer not found in OTF-DB',
                type: 'Backend error',
                category: 'generic_error',
                vendor: 'Ucomm Backend'
              }]
            }
            context.res = {
              status: 200,
              body: outputBody
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
                  message: 'Error updating txn info with customer not found error',
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
  function uniqueNumber() {
    let date = Date.now();

    // If created at same millisecond as previous
    if (date <= uniqueNumber.previous) {
      date = ++uniqueNumber.previous;
    } else {
      uniqueNumber.previous = date;
    }
    return date;
  };
  const clientReqId = uniqueNumber();
  context.log('salesTransaction log - client reqid for this txn is: ', clientReqId);
  uniqueNumber.previous = 0;

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
      orderId: body.orderId,
      merchantId: body.merchantId,
      requestedAmount: body.transactionAmount,
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
      'Timestamp': time,
      'Client-Request-Id': clientReqId
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
            paymentStatus: 'SUCCESS',
            transactionAmount: outputBody.approvedAmount,
            approvalNumber: outputBody.hostExtraInfo[0].value,
            transactionCompleteAt: new Date()
          };
          Transaction.findOneAndUpdate({ orderId: body.orderId }, updates, { new: true })
            .then(res => {
            }).catch(err => {
            });

             const sngurl = `https://${process.env.SNG_BASEURL}/clearCart`;
          const sngconfigData = {
            headers: {
              'Ocp-Apim-Subscription-Key': process.env.SNG_OCP_APIM_SUBSCRIPTION_KEY,
              'guid': body.GUID
            }
          };
          //clear cart when successfull payment has been done
          axios.delete(sngurl,sngconfigData)
          .then(res =>{
            context.log('salesTransaction log- clear cart output ', res);
          })
          .catch(err =>{
            context.log('salesTransaction log- error on clear cart ', err);
          });

          context.done();
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
          body: outputBody
        };
        const updates = {
          paymentStatus: 'FAILED',
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
  context.log('salesTransaction log - input txn is ', body);
  body.transactionStatus = "SUCCESS";
  body.transactionCat = 'PURCHASE';
  // change this and make it dynamic once the store information is integrated on the front end and correct store info cna be passed
  body.divisionPrefix = 'NCA';
  const date = new Date();
  body.transactionStartAt = date;


  Transaction.findOne({orderId : body.orderId})
  .then(res =>{
    context.log('salesTransaction log - found txn is ',res);
    if(res && res.paymentStatus && (res.paymentStatus === 'SUCCESS' || res.paymentStatus === 'APPROVED')){
      context.log('Payment has already been processed');
      const outputBody = {
        ack: '1',
        errors: [{
          code: '6000',
          message: 'Payment has already been processed',
          type: 'Backend error',
          category: 'duplicate_payment',
          vendor: 'Ucomm Backend'
        }]
      }
      context.res = {
        status: 200,
        body: outputBody
      }
      context.done();
    }else if(res && res.paymentStatus === 'FAILED'){
      getFdCustId(context, res);
    }else if(!res){
      new Transaction(body)
      .save()
      .then(newTxn => {
        context.log('salesTransaction log - new txn docuemnt is ', newTxn);
        getFdCustId(context, newTxn);
      }).catch(err => {
        context.log('salesTransaction log - error creating new txn docuemnt ', err);
        const outputBody = {
          ack: '1',
          errors: [{
            code: '50000',
            message: 'Error writing new txn document in Azure DB',
            type: 'Backend error',
            category: 'generic_error',
            vendor: 'Ucomm Backend'
          }]
        }
        context.res = {
          status: 200,
          body: outputBody
        };
        context.done();
      });
    }else if(res && !res.paymentStatus){
      getFdCustId(context, res);
    }
  }).catch(err => {
    context.log('salesTransaction log - error finding txn ',err);
    const outputBody = {
      ack: '1',
      errors: [{
        code: '50000',
        message: 'Azure backend error',
        type: 'Backend error',
        category: 'generic_error',
        vendor: 'Ucomm Backend'
      }]
    }
    context.res = {
      status: 200,
      body: outputBody
    };
    context.done();
  })
 
};

module.exports = (context, req) => {
  if (req.query && req.query.warmupflag) {
    context.done();
    return;
  }
  context.log('Input: ', req.body);
  createTxn(context, req.body);
};
