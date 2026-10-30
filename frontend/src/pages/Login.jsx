import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const location = useLocation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try { await login(form.username, form.password); navigate('/', { replace: true }); }
    catch { setError('We could not sign you in. Check your username and password, then try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="auth-wrap">
      <AuthLayout
        eyebrow="Your account"
        title="Log in"
        description="Simplify your expenses. Settle with ease."
      >
        <form className="auth-card" onSubmit={submit}>
          {location.state?.message && <div className="alert alert-success" role="status">{location.state.message}</div>}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <div className="auth-fields">
            <div className="auth-field">
              <label className="sr-only" htmlFor="login-username">Username</label>
              <input
                id="login-username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Username"
                required
              />
            </div>
            <div className="auth-field auth-password">
              <label className="sr-only" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Password"
                required
              />
              <button
                className="auth-password-toggle"
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                <span key={showPassword ? 'hide' : 'show'} className="auth-password-toggle-label">
                  {showPassword ? 'Hide' : 'Show'}
                </span>
              </button>
            </div>
          </div>
          <Link className="auth-forgot-password" to="/forgot-password">Forgot your password?</Link>
          <button className="btn auth-submit" disabled={saving}>
            {saving ? <><span className="auth-spinner" aria-hidden="true" /> Signing in…</> : 'Sign in'}
          </button>
          <p className="auth-switch">New to ExpenseFlow? <Link to="/register">Create an account</Link></p>
        </form>
      </AuthLayout>
    </div>
  );
}