import Link from 'next/link';

export default function DashboardNotFound() {
  return (
    <div className="d-login">
      <div className="d-login-card">
        <h1>That page is not here</h1>
        <p style={{ textAlign: 'center' }}>
          <Link className="d-btn primary" href="/admin">
            Back to the dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
