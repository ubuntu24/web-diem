import Dashboard from './Dashboard';
import { getClassesAction, getOnlineCountAction, getStudentCountAction } from './actions';

// This is a Server Component (default in App Router)
// Prevent caching to ensure fresh data (especially for user role/token check)
export const dynamic = 'force-dynamic';

export default async function Home() {
  // Fetch initial data on the server
  // Note: These calls happen on the server side, calling your FastAPI backend.
  // The results are passed as props to the Client Component (Dashboard).
  // The user only sees the final HTML, no direct API calls to /api/class/alist.

  let initialClasses: string[] = [];
  let initialOnlineUsers = 1;
  let initialStudentCount = 0;

  try {
    // We can run these in parallel
    const [classes, onlineCount, studentCount] = await Promise.all([
      getClassesAction(),
      getOnlineCountAction(),
      getStudentCountAction()
    ]);

    initialClasses = classes;
    initialOnlineUsers = onlineCount;
    initialStudentCount = studentCount;
  } catch (error) {
    console.error("SSR Data Fetch Error:", error);
  }

  return (
    <Dashboard
      initialClasses={initialClasses}
      initialStudentCount={initialStudentCount}
      initialOnlineUsers={initialOnlineUsers}
    />
  );
}
