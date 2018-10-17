var mongoose = require("mongoose"),
	autoIncrement = require('mongoose-auto-increment');
autoIncrement.initialize(mongoose);
var faqSchema = mongoose.Schema({
	"Category": {
		type: String,
		required: true
	},
	"Question": {
		type: String,
		required: true
	},
	"Answer": {
		type: String,
		required: true
	}
});

faqSchema.plugin(autoIncrement.plugin, 'Faq')
var Faq = mongoose.model("Faq", faqSchema);

module.exports = Faq;
