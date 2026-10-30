import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { getApiErrorMessage } from '../utils/apiErrors';
import AuthLayout from '../components/AuthLayout';

export default function ForgotPassword() {
  // Step 1: enter email. Step 2: enter OTP + new password.
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState(''); // email address
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  // Step 1 (also used by "Resend OTP"): ask the backend to email an OTP.
  const submit = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post('/auth/password-reset/otp/', {
        email: identifier.trim(),
      });
      setMsg(data?.detail || 'If that email is registered, an OTP has been sent.');
      setStep(2);
    } catch (err) {
      if (err.response?.data?.code === 'email_delivery_not_configured') {
        setError(
          'Password reset email is not configured on the backend. Configure EMAIL_HOST, EMAIL_HOST_USER and EMAIL_HOST_PASSWORD on the server, then restart the backend.',
        );
      } else if (err.response?.data?.code === 'email_smtp_authentication_failed') {
        setError(
          'Google rejected the mail login. EMAIL_HOST_USER must be the same Gmail account that created the Google App Password in EMAIL_HOST_PASSWORD. Update the backend environment and restart the backend.',
        );
      } else if (err.response?.data?.code === 'email_delivery_failed') {
        setError(
          'The mail server did not accept the OTP. Check the backend SMTP settings and server logs.',
        );
      } else if (err.response?.data?.code === 'email_smtp_disconnected') {
        setError(
          'Google closed the SMTP login connection. Check that the App Password belongs to EMAIL_HOST_USER, and check whether Windows or IIS settings override the backend .env file. Restart the backend after updating settings.',
        );
      } else if (err.response?.status === 429) {
        setError('Too many requests. Please wait a while and try again.');
      } else {
        setError(getApiErrorMessage(err, 'We could not send your OTP. Please try again.'));
      }
    } finally {
      setSaving(false);

    }
  };

  // Step 2: verify OTP and set the new password.
  const resetPassword = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/auth/password-reset/otp/confirm/', {
        email: identifier.trim(),
        otp: otp.trim(),
        new_password: password,
      });
      setSent(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid or expired OTP. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-wrap">
      <AuthLayout
        eyebrow="Account recovery"
        title="Forgot password"
        description="Reset your ExpenseFlow password. Your Gmail password will not change."
      >
        {sent ? (
          <div className="auth-card">
            <div className="alert alert-success" role="status">
              Your password has been reset. Redirecting you to sign in…
            </div>
            <p className="auth-switch"><Link to="/login">Back to sign in</Link></p>
          </div>
        ) : step === 1 ? (
          <form className="auth-card" onSubmit={submit}>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <div className="auth-fields">
              <div className="auth-field">
                <label className="sr-only" htmlFor="forgot-identifier">Email address</label>
                <input
                  id="forgot-identifier"
                  type="email"
                  autoComplete="email"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="Registered email address"
                  required
                />
              </div>
            </div>
            <p className="auth-password-hint">
              Enter the email address registered to your ExpenseFlow account. We’ll send a 6-digit OTP to it. Your Gmail password is not changed.
            </p>
            <button className="btn auth-submit" disabled={saving}>
              {saving ? <><span className="auth-spinner" aria-hidden="true" /> Sending OTP…</> : 'Send OTP'}
            </button>
            <p className="auth-switch"><Link to="/login">Back to sign in</Link></p>
          </form>
        ) : (
          <form className="auth-card" onSubmit={resetPassword}>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            {msg && <div className="alert alert-success" role="status">{msg} Check your inbox and spam folder.</div>}
            <div className="auth-fields">
              <div className="auth-field">
                <label className="sr-only" htmlFor="forgot-otp">6-digit OTP</label>
                <input
                  id="forgot-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit OTP"
                  required
                />
              </div>
              <div className="auth-field">
                <label className="sr-only" htmlFor="forgot-new-password">New password</label>
                <input
                  id="forgot-new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="New password"
                  required
                />
              </div>
            </div>
            <p className="auth-password-hint">
              The OTP expires in 10 minutes. Use at least 8 characters for your new password.
            </p>
            <button className="btn auth-submit" disabled={saving}>
              {saving ? <><span className="auth-spinner" aria-hidden="true" /> Resetting…</> : 'Reset password'}
            </button>
            <div className="auth-recovery-actions">
              <button
                type="button"
                className="auth-recovery-action auth-recovery-resend"
                onClick={submit}
                disabled={saving}
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                  <path d="M16.25 8.25A6.5 6.5 0 0 0 4.7 5.7L3.5 7m0 0V3.75M3.5 7h3.25M3.75 11.75a6.5 6.5 0 0 0 11.55 2.55L16.5 13m0 0v3.25M16.5 13h-3.25" />
                </svg>
                Resend OTP
              </button>
              <button
                type="button"
                className="auth-recovery-action auth-recovery-change"
                onClick={() => { setStep(1); setError(''); setMsg(''); setOtp(''); setPassword(''); }}
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                  <path d="m11.5 4.25 4.25 4.25M3.5 16.5l3.75-.75L16.1 6.9a1.77 1.77 0 0 0-2.5-2.5l-8.85 8.85-.75 3.25Z" />
                </svg>
                Change email
              </button>
            </div>
            <p className="auth-switch"><Link to="/login">Back to sign in</Link></p>
          </form>
        )}
      </AuthLayout>
    </div>
  );
}
