// ── src/Login.jsx ─────────────────────────────────────────────────────────────
import { useState } from "react";
import { login } from "./auth.js";

const ACCENT  = "#5b5ef4";
const BG      = "#0d1117";
const CARD    = "#161c27";
const BORDER  = "#252d3d";
const TP      = "#e8edf5";
const TSEC    = "#7a8499";
const TMUTED  = "#4a5568";
const RED     = "#e84040";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const session = login(username, password);
      if (session) {
        onLogin(session);
      } else {
        setError("Invalid username or password.");
      }
      setLoading(false);
    }, 400);
  };

  return (
    <div style={{
      minHeight: "100vh", background: BG, display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 30px #1e2636 inset !important; -webkit-text-fill-color: #e8edf5 !important; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 400, padding: 24 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: ACCENT,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, margin: "0 auto 16px",
          }}>⚡</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: TP, letterSpacing: "-0.01em" }}>WANINSIGHT</div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", color: TMUTED, marginTop: 4 }}>
            NETWORK OPS PRO · RESIDEO
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 32,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: TP, marginBottom: 6 }}>Sign in</div>
          <div style={{ fontSize: 13, color: TSEC, marginBottom: 28 }}>Use your NOC team credentials</div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: TSEC, textTransform: "uppercase", marginBottom: 6 }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="alic.antunez"
                autoComplete="username"
                required
                style={{
                  width: "100%", background: "#1e2636", border: `1px solid ${BORDER}`,
                  borderRadius: 8, color: TP, fontFamily: "'Inter', sans-serif",
                  fontSize: 14, padding: "11px 14px", outline: "none",
                }}
                onFocus={e => e.target.style.borderColor = ACCENT}
                onBlur={e => e.target.style.borderColor = BORDER}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: TSEC, textTransform: "uppercase", marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••"
                autoComplete="current-password"
                required
                style={{
                  width: "100%", background: "#1e2636", border: `1px solid ${BORDER}`,
                  borderRadius: 8, color: TP, fontFamily: "'Inter', sans-serif",
                  fontSize: 14, padding: "11px 14px", outline: "none",
                }}
                onFocus={e => e.target.style.borderColor = ACCENT}
                onBlur={e => e.target.style.borderColor = BORDER}
              />
            </div>

            {error && (
              <div style={{
                background: "#260808", border: `1px solid ${RED}44`, borderRadius: 8,
                padding: "10px 14px", marginBottom: 16, fontSize: 13, color: RED,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "12px 0", background: ACCENT, color: "#fff",
                border: "none", borderRadius: 8, fontFamily: "'Inter', sans-serif",
                fontWeight: 700, fontSize: 14, letterSpacing: "0.06em", cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.7 : 1, transition: "opacity 0.2s", textTransform: "uppercase",
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: TMUTED }}>
          Contact your NOC admin to reset credentials
        </div>
      </div>
    </div>
  );
}
