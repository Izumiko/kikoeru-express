const express = require('express');
const router = express.Router();

router.use('/', require('../src/modules/system/routes.js'));

router.use('/auth', require('./auth'));
router.use('/credentials', require('./credentials'));
router.use('/version', require('./version'));
router.use('/config', require('./config'));
router.use('/', require('../src/modules/media/routes.js'));
router.use('/review', require('./review'));
// Other routes
router.use('/', require('../src/modules/metadata/routes.js'));

module.exports = router;
