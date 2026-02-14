import Dashboard from './Dashboard';

// All data fetching happens client-side with proper auth token.
// SSR without token would show admin-level data briefly before correcting.
export default function Home() {
  return <Dashboard />;
}
