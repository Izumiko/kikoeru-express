// @ts-nocheck
import { validationResult } from 'express-validator';

const isValidRequest = (req, res, sendMessage = true) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (sendMessage) {
      res.status(400).json({ errors: errors.array() });
    }
    return false;
  } else {
    return true;
  }
};

export { isValidRequest };
