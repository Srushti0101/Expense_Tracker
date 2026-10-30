import { useEffect, useState } from 'react';
import api from '../api/axios';
import { getApiErrorMessage } from '../utils/apiErrors';

export default function Categories() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [editId, setEditId] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    api.get('/categories/')
      .then((response) => { if (current) setItems(response.data); })
      .catch((requestError) => {
        if (current) setError(getApiErrorMessage(requestError, 'Could not load your categories.'));
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [reload]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      if (editId) await api.patch(`/categories/${editId}/`, { name });
      else await api.post('/categories/', { name });
      setName('');
      setEditId(null);
      setMessage({ type: 'success', text: 'Category saved successfully.' });
      setReload((value) => value + 1);
    } catch (requestError) {
      setMessage({ type: 'error', text: getApiErrorMessage(requestError, 'Could not save the category.') });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (category) => {
    if (!window.confirm(`Delete “${category.name}”? Categories with expenses cannot be deleted.`)) return;
    setDeletingId(category.id);
    setMessage(null);
    try {
      await api.delete(`/categories/${category.id}/`);
      setMessage({ type: 'success', text: 'Category deleted.' });
      setReload((value) => value + 1);
    } catch (requestError) {
      setMessage({ type: 'error', text: getApiErrorMessage(requestError, 'Could not delete the category.') });
    } finally {
      setDeletingId(null);
    }
  };

  const cancelEdit = () => {
    setEditId(null);
    setName('');
    setMessage(null);
  };

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ORGANIZE YOUR SPENDING</p>
          <h1>Categories</h1>
          <p className="muted">Create a few labels to make your expenses easier to understand.</p>
        </div>
        <span className="count-pill">{items.length} {items.length === 1 ? 'category' : 'categories'}</span>
      </header>

      {message && <div className={`alert alert-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</div>}
      {error && (
        <section className="card error-state">
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={() => setReload((value) => value + 1)}>Try again</button>
        </section>
      )}

      <form className="card category-form" onSubmit={save}>
        <div className="category-form-copy">
          <p className="eyebrow">{editId ? 'RENAME CATEGORY' : 'ADD A CATEGORY'}</p>
          <h2>{editId ? 'Give it a new name' : 'What do you spend on?'}</h2>
        </div>
        <label className="sr-only" htmlFor="category-name">Category name</label>
        <input id="category-name" maxLength="100" placeholder="e.g. Food, Travel, Rent" value={name} onChange={(event) => setName(event.target.value)} required />
        <div className="category-form-actions">
          {editId && <button type="button" className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>}
          <button className="btn" disabled={saving}>{saving ? 'Saving…' : editId ? 'Save name' : 'Add category'}</button>
        </div>
      </form>

      {loading ? <div className="loader">Loading categories…</div> : items.length === 0 && !error ? (
        <section className="card empty-state">
          <span aria-hidden="true">◇</span>
          <h2>No categories yet</h2>
          <p>Add one above, such as groceries, transport or bills.</p>
        </section>
      ) : (
        <section className="category-grid" aria-label="Your categories">
          {items.map((category, index) => (
            <article className="card category-card" key={category.id}>
              <span className={`category-symbol category-symbol-${index % 5}`} aria-hidden="true">{category.name.charAt(0).toUpperCase()}</span>
              <div className="category-card-copy"><strong>{category.name}</strong><small>Expense category</small></div>
              <div className="category-card-actions">
                <button className="icon-button" aria-label={`Rename ${category.name}`} onClick={() => { setEditId(category.id); setName(category.name); setMessage(null); }}>Edit</button>
                <button className="icon-button danger-text" aria-label={`Delete ${category.name}`} onClick={() => remove(category)} disabled={deletingId === category.id}>
                  {deletingId === category.id ? '…' : 'Delete'}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
