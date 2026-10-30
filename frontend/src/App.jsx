import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import GuestRoute from './components/GuestRoute';
import ProtectedRoute from './components/ProtectedRoute';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Expenses = lazy(() => import('./pages/Expenses'));
const ExpenseFormPage = lazy(() => import('./pages/ExpenseFormPage'));
const Categories = lazy(() => import('./pages/Categories'));

const P = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <main className="container">
          <Suspense fallback={<div className="loader">Loading...</div>}>
            <Routes>
              <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
              <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
              <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
              <Route path="/reset-password" element={<GuestRoute><ResetPassword /></GuestRoute>} />
              <Route path="/" element={<P><Dashboard /></P>} />
              <Route path="/expenses" element={<P><Expenses /></P>} />
              <Route path="/expenses/new" element={<P><ExpenseFormPage /></P>} />
              <Route path="/expenses/:id/edit" element={<P><ExpenseFormPage /></P>} />
              <Route path="/categories" element={<P><Categories /></P>} />
              <Route path="*" element={<h2>404 – Page not found</h2>} />
            </Routes>
          </Suspense>
        </main>
      </AuthProvider>
    </BrowserRouter>
  );
}