"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Player { id: number; name: string; team_id?: number }
interface DescriptionRow { id: number; match_id: number; player_id: number; player_name?: string; description: string; author?: string; updated_at?: string }

export default function PlayerDescriptionsPage() {
  const params = useParams() as { id?: string } | null;
  const matchId = params?.id;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const [players, setPlayers] = useState<Player[]>([]);
  const [descriptions, setDescriptions] = useState<DescriptionRow[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<number | ''>('');
  const [text, setText] = useState<string>('');
  const [author, setAuthor] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => { fetchPlayers(); }, []);
  useEffect(() => { if (matchId) fetchDescriptions(); }, [matchId]);

  async function fetchPlayers() {
    try {
      const res = await fetch(`${apiBase}/api/players`);
      if (!res.ok) return;
      setPlayers(await res.json());
    } catch (err) {
      console.error('fetch players failed', err);
    }
  }

  async function fetchDescriptions() {
    if (!matchId) return;
    try {
      const res = await fetch(`${apiBase}/api/matches/${matchId}/descriptions`);
      if (!res.ok) return;
      setDescriptions(await res.json());
    } catch (err) {
      console.error('fetch descriptions failed', err);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!matchId) return alert('Missing match id');
    if (!selectedPlayer) return alert('Select a player');
    if (!text || text.trim().length === 0) return alert('Enter description');
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/matches/${matchId}/players/${selectedPlayer}/description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text, author: author || null })
      });
      if (!res.ok) throw new Error('Save failed');
      await fetchDescriptions();
      setText('');
      setAuthor('');
      alert('Saved');
    } catch (err) {
      console.error(err);
      alert('Save failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Player Performance Notes</h2>

      <form onSubmit={handleSave} className="space-y-4 bg-white p-4 rounded shadow">
        <div>
          <label className="block text-sm font-medium text-gray-700">Player</label>
          <select className="mt-1 p-2 w-full border rounded" value={selectedPlayer} onChange={(e) => setSelectedPlayer(Number(e.target.value) || '')}>
            <option value="">Select player</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Author (optional)</label>
          <input className="mt-1 w-full p-2 border rounded" value={author} onChange={(e) => setAuthor(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea rows={5} className="mt-1 w-full p-2 border rounded" value={text} onChange={(e) => setText(e.target.value)} />
        </div>

        <div className="flex gap-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
          <button type="button" className="px-4 py-2 border rounded" onClick={() => { setSelectedPlayer(''); setText(''); setAuthor(''); }}>Clear</button>
        </div>
      </form>

      <div className="mt-6">
        <h3 className="text-lg font-medium mb-2">Saved notes</h3>
        {descriptions.length === 0 && <p className="text-sm text-gray-600">No notes yet for this match.</p>}
        <ul className="space-y-4">
          {descriptions.map(d => (
            <li key={d.id} className="p-3 bg-white rounded shadow">
              <div className="flex justify-between items-baseline">
                <div className="font-medium">{d.player_name ?? `Player ${d.player_id}`}</div>
                <div className="text-xs text-gray-500">{d.updated_at ? new Date(d.updated_at).toLocaleString() : ''}</div>
              </div>
              <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{d.description}</div>
              {d.author && <div className="text-xs text-gray-500 mt-2">— {d.author}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
