'use strict';
const ucomm = require('../models/Transaction');
const axios = require('axios');
require('../config/db');
//const hostName = require('../middleware/hostName');
//const host = hostName();
//const baseUrl = host.includes('0.0.0.0') ? `http://${host}` : `https://${host}`;
let updates = "";
// This function can be used to update any of the user profile information when the user preferance changes

const updateTxn = (context, body) => {
    context.log('updateUcommTxn log - Input from create Txn is ', body);
    if (body.paymentSource === "vaulted_account") {
        updates = {
            transactionSource: 'OTF',
            GUID: body.GUID,
            merchantId: body.merchantId,
            fdCustomerId: body.fdCustomerId,
            fdAccountId: body.fdAccountId,
            fdAuthorizationId: body.fdAuthorizationId,
            fdTransactionId: body.fdCaptureId,
            fdToken: body.fdToken,
            paymentSource: body.paymentSource,
            infonetTimestamp: body.infonetTimestamp,
            pumpNumber: body.pumpNumber,
            storeId: body.storeId,
            cardType: body.cardType,
            transactionAmount: body.txnAmount,
            fuelGrade: body.fuelGrade,
            fuelVolume: body.fuelVolume,
            originalUnitPrice: body.originalUnitPrice,
            discountedUnitPrice: body.discountedUnitPrice,
            transactionCompleteAt:new Date(body.fuelingCompleteAt),
            fuelingCompleteAt: body.fuelingCompleteAt,
            transactionCat: body.transactionCat,
            transactionStatus: body.infonetStatus,
            orderId: body._id,
            approvalNumber: body.approvalNumber,
            divisionPrefix: body.storeId.substring(0, 3)
        };
    } else if (body.paymentSource === 'apple_pay') {
        update = {
            transactionSource: 'OTF',
            GUID: body.GUID,
            merchantId: body.merchantId,
            fdCustomerId: body.fdCustomerId,
            fdAccountId: body.fdAccountId,
            fdAuthorizationId: body.fdAuthorizationId,
            fdTransactionId: body.fdCaptureId,
            fdToken: body.fdToken,
            paymentSource: body.paymentSource,
            infonetTimestamp: body.infonetTimestamp,
            pumpNumber: body.pumpNumber,
            storeId: body.storeId,
            cardType: body.cardType,
            transactionAmount: body.txnAmount,
            fuelGrade: body.fuelGrade,
            fuelVolume: body.fuelVolume,
            originalUnitPrice: body.originalUnitPrice,
            discountedUnitPrice: body.discountedUnitPrice,
            transactionCompleteAt:body.fuelingCompleteAt,
            fuelingCompleteAt: body.fuelingCompleteAt,
            transactionCat: body.transactionCat,
            transactionStatus: body.infonetStatus,
            orderId: body._id,
            approvalNumber: body.approvalNumber,
            divisionPrefix: body.storeId.substring(0, 3),
            applePayVersion: body.applePayVersion,
            applePaydata: body.applePaydata,
            applePaySignature: body.applePaySignature,
            applePayApplicationData: body.applePayApplicationData,
            applePayEphemeralPublicKey: body.applePayEphemeralPublicKey,
            applePayPublicKeyHash: body.applePayPublicKeyHash,
            applePayTransactionId: body.applePayTransactionId
        }
    };
    ucomm.findOneAndUpdate({
        orderId: body._id
    }, updates, {
            new: false
        })
        .then(updatedTxn => {
            if (updatedTxn === null) {
                context.log("updateUcommTxn log - txn doesnot exist in ucomm. Creating new Txn");
                createNewTxn(context, updates);
            } else {
                const outputBody = {
                    message: 'Txn on ucomm is updated',
                    ack: '0'
                }
                context.res = {
                    status: 200,
                    body: outputBody
                };
                context.log('updateUcommTxn log - Output: ', context.res);
                context.done();
            }
        })
        .catch(e => {
            const error = e.name === "ValidationError" ? e.errors : e;
            context.res = {
                status: 200,
                body: JSON.stringify(error)
            };
            context.log('updateUcommTxn log - Error: ', context.res);
            context.done();
        });
};

const createNewTxn = (context, body) => {
    if (body.paymentSource === 'vaulted_account') {
        updates = {
            transactionSource: 'OTF',
            GUID: body.GUID,
            merchantId: body.merchantId,
            fdCustomerId: body.fdCustomerId,
            fdAccountId: body.fdAccountId,
            fdAuthorizationId: body.fdAuthorizationId,
            fdToken: body.fdToken,
            paymentSource: body.paymentSource,
            infonetTimestamp: body.infonetTimestamp,
            pumpNumber: body.pumpNumber,
            storeId: body.storeId,
            cardType: body.cardType,
            transactionCat: body.transactionCat,
            transactionStatus: body.infonetStatus,
            transactionStartAt:body.startFuelingClickedAt,
            orderId: body._id,
            divisionPrefix: body.storeId.substring(0, 3)
        };
    } else if (txn.paymentSource === 'apple_pay') {
        updates = {
            transactionSource: 'OTF',
            GUID: body.GUID,
            merchantId: body.merchantId,
            fdCustomerId: body.fdCustomerId,
            fdAccountId: body.fdAccountId,
            fdAuthorizationId: body.fdAuthorizationId,
            fdToken: body.fdToken,
            paymentSource: body.paymentSource,
            infonetTimestamp: body.infonetTimestamp,
            pumpNumber: body.pumpNumber,
            storeId: body.storeId,
            cardType: body.cardType,
            transactionCat: body.transactionCat,
            transactionStatus: body.infonetStatus,
            transactionStartAt:body.startFuelingClickedAt,
            orderId: body._id,
            divisionPrefix: body.storeId.substring(0, 3),
            applePayVersion: body.applePayVersion,
            applePaydata: body.applePaydata,
            applePaySignature: body.applePaySignature,
            applePayApplicationData: body.applePayApplicationData,
            applePayEphemeralPublicKey: body.applePayEphemeralPublicKey,
            applePayPublicKeyHash: body.applePayPublicKeyHash,
            applePayTransactionId: body.applePayTransactionId
        };
    }
    new ucomm(updates)
        .save()
        .then(newTxn => {
            context.log(`updateUcommTxn log - response from ucommCreate Txn ${JSON.stringify(newTxn)}`);
            context.res = {
                status: 200,
                body: 'Succesfully added new Txn in ucomm payment DB'
            };
            
            context.done();
            return context.res;
        }).catch(err => {
            context.log('updateUcommTxn Log - Error: ', err);
            const outputBody = {
                ack: '1',
                errors: [{
                    code: '5000',
                    message: 'Error on creating new txn on ucomm',
                    type: 'Backend server error',
                    category: 'generic_error',
                    vendor: 'OTF Backend'
                }]
            };
            context.res = {
                status: 200,
                body: outputBody
            };
            context.done();
        })
};


module.exports = function (context, req) {

    if (req.query && req.query.warmupflag) {
        context.done();
        return;
    }
    context.log('Input: ', req.body);

    if (req.body.action === 'create') {
        createNewTxn(context, req.body);
    } else {
        updateTxn(context, req.body);
    }
};
