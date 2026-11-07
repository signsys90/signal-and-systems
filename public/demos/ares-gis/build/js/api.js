async function fetchJSON(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed: ".concat(response.status));
  }
  return response.json();
}
function adminHeaders() {
  const token = localStorage.getItem("apiAdminToken") || "";
  return token ? { "x-api-token": token, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}
