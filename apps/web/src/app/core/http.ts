import type { HttpInterceptorFn } from '@angular/common/http';

/** The API authenticates with an httpOnly session cookie; send it on every API call. */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.url.startsWith('/api/') ? req.clone({ withCredentials: true }) : req);
