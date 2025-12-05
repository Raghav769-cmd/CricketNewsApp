"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@repo/ui/toast';

interface Player { id: number; name: string; team_id?: number }
interface DescriptionRow { id: number; match_id: number; player_id: number; player_name?: string; description: string; author?: string; updated_at?: string }

export default function PlayerDescriptionsPage() {
  const params = useParams() as { id?: string } | null;
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const matchId = params?.id;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const [players, setPlayers] = useState<Player[]>([]);
  const [descriptions, setDescriptions] = useState<DescriptionRow[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<number | ''>('');
  const [text, setText] = useState<string>('');
  const [author, setAuthor] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Redirect to login if not authenticated or not admin
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== 'admin')) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, user?.role, router]);

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated or not admin
  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

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
    if (!matchId) {
      toast.error('Missing match id');
      return;
    }
    if (!selectedPlayer) {
      toast.error('Select a player');
      return;
    }
    if (!text || text.trim().length === 0) {
      toast.error('Enter description');
      return;
    }
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
      toast.success('Description saved successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save description');
    } finally { 
      setLoading(false); 
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto min-h-screen bg-black">
      <h2 className="text-2xl font-semibold mb-4 text-white">Player Performance Notes</h2>

      <form onSubmit={handleSave} className="space-y-4 bg-slate-900 p-4 rounded shadow border border-slate-800">
        <div>
          <label className="block text-sm font-medium text-gray-300">Player</label>
          <select className="mt-1 p-2 w-full border border-slate-700 rounded bg-slate-800 text-white focus:ring-2 focus:ring-lime-500" value={selectedPlayer} onChange={(e) => setSelectedPlayer(Number(e.target.value) || '')}>
            <option value="">Select player</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Author (optional)</label>
          <input className="mt-1 w-full p-2 border border-slate-700 rounded bg-slate-800 text-white focus:ring-2 focus:ring-lime-500" value={author} onChange={(e) => setAuthor(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Description</label>
          <textarea rows={5} className="mt-1 w-full p-2 border border-slate-700 rounded bg-slate-800 text-white focus:ring-2 focus:ring-lime-500" value={text} onChange={(e) => setText(e.target.value)} />
        </div>

        <div className="flex gap-2">
          <button className="px-4 py-2 bg-linear-to-r from-lime-500 to-lime-600 text-black rounded font-semibold hover:from-lime-600 hover:to-lime-700" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
          <button type="button" className="px-4 py-2 border border-slate-700 text-gray-300 rounded hover:bg-slate-800" onClick={() => { setSelectedPlayer(''); setText(''); setAuthor(''); }}>Clear</button>
        </div>
      </form>

      <div className="mt-6">
        <h3 className="text-lg font-medium mb-2 text-white">Saved notes</h3>
        {descriptions.length === 0 && <p className="text-sm text-gray-400">No notes yet for this match.</p>}
        <ul className="space-y-4">
          {descriptions.map(d => (
            <li key={d.id} className="p-3 bg-slate-900 rounded shadow border border-slate-800">
              <div className="flex justify-between items-baseline">
                <div className="font-medium text-white">{d.player_name ?? `Player ${d.player_id}`}</div>
                <div className="text-xs text-gray-500">{d.updated_at ? new Date(d.updated_at).toLocaleString() : ''}</div>
              </div>
              <div className="text-sm text-gray-300 mt-2 whitespace-pre-wrap">{d.description}</div>
              {d.author && <div className="text-xs text-gray-500 mt-2">— {d.author}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
