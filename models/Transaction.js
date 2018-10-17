/**
 *  One Touch Fuel Transaction Schema
 *  Addition attributes may be required as development progresses
 *  For now we are hardcoding in the following attributes required by Infonet-
 *    UMTI (4 digit number), will be unique transaction ID
 *    MerchantID (assumed to be 'SAFEWAY' for now),
 *    paymentMethod (assumed to be 'Credit' for now),
 *    priceAdjustmentID='str1234'
 *    programID='FUELPRO'
 *    doNotRelieveTaxFlag='true'
 *    PromotionReason
 *    MaximumQuantity
 *  See function startFueling for the translation of this schema
 *  Into the XML format required by Infonet
 *
 *  The only attributes we are requiring (required: true) for the schema here
 *  are those necessary for the initial creation of the transaction-
 *  GUID OK- may not need to store but client will provide to get fdCustomerId
 *  fdCustomerId- Backend gets this from createCustomerId function before calling authorizePayment
 *  fdAccountId- OK Client acquires earlier in session, with getAllAccounts, stores in Client state
 *  userId OK
 *  receiptPreference- YES or NO OK
 *  appliedRewardsAmount- for example .001 OK
 *  rewardApplied (boolean) OK
 *  pumpNumber OK
 *  storeId OK
 *  startFuelingClickedAt ***Backend
 *  storeName storeAddressStreet storeAddressCity storeAddressState storeAddressZip OK
 *  cardPANPrint OK get from client for now. Later get from FD after authorizePayment?
 *  transactionCat ***Backend default to PURCHASE
 *  notificationHubId TBA ***Backend dummy for now
 */
'use strict';
const mongoose = require('mongoose');
const validation = require('./validation/transactionValidation.js');

const transactionSchema = mongoose.Schema({
  /*
   *  FirstData Attribues
   *  Unique identifier that FirstData generates for a user
   *  Backend will get this using createCustomerId
   */
  /** MID - merchant id uniquely identifies the fuel station which will be used ofr settlements by first data  */
  'merchantId': {
    type: String,
    required: true
  },

  'fdCustomerId': {
    type: String,
    required: false
  },
  /*
   * Unique identifier that FirstData generates for each of the user's cards
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
   * Unique identifier from FirstData for tracking transaction, displayed to user
   */
  'fdTransactionId': {
    type: String,
    required: false
  },
  /*
   * Unique identifier from FirstData for that account - trans_armor_token
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
  /*
   * Sequence Number and Approval Number from First Data received on successful pre-auth
   * Save in DB for digital receipt and pass to Infonet for paper receipt
   */
  'sequenceNumber': {
    type: String,
    required: false
  },
  'approvalNumber': {
    type: String,
    required: false
  },
  /*
  * FirstData Capture Id on completion of successful payment
  */
  'fdCaptureId': {
    type: String,
    required: false
  },
  'userId': {
    type: String,
    required: true,
    validate: validation.userId
  },
  /*
   * Safeway attributes
   * Safeway email address
   */
  'GUID': {
    type: String,
    required: true,
    minlength: 4
  },
  /*
  * Safeway Just4U rewards number
  */
  'rewardsId': {
    type: Number,
    required: false
  },
  /*
   * Infonet attributes
   *
   * Receipt preference (to Infonet)
   * YES or NO
   */
  /*
   * Unique identifier from Infonet for tracking transaction, displayed to user
   */
  'infonetTimestamp': {
    type: String,
    required: true
  },
  'receiptPreference': {
    type: String,
    required: true
  },
  /*
   * 3 digit decimal for discount amount, e.g. 0.100 (to Infonet)
   * Zero if no rewards applied
   */
  'appliedRewardsAmount': {
    type: Number,
    required: false
  },
  /*
   * Obscured credit card number (to Infonet)
   * for example ************1234
   * Will we get this after authorizePayment???
   */
  'cardPANPrint': {
    type: String,
    required: true
  },
  /*
   * Maximum $ for which customer is authorized (to Infonet)
   */
  'preAuthAmount': {
    type: Number,
    required: false
  },
  /*
   * Boolean for whether or not customer is claiming rewards (to Infonet)
   */
  'rewardApplied': {
    type: Boolean,
    required: true
  },
  /*
   * pumpNumber, corresponds to Infonet FuelingPositionID (to Infonet)
   */
  'pumpNumber': {
    type: Number,
    required: true
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
  /*
   * Unit for measuring fuel, likely "Gallons"
   */
  'unitMeasure': {
    type: String,
    required: false
  },
  'fuelingCompleteAt': {
    type: String,
    required: false
  },
  /*
   * Push Notifications
   * Device ID / Notification Hub Identifier
   * Client must send to createTransaction in order to receive pushes
   * on the transaction status
   */
  'deviceId': {
    type: String,
    required: false
  },
  /*
   * Platform is required in order to send a push
   * 'ios' or 'android'
   */
  'platform': {
    type: String,
    required: true
  },
  /*
   * Version of app may be sent
   * It may be used in sendPushNotification in order to route to correct Notification Hub
   */
  'version': {
    type: Number,
    required: false
  },
  /*
   * sendPushNotification needs firstName to send push
   */
  'firstName': {
    type: String,
    required: true
  },
  /*
   * Attributes not critical to transaction processing, but will be used in receipt
   * StartFuelingClickedAt
   *  Create on Backend right before Transaction Doc is saved
   *  Will not send this to Infonet
   *  Instead create new current date/time in createTransaction
   */
  'terminalId': {
    type: String,
    required: false
  },
  'startFuelingClickedAt': {
    type: Date,
    required: true
  },
  'storeName': {
    type: String,
    required: true
  },
  'storeAddressStreet': {
    type: String,
    required: true
  },
  'storeAddressCity': {
    type: String,
    required: true
  },
  'storeAddressState': {
    type: String,
    required: true
  },
  'storeAddressZip': {
    type: String,
    required: true
  },
  'unitPrice': {
    type: Number,
    required: false
  },
  'expiryDate': {
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
  /*
   * Status updates for transaction tracking
   */
  'voidStatus': {
    type: String,
    required: false
  },
  'infonetStatus': {
    type: String,
    required: false
  },
  'beganFlow': {
    type: String,
    required: false
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);
