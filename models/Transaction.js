/**
 *  Payment Transaction Schema
 */
'use strict';
const mongoose = require('mongoose');
const validation = require('./validation/transactionValidation.js');

const transactionSchema = mongoose.Schema({

    /*
     * Safeway attributes
     * Safeway email address
     */
    'GUID': {
        type: String,
        required: true,
        minlength: 4
    },
    /* MID - merchant id uniquely identifies the fuel station which will be used for settlements by first data. We will create a common DB for MIDs for stores and stations  */
    'merchantId': {
        type: String,
        required: true
    },
    // First Data customer id
    'fdCustomerId': {
        type: String,
        required: false
    },
    /*
     * Unique identifier that FirstData generated for each of the user's cards
     */
    'fdAccountId': {
        type: String,
        required: false,
        minlength: 4
    },
    /*
     * Unique identifier that FirstData sends for the transaction (will send to Infonet)
     */
    'fdAuthorizationId': {
        type: String,
        required: false
    },
    /*
     * Unique identifier from FirstData for tracking transaction, will be captureId for OTf and salesId for scan and go 
     */
    'fdTransactionId': {
        type: String,
        required: false
    },
    /*
     * Unique identifier from FirstData for that account - trans_armor_token used to generate the cardPANPrint and send it to infonet
     */
    'fdToken': {
        type: String,
        required: false
    },
    /*
     * Identifier for the source of the payment method - apple pay or vaulted account
     */
    'paymentSource': {
        type: String,
        required: true
    },
    /*
     * Apple pay payload required for pre-auth by first data
     */
    'applePayVersion': {
        type: String,
        required: false
    },
    'applePaydata': {
        type: String,
        required: false
    },
    'applePaySignature': {
        type: String,
        required: false
    },
    'applePayApplicationData': {
        type: String,
        required: false
    },
    'applePayEphemeralPublicKey': {
        type: String,
        required: false
    },
    'applePayPublicKeyHash': {
        type: String,
        required: false
    },
    'applePayTransactionId': {
        type: String,
        required: false
    },
    'infonetTimestamp': {
        type: String,
        required: false
    },
    /*
     * pumpNumber, corresponds to Infonet FuelingPositionID (to Infonet)
     */
    'pumpNumber': {
        type: Number,
        required: false
    },
    /*
     * 4 digit storeId, corresponds to Infonet SiteID (to Infonet)
     */
    'storeId': {
        type: String,
        required: true
    },
    'cardType': {
        type: String,
        required: false
    },
    'txnId': {
        type: Number,
        required: true

    },
    /*
     * Attributes InfoNet will update once fueling is complete
     * txnAmount is total $ amount of transaction
     */
    'txnAmount': {
        type: Number,
        required: false
    },
    /*
     * fuelGrade, e.g. "UNLEADED", corresponds to Infonet ProductCode
     */
    'fuelGrade': {
        type: String,
        required: false
    },
    /*
     * Volume of fuel, likely in gallons
     */
    'fuelVolume': {
        type: Number,
        required: false
    },
    /*
     * Original price per unit of fuel
     */
    'originalUnitPrice': {
        type: Number,
        required: false
    },
    /*
     * Discounted price per unit of fuel
     */
    'discountedUnitPrice': {
        type: Number,
        required: false
    },
    'fuelingCompleteAt': {
        type: String,
        required: false
    },
    /*
     * transactionCat
     * When transaction is created, must be a Purchase, Refund, other(?)
     */
    'transactionCat': {
        type: String,
        required: true
    },
    'paymentStatus': {
        type: String,
        required: false
    },
    // knowing the trabsaction source, whether it is OTF or a scan and go transaction
    'source': {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('Transaction', transactionSchema);