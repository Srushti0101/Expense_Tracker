import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../api/axios';
import { getApiErrorMessage } from '../utils/apiErrors';

const initialFilters = { search: '', category: '', month: '', date_from: '', date_to: '', ordering: '-date' };

function csvCell(value) {
  const text = String(value ?? '');
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export default function Expenses() {
  const [data, setData] = useState({ results: [], count: 0 });
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [reload, setReload] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let current = true;
    api.get('/categories/')
      .then((response) => { if (current) setCategories(response.data); })
      .catch((requestError) => {
        if (current) setCategoryError(getApiErrorMessage(requestError, 'Could not load categories for filtering.'));
      });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    const params = {
      page,
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
    };
    api.get('/expenses/', { params })
      .then((response) => { if (current) setData(response.data); })
      .catch((requestError) => {
        if (current) setError(getApiErrorMessage(requestError, 'Could not load your expenses.'));
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [filters, page, reload]);

  const changeFilter = (key) => (event) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: event.target.value }));
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this expense? This action cannot be undone.')) return;
    setDeletingId(id);
    setActionError('');
    setActionSuccess('');
    try {
      await api.delete(`/expenses/${id}/`);
      setActionSuccess('Expense deleted.');
      setReload((value) => value + 1);
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, 'Could not delete this expense.'));
    } finally {
      setDeletingId(null);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    setActionError('');
    setActionSuccess('');
    try {
      const exportFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const firstPage = await api.get('/expenses/', { params: { ...exportFilters, page: 1 } });
      const rows = [...firstPage.data.results];
      const pageCount = Math.ceil(firstPage.data.count / Math.max(firstPage.data.results.length, 1));
      for (let currentPage = 2; currentPage <= pageCount; currentPage += 1) {
        const response = await api.get('/expenses/', { params: { ...exportFilters, page: currentPage } });
        rows.push(...response.data.results);
      }

      const lines = [
        ['Date', 'Title', 'Category', 'Amount', 'Notes'],
        ...rows.map((expense) => [
          expense.date,
          expense.title,
          expense.category_name,
          expense.amount,
          expense.notes,
        ]),
      ];
      const csv = `\uFEFF${lines.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'expenses.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setActionSuccess(`${rows.length} ${rows.length === 1 ? 'expense' : 'expenses'} exported.`);
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, 'Could not export your expenses.'));
    } finally {
      setExporting(false);
    }
  };

  const pageCount = Math.max(1, Math.ceil(data.count / 10));
  const hasFilters = Object.entries(filters).some(([key, value]) => key !== 'ordering' && value);

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">YOUR TRANSACTIONS</p>
          <h1>Expenses</h1>
          <p className="muted">Search, sort and review your spending.</p>
        </div>
        <div className="heading-actions">
          <button className="btn btn-secondary" onClick={exportCsv} disabled={exporting}>
            {exporting ? 'Preparing CSV…' : '↓ Export CSV'}
          </button>
          <Link to="/expenses/new" className="btn">＋ Add expense</Link>
        </div>
      </header>

      {actionError && <div className="alert alert-error" role="alert">{actionError}</div>}
      {(actionSuccess || location.state?.message) && (
        <div className="alert alert-success" role="status">{actionSuccess || location.state.message}</div>
      )}
      {categoryError && <div className="alert alert-error" role="alert">{categoryError}</div>}
      <section className="card filter-panel" aria-label="Filter expenses">
        <div className="filter-grid">
          <label className="filter-search">
            <span>Search expenses</span>
            <input placeholder="Search by title…" value={filters.search} onChange={changeFilter('search')} />
          </label>
          <label>
            <span>Category</span>
            <select value={filters.category} onChange={changeFilter('category')}>
              <option value="">All categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label>
            <span>Month</span>
            <input type="month" aria-label="Filter by month" value={filters.month} onChange={changeFilter('month')} />
          </label>
          <label>
            <span>From date</span>
            <input type="date" aria-label="Filter from date" value={filters.date_from} onChange={changeFilter('date_from')} />
          </label>
          <label>
            <span>To date</span>
            <input type="date" aria-label="Filter to date" value={filters.date_to} onChange={changeFilter('date_to')} />
          </label>
          <label>
            <span>Sort by</span>
            <select value={filters.ordering} onChange={changeFilter('ordering')}>
              <option value="-date">Newest first</option>
              <option value="date">Oldest first</option>
              <option value="-amount">Amount: high to low</option>
              <option value="amount">Amount: low to high</option>
            </select>
          </label>
        </div>
        <div className="filter-footer">
          <span className="muted">{data.count} {data.count === 1 ? 'expense' : 'expenses'}</span>
          {hasFilters && <button className="text-button" onClick={() => { setFilters(initialFilters); setPage(1); }}>Clear filters</button>}
        </div>
      </section>

      <section className="card table-panel">
        {loading ? <div className="loader">Loading expenses…</div> : error ? (
          <div className="error-state">
            <p>{error}</p>
            <button className="btn btn-secondary" onClick={() => setReload((value) => value + 1)}>Try again</button>
          </div>
        ) : data.results.length === 0 ? (
          <div className="empty-state">
            <span aria-hidden="true">◌</span>
            <h2>{hasFilters ? 'No matching expenses' : 'Nothing to show yet'}</h2>
            <p>{hasFilters ? 'Try changing your search or filters.' : 'Add your first expense to get started.'}</p>
            {hasFilters
              ? <button className="btn btn-secondary" onClick={() => { setFilters(initialFilters); setPage(1); }}>Clear filters</button>
              : <Link to="/expenses/new" className="btn">Add an expense</Link>}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Date</th><th>Expense</th><th>Category</th><th>Amount</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.results.map((expense) => (
                  <tr key={expense.id}>
                    <td className="date-cell">{expense.date}</td>
                    <td><strong>{expense.title}</strong>{expense.notes && <small className="table-note">{expense.notes}</small>}</td>
                    <td><span className="badge">{expense.category_name}</span></td>
                    <td className="amount">{`₹${Number(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}</td>
                    <td className="table-actions">
                      <Link className="btn btn-small btn-secondary" to={`/expenses/${expense.id}/edit`}>Edit</Link>
                      <button className="btn btn-small btn-danger" onClick={() => remove(expense.id)} disabled={deletingId === expense.id}>
                        {deletingId === expense.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!loading && !error && data.count > 0 && (
        <nav className="pagination" aria-label="Expense pages">
          <span className="muted">Page {page} of {pageCount}</span>
          <div className="pagination-actions">
            <button className="btn btn-secondary btn-small" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>← Previous</button>
            <button className="btn btn-secondary btn-small" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Next →</button>
          </div>
        </nav>
      )}
    </div>
  );
}
