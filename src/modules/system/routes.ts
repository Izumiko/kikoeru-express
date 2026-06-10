// @ts-nocheck
import express from 'express';
const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.send('OK');
});

// Eliminate error message from old PWA
// Will be deleted in the future
router.get('/me', (req, res) => {
  res.redirect('/api/auth/me');
});

export default router;