const validationObjects = {
  userId: {
    validator: function (email) {
      const emailRegex = /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/;
      return emailRegex.test(email);
    },
    message: '{VALUE} is not a valid email.'
  }
}

module.exports = validationObjects;
