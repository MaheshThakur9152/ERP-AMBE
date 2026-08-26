import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.statusCode || err.status || 500;
  const isDevOrStaging = process.env.NODE_ENV !== 'production';

  console.error('❌ Global Error:', {
    message: err.message,
    statusCode,
    details: err.details,
    hint: err.hint,
    code: err.code,
    missingFields: err.missingFields,
    stack: err.stack,
  });

  const errorMessage = isDevOrStaging
    ? err.message || err.details || 'Internal Server Error'
    : (statusCode === 500 ? 'Internal Server Error' : err.message);

  res.status(statusCode).json({
    success: false,
    error: errorMessage,
    ...(err.missingFields ? { missingFields: err.missingFields } : {}),
    ...(isDevOrStaging && err.details ? { details: err.details } : {}),
    ...(isDevOrStaging && err.hint ? { hint: err.hint } : {}),
    ...(isDevOrStaging && err.code ? { code: err.code } : {}),
  });
};

