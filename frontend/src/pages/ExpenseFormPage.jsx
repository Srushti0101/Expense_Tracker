import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import { getApiErrorMessage, getFieldError } from '../utils/apiErrors';
import { getLocalDateString } from '../utils/dates';

export default function ExpenseFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    title: '',
    amount: '',
    date: getLocalDateString(),
    category: '',
    notes: '',
  }));

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    const requests = [api.get('/categories/')];
    if (id) requests.push(api.get(`/expenses/${id}/`));
    Promise.all(requests)
      .then(([categoryResponse, expenseResponse]) => {
        if (!current) return;
        setCategories(categoryResponse.data);
        if (expenseResponse) {
          setForm({
            title: expenseResponse.data.title,
            amount: expenseResponse.data.amount,
            date: expenseResponse.data.date,
            category: String(expenseResponse.data.category),
            notes: expenseResponse.data.notes || '',
          });
        }
      })
      .catch((requestError) => {
        if (current) setError(getApiErrorMessage(requestError, 'Could not load the expense form.'));
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [id]);

  const set = (key) => (event) => {
    setErrors((current) => ({ ...current, [key]: undefined }));
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setError('');
    try {
      if (id) await api.put(`/expenses/${id}/`, form);
      else await api.post('/expenses/', form);
      navigate('/expenses', { state: { message: id ? 'Expense updated.' : 'Expense added.' } });
    } catch (requestError) {
      setErrors(requestError.response?.data || {});
      setError(getApiErrorMessage(requestError, 'Could not save this expense.'));
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (key) => {
    const message = getFieldError(errors, key);
    return message ? <small className="field-error">{message}</small> : null;
  };

  if (loading) return <div className="loader">Loading expense form…</div>;
  if (error && !categories.length && !id) {
    return <section className="card error-state"><h2>Expense form unavailable</h2><p>{error}</p><Link className="btn btn-secondary" to="/expenses">Back to expenses</Link></section>;
  }
  if (error && id && !form.title) {
    return <section className="card error-state"><h2>Could not load this expense</h2><p>{error}</p><Link className="btn btn-secondary" to="/expenses">Back to expenses</Link></section>;
  }

  return (
    <div className="form-page">
      <Link className="back-link" to="/expenses">← Back to expenses</Link>
      <form className="card form-card" onSubmit={submit}>
        <p className="eyebrow">{id ? 'UPDATE YOUR RECORD' : 'NEW TRANSACTION'}</p>
        <h1>{id ? 'Edit expense' : 'Add an expense'}</h1>
        <p className="muted">Add the details below to keep your spending up to date.</p>
        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <label htmlFor="expense-title">Title</label>
        <input id="expense-title" maxLength="200" autoFocus value={form.title} onChange={set('title')} placeholder="e.g. Weekly groceries" required />
        {fieldError('title')}

        <label htmlFor="expense-amount">Amount (₹)</label>
        <input id="expense-amount" type="number" min="0.01" max="9999999999.99" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" required />
        {fieldError('amount')}

        <label htmlFor="expense-date">Date</label>
        <input id="expense-date" type="date" max={getLocalDateString()} value={form.date} onChange={set('date')} required />
        {fieldError('date')}

        <label htmlFor="expense-category">Category</label>
        <select id="expense-category" value={form.category} onChange={set('category')} required>
          <option value="">Choose a category</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        {fieldError('category')}
        {categories.length === 0 && (
          <small className="form-hint">Add a category before saving an expense. <Link to="/categories">Manage categories</Link></small>
        )}

        <label htmlFor="expense-notes">Notes <span className="muted">(optional)</span></label>
        <textarea id="expense-notes" rows="4" maxLength="5000" value={form.notes} onChange={set('notes')} placeholder="Add a note to help you remember…" />
        {fieldError('notes')}

        <div className="form-actions">
          <Link className="btn btn-secondary" to="/expenses">Cancel</Link>
          <button className="btn" disabled={saving || categories.length === 0}>{saving ? 'Saving…' : id ? 'Save changes' : 'Save expense'}</button>
        </div>
      </form>
    </div>
  );
}
