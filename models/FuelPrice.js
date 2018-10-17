const mongoose = require('mongoose');

const fuelPriceSchema = mongoose.Schema({
	'infonetId': {
		type: String,
		required: true
	},
	'safewayStoreId': {
		type: Number,
		required: true
	},
	'infonetId': {
		type: String,
		required: true
	},
	'updateType': {
		type: String,
		required: true
	},
	'fuelType1': {
		name: { type: String, required: true },
		cashPrice: { type: Number, required: true },
		creditPrice: { type: Number, required: true },
		date: { type: Date, required: true }
	},
	'fuelType2': {
		name: { type: String, required: true },
		cashPrice: { type: Number, required: true },
		creditPrice: { type: Number, required: true },
		date: { type: Date, required: true }
	},
	'fuelType3': {
		name: { type: String, required: true },
		cashPrice: { type: Number, required: true },
		creditPrice: { type: Number, required: true },
		date: { type: Date, required: true }
	},
	// There are some stations with only 3 grades- REG, MID, PRE-
	// that may become otfEnabled.
	// So we only require fuelType1, fuelType2, fuelType3
	'fuelType4': {
		name: { type: String, required: false },
		cashPrice: { type: Number, required: false },
		creditPrice: { type: Number, required: false },
		date: { type: Date, required: false }
	},
	'fuelType5': {
		name: { type: String, required: false },
		cashPrice: { type: Number, required: false },
		creditPrice: { type: Number, required: false },
		date: { type: Date, required: false }
	},
	'fuelType6': {
		name: { type: String, required: false },
		cashPrice: { type: Number, required: false },
		creditPrice: { type: Number, required: false },
		date: { type: Date, required: false }
	},
	'fuelType7': {
		name: { type: String, required: false },
		cashPrice: { type: Number, required: false },
		creditPrice: { type: Number, required: false },
		date: { type: Date, required: false }
	}
});

const FuelPrice = mongoose.model('FuelPrice', fuelPriceSchema);
const FuelPriceHistory = mongoose.model('FuelPriceHistory', fuelPriceSchema, 'FuelPriceHistory');

module.exports = {
  FuelPrice,
  FuelPriceHistory
};
