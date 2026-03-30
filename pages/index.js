import { useState } from 'react';
import Layout from '../components/Layout';
import SignInForm from '../components/SignInForm';
import SignOutForm from '../components/SignOutForm';
import Link from 'next/link';

export default function Home() {
  const [tab, setTab] = useState('signin'); // 'signin' | 'signout'

  return (
    <Layout>
      {/* Tab switcher */}
      <div className="nav-tabs">
        <button
          className={`nav-tab ${tab === 'signin' ? 'nav-tab--active' : ''}`}
          onClick={() => setTab('signin')}
        >
          Sign In
        </button>
        <button
          className={`nav-tab ${tab === 'signout' ? 'nav-tab--active' : ''}`}
          onClick={() => setTab('signout')}
        >
          Sign Out
        </button>
      </div>

      {tab === 'signin' ? <SignInForm /> : <SignOutForm />}

      <div className="text-center mt-4" style={{ padding: '8px 0 24px' }}>
        <Link href="/dashboard" style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', textDecoration: 'none' }}>
          Manager Dashboard →
        </Link>
      </div>
    </Layout>
  );
}
