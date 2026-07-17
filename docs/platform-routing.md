# Platform routing

`/platform/*` requires platform operator authorization. `/dashboard/*` requires authenticated non-client workspace membership. `/portal/*` requires client-scoped authorization. Public routes remain outside normal application auth and use secure tokens where needed.
