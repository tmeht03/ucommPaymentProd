const sendError = (context, code, message, type, vendor, category) => {
  context.res = {
    status: '200',
    body: {
      ack: '1',
      errors: [{
        code,
        message,
        type,
        vendor,
        category
      }]
    }
  };
  context.log('Error response', JSON.stringify(context.res));
  context.done();
};

module.exports = sendError;
