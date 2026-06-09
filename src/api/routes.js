const express = require('express');

const router = express.Router();

router.use('/', require('../modules/system/routes.js'));
router.use('/auth', require('../modules/auth/routes.js'));
router.use('/credentials', require('../modules/credentials/routes.js'));
router.use('/version', require('../modules/version/routes.js'));
router.use('/config', require('../modules/config/routes.js').router);
router.use('/', require('../modules/media/routes.js'));
router.use('/review', require('../modules/review/routes.js'));
router.use('/', require('../modules/metadata/routes.js'));

module.exports = router;
