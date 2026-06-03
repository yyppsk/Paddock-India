import { Lock, Mail, User, ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest, navigate } from '../api.js';

const modeCopy = {
  login: {
    title: 'Sign In',
    body: 'Access your Paddock India account or continue to the admin garage.',
    action: 'Sign in',
  },
  signup: {
    title: 'Create Account',
    body: 'Create a driver account. Admin roles are assigned from the secure admin panel.',
    action: 'Create account',
  },
  forgot: {
    title: 'Reset Password',
    body: 'Enter your email and we will send a reset link if the account exists.',
    action: 'Send reset link',
  },
  reset: {
    title: 'Set New Password',
    body: 'Choose a new password for your Paddock India account.',
    action: 'Update password',
  },
  verify: {
    title: 'Verify Email',
    body: 'Confirming your email address.',
    action: 'Verify email',
  },
};

export function AuthPage({ mode = 'login' }) {
  const copy = modeCopy[mode] || modeCopy.login;
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (mode !== 'verify') {
      return;
    }

    const token = params.get('token');
    if (!token) {
      setError('Verification token is missing.');
      return;
    }

    setSubmitting(true);
    apiRequest('/api/auth/verify-email', { method: 'POST', body: { token } })
      .then(() => setMessage('Email verified. You can sign in now.'))
      .catch((requestError) => setError(readableError(requestError)))
      .finally(() => setSubmitting(false));
  }, [mode, params]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'login') {
        const result = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: { email: form.email, password: form.password },
        });
        navigate(result.user?.isAdmin ? '/admin' : '/');
        return;
      }

      if (mode === 'signup') {
        const result = await apiRequest('/api/auth/signup', {
          method: 'POST',
          body: { email: form.email, password: form.password, displayName: form.displayName },
        });
        navigate(result.user?.isAdmin ? '/admin' : '/');
        return;
      }

      if (mode === 'forgot') {
        await apiRequest('/api/auth/forgot-password', { method: 'POST', body: { email: form.email } });
        setMessage('If that account exists, a reset email has been sent.');
      }

      if (mode === 'reset') {
        await apiRequest('/api/auth/reset-password', {
          method: 'POST',
          body: { token: params.get('token'), password: form.password },
        });
        setMessage('Password updated. You can sign in now.');
      }
    } catch (requestError) {
      setError(readableError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="auth-title">
        <button className="auth-back" type="button" onClick={() => navigate('/')}>
          <ArrowLeft aria-hidden="true" />
          Track
        </button>
        <p className="eyebrow">Paddock India Account</p>
        <h1 id="auth-title">{copy.title}</h1>
        <p>{copy.body}</p>

        {mode !== 'verify' ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'signup' ? (
              <label>
                <span>Name</span>
                <span className="auth-input">
                  <User aria-hidden="true" />
                  <input
                    autoComplete="name"
                    id="displayName"
                    name="displayName"
                    value={form.displayName}
                    onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                    placeholder="Your name"
                  />
                </span>
              </label>
            ) : null}

            {mode !== 'reset' ? (
              <label>
                <span>Email</span>
                <span className="auth-input">
                  <Mail aria-hidden="true" />
                  <input
                    autoComplete="email"
                    id="email"
                    inputMode="email"
                    name="email"
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder="you@example.com"
                  />
                </span>
              </label>
            ) : null}

            {mode !== 'forgot' ? (
              <label>
                <span>Password</span>
                <span className="auth-input">
                  <Lock aria-hidden="true" />
                  <input
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    id="password"
                    name="password"
                    required
                    type="password"
                    minLength={10}
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    placeholder="10+ chars, letters and numbers"
                  />
                </span>
              </label>
            ) : null}

            <button className="auth-submit" disabled={submitting} type="submit">
              {submitting ? 'Working...' : copy.action}
            </button>
          </form>
        ) : null}

        {message ? <p className="auth-message">{message}</p> : null}
        {error ? <p className="auth-error">{error}</p> : null}

        <nav className="auth-links" aria-label="Account links">
          {mode !== 'login' ? <button onClick={() => navigate('/login')}>Sign in</button> : null}
          {mode !== 'signup' ? <button onClick={() => navigate('/signup')}>Create account</button> : null}
          {mode !== 'forgot' ? <button onClick={() => navigate('/forgot-password')}>Forgot password</button> : null}
        </nav>
      </section>
    </main>
  );
}

function readableError(error) {
  const label = String(error.message || '').replace(/_/g, ' ');
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : 'Request failed.';
}
