const rawApiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1';

/** API base URL without a trailing slash. */
export const API_URL = rawApiUrl.replace(/\/+$/, '');
