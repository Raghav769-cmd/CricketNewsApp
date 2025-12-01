import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Welcome to Cricbuzz-like App</h1>
      <p>Select an option below:</p>
      <ul>
        <li>
          <Link href="/matches">View Matches</Link>
        </li>
        <li>
          <Link href="/teams">View Teams</Link>
        </li>
        <li>
          <Link href="/ball-entry">Enter Ball Data (Live Scoring)</Link>
        </li>
      </ul>
    </div>
  );
}