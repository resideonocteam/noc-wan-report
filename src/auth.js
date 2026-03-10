export const USERS = JSON.parse(import.meta.env.VITE_USERS || "[]");

const SESSION_KEY = "noc_session";

export function login(username, password) {
  const user = USERS.find(
    (u) => u.username === username.toLowerCase().trim() && u.password === password
  );
  if (user) {
    const session = { username: user.username, name: user.name, email: user.email };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }
  return null;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}
