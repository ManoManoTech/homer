import type { RequestHandler } from 'express';

export function catchAsyncRouteErrors(route: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    try {
      await route(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}
