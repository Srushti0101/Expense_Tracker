import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import api from '../api/axios';
import { getApiErrorMessage } from '../utils/apiErrors';
import { getLocalDateString } from '../utils/dates';

const COLORS = ['#174a9c', '#326fba', '#4e87d1', '#6a9bdd', '#24548e', '#789fcf', '#3c659a'];
const currency = (value) => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function Dashboard() {
  const [month, setMonth] = useState(getLocalDateString().slice(0, 7));
  const [data, setData] = useState(null);
  const [budgetLimit, setBudgetLimit] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingBudget, setSavingBudget] = useState(false);
  const [error, setError] = useState('');
  const [budgetError, setBudgetError] = useState('');
  const [success, setSuccess] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    api.get('/dashboard/summary/', { params: { month } })
      .then((response) => {
        if (!current) return;
        setData(response.data);
        setBudgetLimit(response.data.budget?.limit_amount || '');
      })
      .catch((requestError) => {
        if (current) setError(getApiErrorMessage(requestError, 'Could not load your dashboard.'));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, [month, reload]);

  const saveBudget = async (event) => {
    event.preventDefault();
    setSavingBudget(true);
    setBudgetError('');
    setSuccess('');
    const payload = { month: `${month}-01`, limit_amount: budgetLimit };
    try {
      if (data?.budget) await api.patch(`/budgets/${data.budget.id}/`, payload);
      else await api.post('/budgets/', payload);
      setSuccess('Monthly budget saved.');
      setReload((value) => value + 1);
    } catch (requestError) {
      setBudgetError(getApiErrorMessage(requestError, 'Could not save your budget.'));
    } finally {
      setSavingBudget(false);
    }
  };

  if (loading && !data) return <div className="loader">Loading your spending overview…</div>;
  if (error && !data) {
    return (
      <section className="card error-state">
        <h2>We couldn’t load your dashboard</h2>
        <p>{error}</p>
        <button className="btn" onClick={() => setReload((value) => value + 1)}>Try again</button>
      </section>
    );
  }
  if (!data) return null;

  const chart = data.by_category.map((item) => ({ name: item.category, value: Number(item.total) }));
  const spent = Number(data.total);
  const limit = Number(data.budget?.limit_amount || 0);
  const budgetPercent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const overBudget = limit > 0 && spent > limit;

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">YOUR MONEY, AT A GLANCE</p>
          <h1>Dashboard</h1>
          <p className="muted">A clear view of where your money is going.</p>
        </div>
        <label className="month-picker">
          <span>Viewing month</span>
          <input aria-label="Dashboard month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </header>

      {loading && <p className="inline-loading">Updating your overview…</p>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {success && <div className="alert alert-success" role="status">{success}</div>}
      {overBudget && (
        <div className="alert alert-warning" role="status">
          You’re over this month’s budget by {currency(spent - limit)}.
        </div>
      )}

      <section className="grid summary-grid" aria-label="Monthly spending summary">
        <article className="card summary-card summary-primary">
          <span className="summary-icon" aria-hidden="true">↗</span>
          <span className="summary-label">Total spent</span>
          <strong>{currency(data.total)}</strong>
          <small>{new Date(`${month}-02T12:00:00`).toLocaleDateString('en', { month: 'long', year: 'numeric' })}</small>
        </article>
        <article className="card summary-card">
          <span className="summary-icon icon-lavender" aria-hidden="true">◈</span>
          <span className="summary-label">Categories used</span>
          <strong>{data.by_category.length}</strong>
          <small>In the selected month</small>
        </article>
        <article className="card summary-card">
          <span className="summary-icon icon-green" aria-hidden="true">✦</span>
          <span className="summary-label">Top category</span>
          <strong className="summary-category">{data.by_category[0]?.category || '—'}</strong>
          <small>{data.by_category[0] ? currency(data.by_category[0].total) : 'No spending yet'}</small>
        </article>
      </section>

      <section className="grid dashboard-grid">
        <article className="card panel">
          <div className="panel-heading">
            <div><p className="eyebrow">BREAKDOWN</p><h2>Spending by category</h2></div>
          </div>
          {chart.length === 0 ? (
            <div className="empty-state compact-empty"><span aria-hidden="true">◌</span><p>No expenses recorded for this month.</p></div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={chart} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>
                    {chart.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => currency(value)} />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
              <div className="category-breakdown">
                {data.by_category.map((item, index) => (
                  <div className="breakdown-row" key={item.category}>
                    <span className="breakdown-name"><i style={{ '--category-color': COLORS[index % COLORS.length] }} />{item.category}</span>
                    <strong>{currency(item.total)}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </article>

        <article className="card panel">
          <div className="panel-heading">
            <div><p className="eyebrow">KEEP ON TRACK</p><h2>Monthly budget</h2></div>
            <span className="panel-icon" aria-hidden="true">◎</span>
          </div>
          <p className="muted">Set a spending limit for the selected month.</p>
          {budgetError && <div className="alert alert-error" role="alert">{budgetError}</div>}
          <form className="budget-form" onSubmit={saveBudget}>
            <label htmlFor="budget-limit">Budget limit (₹)</label>
            <div className="budget-input-row">
              <input
                id="budget-limit"
                aria-label="Monthly budget amount"
                type="number"
                min="0.01"
                max="9999999999.99"
                step="0.01"
                value={budgetLimit}
                onChange={(event) => setBudgetLimit(event.target.value)}
                placeholder="e.g. 25000"
                required
              />
              <button className="btn" disabled={savingBudget}>{savingBudget ? 'Saving…' : data.budget ? 'Update' : 'Set budget'}</button>
            </div>
          </form>
          {data.budget ? (
            <div className="budget-progress">
              <div className="budget-numbers"><span>{currency(spent)} spent</span><span>of {currency(limit)}</span></div>
              <div className="progress-track" role="progressbar" aria-label="Monthly budget used" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(budgetPercent)}>
                <span className={overBudget ? 'progress-fill progress-over' : 'progress-fill'} style={{ width: `${budgetPercent}%` }} />
              </div>
              <p className={overBudget ? 'budget-note budget-over' : 'budget-note'}>
                {overBudget ? `${currency(spent - limit)} over budget` : `${currency(limit - spent)} remaining`}
              </p>
            </div>
          ) : (
            <p className="budget-note">No budget set for this month yet.</p>
          )}
        </article>
      </section>

      <section className="card panel recent-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">LATEST ACTIVITY</p><h2>Recent expenses</h2></div>
          <Link className="text-link" to="/expenses">All expenses <span aria-hidden="true">→</span></Link>
        </div>
        {data.recent.length === 0 ? (
          <div className="empty-state">
            <span aria-hidden="true">✧</span>
            <h3>Your spending story starts here</h3>
            <p>Add your first expense to see a useful breakdown.</p>
            <Link className="btn" to="/expenses/new">Add an expense</Link>
          </div>
        ) : (
          <div className="recent-list">
            {data.recent.map((expense) => (
              <Link className="recent-item" key={expense.id} to={`/expenses/${expense.id}/edit`}>
                <span className="expense-avatar" aria-hidden="true">{expense.category_name?.charAt(0)?.toUpperCase() || 'E'}</span>
                <span className="recent-description">
                  <strong>{expense.title}</strong>
                  <small>{expense.category_name} <span aria-hidden="true">·</span> {expense.date}</small>
                </span>
                <strong className="recent-amount">{currency(expense.amount)}</strong>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
