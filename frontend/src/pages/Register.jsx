import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { getApiErrorMessage, getFieldError } from '../utils/apiErrors';
import AuthLayout from '../components/AuthLayout';

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setError('');
    try {
      await api.post('/auth/register/', form);
      navigate('/login', { replace: true, state: { message: 'Your account is ready. Sign in to continue.' } });
    } catch (err) {
      setErrors(err.response?.data || {});
      setError(getApiErrorMessage(err, 'We could not create your account.'));
    } finally {
      setSaving(false);
    }
  };

  const field = (name, label, type = 'text', autoComplete = name) => (
    <div className="auth-field" key={name}>
      <label className="sr-only" htmlFor={`register-${name}`}>{label}</label>
      <div className={name === 'password' ? 'auth-password' : undefined}>
        <input
          id={`register-${name}`}
          type={name === 'password' ? (showPassword ? 'text' : 'password') : type}
          autoComplete={autoComplete}
          autoCapitalize={name === 'username' ? 'none' : undefined}
          spellCheck={name === 'username' ? 'false' : undefined}
          minLength={name === 'password' ? 6 : undefined}
          value={form[name]}
          onChange={(e) => setForm({ ...form, [name]: e.target.value })}
          aria-invalid={Boolean(getFieldError(errors, name))}
          aria-describedby={getFieldError(errors, name) ? `register-${name}-error` : undefined}
          placeholder={name === 'username' ? 'Choose a username' : name === 'email' ? 'you@example.com' : 'At least 6 characters'}
          required
        />
        {name === 'password' && (
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
        )}
      </div>
      {getFieldError(errors, name) && <small id={`register-${name}-error`} className="field-error">{getFieldError(errors, name)}</small>}
    </div>
  );

  return (
    <div className="auth-wrap">
      <AuthLayout
        eyebrow="Get started"
        title="Create your account"
        description="Start splitting and tracking expenses today."
      >
        <form className="auth-card" onSubmit={submit}>
          {error && !['username', 'email', 'password'].some((fieldName) => errors[fieldName]) && <div className="alert alert-error" role="alert">{error}</div>}
          <div className="auth-fields">
            {field('username', 'Username')}
            {field('email', 'Email address', 'email')}
            {field('password', 'Password', 'password', 'new-password')}
          </div>
          <p className="auth-password-hint">Use at least 6 characters for your password.</p>
          <button className="btn auth-submit" disabled={saving}>
            {saving ? <><span className="auth-spinner" aria-hidden="true" /> Creating account…</> : 'Create account'}
          </button>
          <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
        </form>
      </AuthLayout>
    </div>
  );
}