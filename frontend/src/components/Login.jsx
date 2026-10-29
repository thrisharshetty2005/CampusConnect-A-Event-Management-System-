import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Login({ onLogin }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e) {
    e?.preventDefault();
    setError(""); setBusy(true);
    try {
      const r = await api.requestOtp(email.trim());
      setStep("otp"); setOtp(""); setCooldown(r.resendAfterSec || 60);
      setInfo(`We emailed a 6-digit code to ${email.trim().toLowerCase()}. It is valid for ${r.expiresInMin} minutes.`);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function verify(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const r = await api.verifyOtp(email.trim(), otp.trim());
      onLogin(r.user);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="login-wrap">
      <div className="card login">
        <div className="brand big">Campus<span>Connect</span></div>
        <p className="muted">Auditorium &amp; venue booking for NMAMIT. Verify your college email to continue.</p>
        {error && <div className="toast error">{error}</div>}
        {step === "email" ? (
          <form onSubmit={sendCode}>
            <label>College email
              <input type="email" required autoFocus placeholder="name@nmamit.in" value={email}
                onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button disabled={busy}>{busy ? "Sending…" : "Send verification code"}</button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <div className="toast ok">{info}</div>
            <label>6-digit code
              <input required autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                pattern="\d{6}" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
            </label>
            <button disabled={busy || otp.length !== 6}>{busy ? "Verifying…" : "Verify & continue"}</button>
            <div className="row-links">
              <button type="button" className="link" disabled={cooldown > 0 || busy} onClick={sendCode}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </button>
              <button type="button" className="link" onClick={() => { setStep("email"); setError(""); }}>Change email</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
