var mongoose = require("mongoose");

var requiredStringProperty = {
	type: String,
	required: true
};

var stringProperty = {
	type: String,
	required: false
};

var requiredNumberProperty = {
	type: Number,
	required: true
};

var numberProperty = {
	type: Number,
	required: false
};

var requiredBooleanProperty = {
	type: Boolean,
	required: true
}

var stationSchema = mongoose.Schema({
	"DIVISION": requiredStringProperty,
	"STORE #": requiredNumberProperty,
	"ADDRESS": requiredStringProperty,
	"CITY": requiredStringProperty,
	"ST": requiredStringProperty,
	"ZIP": requiredStringProperty,
	"latitude": numberProperty,
	"longitude": numberProperty,
	"ACTUAL STORE SIZE": requiredStringProperty,
	"STORE SIZE CATEGORY": requiredStringProperty,
	"# of Dispensers": requiredNumberProperty,
	"# of Fueling Positions": requiredNumberProperty,
	"C-store / Kiosk Open 24-Hours": requiredStringProperty,
	"Pumps Available 24 Hours": requiredStringProperty,
	"Air Station Available": requiredStringProperty,
	"Water Station Available": requiredStringProperty,
	"Car Vacuum Available": requiredStringProperty,
	"Public Restroom Available": requiredStringProperty,
	"Wheel Chair Accessible Pumps": requiredStringProperty,
	"Wheel Chair Accessible Kiosk / C-Store": requiredStringProperty,
	"Car Wash": requiredStringProperty,
	"Convenience Food / Merch Available": requiredStringProperty,
	"Coffee": requiredStringProperty,
	"Diesel": requiredStringProperty,
	"OTFenabled": requiredStringProperty,
	"beaconEnabled": requiredBooleanProperty,
	"MerchantId": stringProperty,
	'radiusOfStation': numberProperty
});

var Station = mongoose.model("Station", stationSchema);

module.exports = Station;
