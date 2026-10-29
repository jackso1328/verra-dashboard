/**
 * VÉRRA Unified API Client
 * Supports local development, independent hosting, and GitHub Pages deployments
 */

// Configurable base URL: Can be overridden via window.VERRA_API_URL or localStorage
export const API_BASE_URL = 
  window.VERRA_API_URL || 
  localStorage.getItem('verra_api_url') || 
  'http://localhost:5000/api';

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  getToken() {
    return localStorage.getItem('verra_token');
  }

  getHeaders(customHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}/${endpoint.replace(/^\//, '')}`;
    const headers = this.getHeaders(options.headers);

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Special handling for CSV or blob downloads
      if (options.responseType === 'blob' || options.responseType === 'text') {
        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status}`);
        }
        return options.responseType === 'blob' ? await response.blob() : await response.text();
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.message || `Request failed with status ${response.status}`;
        const err = new Error(errorMsg);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (error) {
      console.error(`API Error [${options.method || 'GET'} ${endpoint}]:`, error);
      throw error;
    }
  }

  get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  patch(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  async checkHealth() {
    try {
      const res = await this.get('health');
      return res;
    } catch (e) {
      return { success: false, status: 'offline', error: e.message };
    }
  }
}

export const api = new ApiClient(API_BASE_URL);
