const mongoose = require('mongoose');

var customerIdSchema = mongoose.Schema({
	'GUID': {
		type: String,
		required: true
	},
	'fdCustomerId': {
		type: String,
		required: false
	},
	'token': {
		type: String,
		required: false
	},
	'expiryDate': {
		type: String,
		required: false
	},
	'cardType': {
		type: String,
		required: false
	},
	'fullName': {
		type: String,
		required: false
	},
	'status': {
		type: String,
		required: false
	},
	'userBlocked': {
		type: Boolean,
		required: false
	},
	'defaultCard': {
		type: String,
		required: false
	},
	'addCardTime': {
		type: Number,
		required: false
	},
	'cardCounter': {
		type: Number,
		required: false
	},
	// Preferences that can be set by the customer
	// Use rewards by default
	'rewardsFlag': {
		type: Boolean,
		required: false
	},
	// Print paper receipt at pump by default
	'printReceiptFlag': {
		type: Boolean,
		required: false
	},
	// Email receipt automatically upon completion of transaction 
	'emailReceiptFlag': {
		type: Boolean,
		required: false
	},
});

const CustomerId = mongoose.model('CustomerId', customerIdSchema);
module.exports = CustomerId;
