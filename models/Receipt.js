var mongoose = require("mongoose");

var receiptSchema = mongoose.Schema({
	"transactionId": {
		type: Number,
		required: true
	},
	"userId": {
		type: String,
		required: true
	},
	"fuelAmount" : {
		type: Number,
		required: true
	}
	// "fuelDate" : "April 5th, 2017",
	// "fuelGrade" : "Premium",
	// "Rewards Used" : "Yes - 200 points",
});

var Receipt = mongoose.model("Receipt", receiptSchema);

module.exports = Receipt;