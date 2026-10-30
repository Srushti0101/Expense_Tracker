import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { getApiErrorMessage } from '../utils/apiErrors';
import AuthLayout from '../components/AuthLayout';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const uid = searchParams.get('uid');
  const token = searchParams.get('token');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    if (!uid || !token) {
      setError('This password reset link is incomplete. Request a new link.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/auth/password-reset/confirm/', {
        uid,
        token,
        new_password: password,
      });
      navigate('/login', {
        replace: true,
        state: { message: 'Your password has been reset. You can now sign in.' },
      });
    } catch (err) {
      setError(getApiErrorMessage(err, 'We could not reset your password. Request a new link and try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-wrap">
      <AuthLayout
        eyebrow="Account recovery"
        title="Choose a new password"
        description="Create a new password for your ExpenseFlow account. Your Gmail password will not change."
      >
        <form className="auth-card" onSubmit={submit}>
          {!uid || !token ? (
            <div className="alert alert-error" role="alert">
              This password reset link is incomplete. <Link to="/forgot-password">Request a new link</Link>.
            </div>
          ) : (
            <>
              {error && <div className="alert alert-error" role="alert">{error}</div>}
              <div className="auth-fields">
                <div className="auth-field">
                  <label className="sr-only" htmlFor="reset-password">New password</label>
                  <input
                    id="reset-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="New password"
                    required
                  />
                </div>
                <div className="auth-field">
                  <label className="sr-only" htmlFor="reset-confirm-password">Confirm new password</label>
                  <input
                    id="reset-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Confirm new password"
                    required
                  />
                </div>
              </div>
              <p className="auth-password-hint">Use a strong password that you have not used before.</p>
              <button className="btn auth-submit" disabled={saving}>
                {saving ? <><span className="auth-spinner" aria-hidden="true" /> Resetting password…</> : 'Reset password'}
              </button>
            </>
          )}
          <p className="auth-switch"><Link to="/login">Back to sign in</Link></p>
        </form>
      </AuthLayout>
    </div>
  );
}
