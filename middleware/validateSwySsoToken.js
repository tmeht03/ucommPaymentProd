/**
 * Validate Safeway SSO token before proceeding to other operations
 * This middleware uses the Safeway 'get profile' url which returns data
 * on the customer. In this case, we are using it to verify that the
 * user has an active SSO token, and getting the user's name and userId
 **/

const axios = require('axios');

module.exports = (context, req, callback) => {
  const SWY_SSO_TOKEN = req.headers.swy_sso_token;
  if (SWY_SSO_TOKEN) {
    axios.get(process.env.GET_PROFILE_URL, {
      headers: {
        Accept: 'application/json',
        SWY_SSO_TOKEN
      }
    })
    .then(response => {
      if (response.data.ack === '0') {
        context.user = {
          userId: response.data.userAccount.userId,
          firstName: response.data.userAccount.firstName,
          lastName: response.data.userAccount.lastName
        };
        context.log(`SWY_SSO validation log- status ${response.status}, ${response.data.userAccount.userId}`);
        // Proceed to the next function in the index.js using this middleware
        callback();
      } else {
        // The Get Profile URL may send an error(s) with ack: '1' under status 200
        context.log('SWY_SSO validation log- error response', response);
        let errors = [];
        if (response.data && response.data.errors) {
          errors = response.data.errors;
          errors.forEach(error => {
            error.type = 'Safeway SSO token validation';
            error.vendor = 'Safeway API';
            error.category = 'generic_error';
          });
        }
        context.res = {
          status: 200,
          body: {
            ack: '1',
            errors
          }
        };
        context.log('SWY_SSO validation log- response', JSON.stringify(context.res));
        context.done();
      }
    })
    .catch(err => {
      context.log('SWY_SSO validation log- error', err);
      if (err.response && err.response.status === 403) {
        context.res = {
          status: 200,
          body: {
            ack: '1',
            errors: [{
              code: 4003,
              message: 'Forbidden- Please provide a valid SWY_SSO_TOKEN',
              type: 'Safeway SSO token validation',
              vendor: 'Safeway API',
              category: 'generic_error'
            }]
          }
        };
      } else {
        const code = err.response ? err.response.status : null;
        const message = err.response ? err.response.statusText : null;
        context.res = {
          status: 200,
          body: {
            ack: '1',
            errors: [{
              code,
              message,
              type: 'Safeway SSO token validation',
              vendor: 'Safeway API',
              category: 'generic_error'
            }]
          }
        };
      }
      context.log('SWY_SSO validation log- response', JSON.stringify(context.res));
      context.done();
    });
  } else {
    context.res = {
      status: 200,
      body: {
        ack: '1',
        errors: [{
          code: '4001',
          message: 'Please include a SWY_SSO_TOKEN header with your request',
          type: 'Safeway SSO token validation',
          vendor: 'Safeway API',
          category: 'generic_error'
        }]
      }
    };
    context.log('SWY_SSO validation log- response', JSON.stringify(context.res));
    context.done();
  }
}
