import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import Link from 'next/link';

// Format datetime for display: "09:30"
function fmtTime(dt) {
  if (!dt) return '-';
  const d = new Date(dt);
  if (isNaN(d)) return dt;
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
}

// ── Simple PIN gate ───────────────────────────────────────────────────────────
function PinGate({ onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/check-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();

      if (data.ok) {
        onUnlock();
      } else {
        setError('Incorrect PIN. Please try again.');
        setPin('');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout title="Dashboard">
      <div className="card" style={{ maxWidth: 340, margin: '40px auto' }}>
        <p className="card__title">Manager Dashboard</p>
        <p className="text-muted text-sm mb-2">Enter the dashboard PIN to continue.</p>

        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert--error">{error}</div>}

          <div className="form-group">
            <label htmlFor="pin">PIN</label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
              maxLength={20}
              required
              autoFocus
            />
          </div>

          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading && <span className="spinner" />}
            {loading ? 'Checking...' : 'Unlock Dashboard'}
          </button>
        </form>
      </div>
    </Layout>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const today = new Date().toISOString().split('T')[0];

  const [unlocked, setUnlocked] = useState(false);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo,   setDateTo]   = useState(today);
  const [company,  setCompany]  = useState('');
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Auto-lock when user leaves the page (switches tabs, minimises, etc.)
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        setUnlocked(false);
        setData(null);
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ dateFrom, dateTo });
      if (company) params.append('company', company);

      const res  = await fetch(`/api/dashboard?${params}`);
      const json = await res.json();

      if (json.success) {
        setData(json);
        setLastRefresh(new Date().toLocaleTimeString('en-GB'));
      } else {
        setError(json.message);
      }
    } catch {
      setError('Failed to load data. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, company]);

  // Auto-refresh every 60 seconds when unlocked
  useEffect(() => {
    if (!unlocked) return;
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData, unlocked]);

  if (!unlocked) {
    return <PinGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <Layout title="Dashboard" wide>
      <div className="mb-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          ← Back to Sign In/Out
        </Link>
        <button
          className="btn btn--secondary btn--sm"
          onClick={() => { setUnlocked(false); setData(null); }}
        >
          Lock
        </button>
      </div>

      <div className="card">
        <p className="card__title">Manager Dashboard</p>

        <div className="filter-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: '0.85rem', color: '#6b7280', whiteSpace: 'nowrap' }}>From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={today}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: '0.85rem', color: '#6b7280', whiteSpace: 'nowrap' }}>To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              max={today}
              min={dateFrom}
            />
          </div>
          <input
            type="text"
            placeholder="Filter by company..."
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <button className="btn btn--secondary btn--sm" onClick={fetchData} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {lastRefresh && (
          <p className="text-sm text-muted mb-2">Last updated: {lastRefresh} (auto-refreshes every 60s)</p>
        )}
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {data && (
        <>
          <div className="stats-row">
            <div className="stat-card stat-card--active">
              <div className="stat-card__value">{data.totals.onSite}</div>
              <div className="stat-card__label">On Site</div>
            </div>
            <div className="stat-card stat-card--completed">
              <div className="stat-card__value">{data.totals.signedOut}</div>
              <div className="stat-card__label">Signed Out</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value">{data.totals.onSite + data.totals.signedOut}</div>
              <div className="stat-card__label">Total</div>
            </div>
          </div>

          {/* Active contractors */}
          <div className="card">
            <p className="card__title" style={{ color: '#15803d' }}>
              Currently On Site ({data.active.length})
            </p>

            {data.active.length === 0 ? (
              <p className="text-muted text-sm">No contractors currently on site.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Company</th>
                      <th>Signed In</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.active.map((row, i) => (
                      <tr key={i}>
                        <td>{row.id}</td>
                        <td><strong>{row.operativeName}</strong></td>
                        <td>{row.companyName}</td>
                        <td>{fmtTime(row.signInTime)}</td>
                        <td><span className="badge badge--active">Active</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Signed out */}
          <div className="card">
            <p className="card__title" style={{ color: '#6b7280' }}>
              Signed Out ({data.completed.length})
            </p>

            {data.completed.length === 0 ? (
              <p className="text-muted text-sm">No sign-outs recorded yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Company</th>
                      <th>In</th>
                      <th>Out</th>
                      <th>Duration</th>
                      <th>Work Completed</th>
                      <th>Photo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.completed.map((row, i) => (
                      <tr key={i}>
                        <td>{row.id}</td>
                        <td><strong>{row.operativeName}</strong></td>
                        <td>{row.companyName}</td>
                        <td>{fmtTime(row.signInTime)}</td>
                        <td>{fmtTime(row.signOutTime)}</td>
                        <td>{row.duration}</td>
                        <td style={{ maxWidth: 220, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {row.notes || <span className="text-muted">—</span>}
                        </td>
                        <td>
                          {row.photoUrl ? (
                            <a href={row.photoUrl} target="_blank" rel="noreferrer"
                               style={{ color: '#1e40af', fontSize: '0.85rem' }}>
                              View
                            </a>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {loading && !data && (
        <div className="card text-center">
          <p className="text-muted">Loading dashboard...</p>
        </div>
      )}
    </Layout>
  );
}
