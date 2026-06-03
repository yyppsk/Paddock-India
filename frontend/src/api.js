export async function apiRequest(path, { method = 'GET', body, csrf = false } = {}) {
  const headers = { Accept: 'application/json' };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (csrf) {
    headers['X-CSRF-Token'] = getCookie('paddockindia_csrf');
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const data = await response.json().catch(() => ({ ok: false, error: 'invalid_response' }));

  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || 'request_failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function navigate(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function getCookie(name) {
  const value = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);

  return value ? decodeURIComponent(value) : '';
}
