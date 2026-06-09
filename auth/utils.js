const authService = require('../src/modules/auth/service.js');

module.exports = {
  signToken: authService.signToken,
  md5: authService.hashLegacyPassword,
  issuer: authService.issuer,
  audience: authService.audience,
};
