/**
 * LUNAVISTA Standard API Response Helper
 * Validates HTTP status and Content-Type before parsing JSON.
 * Protects against HTML error documents or SPA fallback responses.
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  status: number;
  endpoint: string;

  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

export async function parseApiResponse<T>(resp: Response, endpoint: string): Promise<T> {
  const contentType = resp.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!resp.ok) {
    let detail = `Request to ${endpoint} failed with HTTP ${resp.status}`;
    if (isJson) {
      try {
        const errObj = await resp.json();
        detail = errObj.detail || errObj.message || detail;
      } catch {
        // Fallback to default status detail
      }
    } else {
      detail = `API error at ${endpoint} (HTTP ${resp.status}): Server returned non-JSON response (${resp.statusText || 'Error'})`;
    }
    throw new ApiError(detail, resp.status, endpoint);
  }

  if (!isJson) {
    throw new ApiError(
      `API error at ${endpoint}: Expected JSON response but received ${contentType || 'non-JSON response'}. Verify backend server is running and endpoint route is registered.`,
      resp.status,
      endpoint
    );
  }

  return (await resp.json()) as T;
}
