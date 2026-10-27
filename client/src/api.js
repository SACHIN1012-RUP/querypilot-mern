const TOKEN_KEY = 'querypilot_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(path, { method = 'GET', body } = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Check that the API is running.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fallback =
      res.status >= 500
        ? 'The API server is not ready yet. Wait for "QueryPilot API is ready" in the terminal, then try again.'
        : 'Request failed.';
    const err = new Error(data.message || fallback);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  register: (b) => request('/auth/register', { method: 'POST', body: b }),
  login: (b) => request('/auth/login', { method: 'POST', body: b }),
  me: () => request('/auth/me'),
  analyze: (b) => request('/analyze', { method: 'POST', body: b }),
  history: () => request('/analyze/history'),
  stats: () => request('/analyze/stats'),
  getAnalysis: (id) => request(`/analyze/${id}`),
  deleteAnalysis: (id) => request(`/analyze/${id}`, { method: 'DELETE' }),
};
