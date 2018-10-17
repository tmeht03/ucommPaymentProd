/**
 * Validate Okta accessToken before proceeding to other operations
 * This middleware uses the Okta Get UserInfo endpoint which returns data
 * on the user. In this case, we are using it to verify that the
 * user has a valid accessToken, and getting the user's name and userId
 **/

const axios = require('axios');
const sendError = require('./sendError');

module.exports = (context, req, callback) => {

  const accessToken = req.headers.accesstoken;
  if (accessToken) {
    const userInfoUrl = `${process.env.OKTA_BASE_URL}/v1/userinfo`;
    axios.get(userInfoUrl, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(res => {
        if (res.status && res.data) {
          context.log(`accessToken validation log- status ${res.status}, ${res.data.preferred_username}`);
        }
        // If accessToken is valid, Okta sends status 200
        // Proceed to bound callback
        callback();
      })
      .catch(err => {
        context.log('Okta accessToken validation error', err);
        sendError(
          context,
          '4001',
          'Invalid access token',
          'Okta token validation',
          'Okta API',
          'generic_error'
        );
      });
  } else {
    sendError(
      context,
      '4001',
      'Please include an accessToken header in your request',
      'Okta token validation',
      'Okta API',
      'generic_error'
    );
  }
}
