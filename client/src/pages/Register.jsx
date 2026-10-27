import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import AuthShell from './AuthShell.jsx';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Your analyses are saved to your account so you can compare them later."
      onSubmit={submit}
      footer={<>Already registered? <Link to="/login">Sign in</Link></>}
    >
      <>
        <label>Name
          <input autoComplete="name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>Email
          <input type="email" autoComplete="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </label>
        <label>Password
          <input type="password" autoComplete="new-password" minLength={8} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <small>At least 8 characters.</small>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Creating account' : 'Create account'}</button>
      </>
    </AuthShell>
  );
}
