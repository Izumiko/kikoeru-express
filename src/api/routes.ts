import express from 'express';
import authRoutes from '../modules/auth/routes.js';
import configRoutes from '../modules/config/routes.js';
import credentialsRoutes from '../modules/credentials/routes.js';
import mediaRoutes from '../modules/media/routes.js';
import metadataRoutes from '../modules/metadata/routes.js';
import reviewRoutes from '../modules/review/routes.js';
import systemRoutes from '../modules/system/routes.js';
import versionRoutes from '../modules/version/routes.js';

const router = express.Router();

router.use('/', systemRoutes);
router.use('/auth', authRoutes);
router.use('/credentials', credentialsRoutes);
router.use('/version', versionRoutes);
router.use('/config', configRoutes);
router.use('/', mediaRoutes);
router.use('/review', reviewRoutes);
router.use('/', metadataRoutes);

export default router;
