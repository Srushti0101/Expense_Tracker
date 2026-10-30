import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <nav className="navbar">
      <Link className="brand" to="/">
        <span className="expenseflow-logo" aria-hidden="true">
          <svg viewBox="0 0 28 28" fill="none">
            <path d="M6.5 7.5h13a3 3 0 0 1 3 3v1.2h-4a4.3 4.3 0 0 0 0 8.6h4v1.2a3 3 0 0 1-3 3h-13a3 3 0 0 1-3-3v-11a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M22.5 12h-4a4 4 0 0 0 0 8h4v-8Z" fill="rgba(255,255,255,.16)" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <circle cx="18.5" cy="16" r="1" fill="currentColor" />
            <path d="M7.5 11h7M7.5 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".8" />
          </svg>
        </span>
        <span>ExpenseFlow</span>
      </Link>
      <div className="links">
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/expenses">Expenses</NavLink>
        <NavLink to="/categories">Categories</NavLink>
      </div>
      <div className="user">
        <span className="user-name"><span className="user-avatar" aria-hidden="true">{user.username.charAt(0).toUpperCase()}</span>{user.username}</span>
        <button className="btn btn-secondary btn-small" onClick={() => { logout(); navigate('/login', { replace: true }); }}>Log out</button>
      </div>
    </nav>
  );
}