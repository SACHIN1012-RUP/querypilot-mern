import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <circle cx="13" cy="5" r="3.2" fill="#7FE0E8" />
            <circle cx="6" cy="20" r="3.2" fill="#fff" />
            <circle cx="20" cy="20" r="3.2" fill="#fff" />
            <path d="M13 8 L6 17 M13 8 L20 17" stroke="#7FE0E8" strokeWidth="1.6" fill="none" />
          </svg>
          <span>QueryPilot</span>
        </div>
        <nav>
          <NavLink to="/" end>New analysis</NavLink>
          <NavLink to="/history">History</NavLink>
        </nav>
        <div className="rail-foot">
          <div className="who">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button
            className="btn ghost light"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="stage">
        <Outlet />
      </main>
    </div>
  );
}
