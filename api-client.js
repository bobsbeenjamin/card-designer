/* Shared client for public and authenticated Card Designer API requests. */
class ApiClient {
  constructor({
    baseUrl,
    getAccessToken = () => "",
    isAccessTokenExpired = () => false,
    refreshAccessToken = async () => false,
    onUnauthorized = () => {},
    sessionExpiredMessage = "Your session expired. Sign in again.",
  }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.getAccessToken = getAccessToken;
    this.isAccessTokenExpired = isAccessTokenExpired;
    this.refreshAccessToken = refreshAccessToken;
    this.onUnauthorized = onUnauthorized;
    this.sessionExpiredMessage = sessionExpiredMessage;
  }

  async publicRequest(path, options = {}) {
    return this.request(path, options, { authenticated: false });
  }

  async request(path, options = {}, { authenticated = true } = {}) {
    const response = await this._send(path, options, { authenticated });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `API request failed with ${response.status}.`);
    return data;
  }

  async requestBlob(path, options = {}) {
    const response = await this._send(path, options);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || data.message || `API request failed with ${response.status}.`);
    }
    return response.blob();
  }

  async _send(path, options = {}, { authenticated = true } = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !Object.keys(headers).some((name) => name.toLowerCase() === "content-type")) {
      headers["content-type"] = "application/json";
    }
    if (authenticated) {
      let token = this.getAccessToken();
      if (!token || this.isAccessTokenExpired(token)) {
        const refreshed = await this.refreshAccessToken();
        token = this.getAccessToken();
        if (!refreshed || !token) {
          this.onUnauthorized();
          throw new Error(this.sessionExpiredMessage);
        }
      }
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, { ...options, headers });
    if (authenticated && response.status === 401) {
      this.onUnauthorized();
      throw new Error(this.sessionExpiredMessage);
    }
    return response;
  }
}
