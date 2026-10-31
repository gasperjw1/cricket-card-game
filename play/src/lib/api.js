export function makeApi(token) {
  return async function api(path, body = undefined) {
    const res = await fetch(`/play/api/${path}`, {
      method: body !== undefined ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const text = await res.text();
      let message = text;
      try { message = JSON.parse(text).error ?? text; } catch { /* not JSON */ }
      throw new Error(message);
    }
    return res.json();
  };
}
