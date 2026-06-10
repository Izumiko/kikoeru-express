import { validationResult } from 'express-validator';
import type { Request, Response } from 'express';

const isValidRequest = (req: Request, res: Response, sendMessage = true): boolean => {
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
