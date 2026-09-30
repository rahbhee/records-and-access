'use client';

import { useCallback, useEffect, useState } from 'react';

type Tenant = { public_id: string; name: string; email: string; api_key: string };
type PublicRecord = {
  public_id: string; title: string; category: string; content: string;
  amount_cents: number; status: string; created_at: string;
};
type AuditItem = {
  public_id: string; record_public_id: string; record_title: string;
  action: string; created_at: string;
};
type Detail =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ok'; record: PublicRecord }
  | { state: 'error'; status: number; message: string };

const STORAGE_KEY = 'active-tenant';
const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

async function api(path: string, key: string, init: RequestInit = {}) {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...(init.headers || {}) },
    cache: 'no-store',
  });
  let body: any = null;
  try { body = await res.json(); } catch { /* empty body */ }
  return { status: res.status, body };
}

export default function Page() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [records, setRecords] = useState<PublicRecord[] | null>(null);
  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail>({ state: 'idle' });
  const [confirming, setConfirming] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', category: '', content: '', amount: '' });

  const active = tenants.find((t) => t.public_id === activeId) ?? null;

  // URL <-> state: read ?record= on load and on back/forward.
  useEffect(() => {
    const read = () => setSelectedId(new URLSearchParams(window.location.search).get('record'));
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);

  // Load tenants, restore the previously selected one after refresh.
  useEffect(() => {
    (async () => {
      const res = await fetch('/api/users', { cache: 'no-store' });
      const { users } = (await res.json()) as { users: Tenant[] };
      setTenants(users);
      const saved = window.localStorage.getItem(STORAGE_KEY);
      setActiveId(users.find((u) => u.public_id === saved)?.public_id ?? users[0]?.public_id ?? null);
    })().catch(() => setListError('Could not load tenants.'));
  }, []);

  const refresh = useCallback(async (t: Tenant) => {
    setListError(null);
    const [r, a] = await Promise.all([api('/api/records', t.api_key), api('/api/audit-logs', t.api_key)]);
    if (r.status === 200) setRecords(r.body.data); else setListError(`Could not load records (${r.status}).`);
    if (a.status === 200) setAudits(a.body.data);
  }, []);

  useEffect(() => {
    if (!active) return;
    setRecords(null);
    setConfirming(false);
    refresh(active);
  }, [active, refresh]);

  useEffect(() => {
    if (!active || !selectedId) { setDetail({ state: 'idle' }); return; }
    let cancelled = false;
    setDetail({ state: 'loading' });
    setConfirming(false);
    api(`/api/records/${encodeURIComponent(selectedId)}`, active.api_key).then(({ status, body }) => {
      if (cancelled) return;
      if (status === 200) setDetail({ state: 'ok', record: body.data });
      else setDetail({ state: 'error', status, message: body?.error ?? 'Request failed' });
    });
    return () => { cancelled = true; };
  }, [active, selectedId]);

  function navigate(id: string | null) {
    window.history.pushState({}, '', id ? `?record=${encodeURIComponent(id)}` : window.location.pathname);
    setSelectedId(id);
  }

  function switchTenant(id: string) {
    window.localStorage.setItem(STORAGE_KEY, id);
    setActiveId(id); // URL is intentionally kept, so cross-tenant URL tampering can be tested.
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setFormError(null);
    const amount = form.amount.trim() === '' ? 0 : Math.round(parseFloat(form.amount) * 100);
    if (Number.isNaN(amount) || amount < 0) { setFormError('Amount must be a positive number.'); return; }
    const { status, body } = await api('/api/records', active.api_key, {
      method: 'POST',
      body: JSON.stringify({ title: form.title, category: form.category, content: form.content, amount_cents: amount }),
    });
    if (status === 201) {
      setForm({ title: '', category: '', content: '', amount: '' });
      await refresh(active);
      navigate(body.data.public_id);
    } else {
      const issues = body?.issues ? Object.values(body.issues).flat().join(' ') : '';
      setFormError(`${body?.error ?? 'Failed'} ${issues}`.trim());
    }
  }

  async function onDelete(id: string) {
    if (!active) return;
    const { status, body } = await api(`/api/records/${encodeURIComponent(id)}`, active.api_key, { method: 'DELETE' });
    setConfirming(false);
    if (status === 200) { navigate(null); await refresh(active); }
    else setDetail({ state: 'error', status, message: body?.error ?? 'Delete failed' });
  }

  return (
    <>
      <header>
        <h1>Records &amp; Access</h1>
        <div style={{ minWidth: 220 }}>
          <label htmlFor="tenant">Signed in as</label>
          <select id="tenant" value={activeId ?? ''} onChange={(e) => switchTenant(e.target.value)}>
            {tenants.map((t) => <option key={t.public_id} value={t.public_id}>{t.name} ({t.email})</option>)}
          </select>
        </div>
      </header>

      <main>
        {selectedId && (
          <section className="card" aria-live="polite">
            <div className="row"><h2>Record</h2><button className="btn ghost" onClick={() => navigate(null)}>Close</button></div>
            {detail.state === 'loading' && <p className="muted">Loading…</p>}
            {detail.state === 'error' && (
              <div className="alert" role="alert">
                <strong>{detail.status === 403 ? '403 Forbidden' : detail.status === 401 ? '401 Unauthorized' : detail.status === 404 ? '404 Not found' : `Error ${detail.status}`}</strong>
                <div>{detail.message}</div>
              </div>
            )}
            {detail.state === 'ok' && (
              <>
                <h3 style={{ margin: '0 0 4px' }}>{detail.record.title}</h3>
                <p className="muted">{detail.record.category} · {money(detail.record.amount_cents)} · {new Date(detail.record.created_at).toLocaleString()}</p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{detail.record.content}</p>
                {!confirming ? (
                  <button className="btn danger" onClick={() => setConfirming(true)}>Delete record</button>
                ) : (
                  <div className="row" role="alertdialog" aria-label="Confirm deletion">
                    <span>Delete this record permanently? An audit entry will be kept.</span>
                    <span style={{ display: 'flex', gap: 8 }}>
                      <button className="btn ghost" onClick={() => setConfirming(false)}>Cancel</button>
                      <button className="btn danger" onClick={() => onDelete(detail.record.public_id)}>Yes, delete</button>
                    </span>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        <section className="card">
          <h2>Your records</h2>
          {listError && <div className="alert" role="alert">{listError}</div>}
          {records === null && !listError && <p className="muted">Loading…</p>}
          {records && records.length === 0 && (
            <div className="empty">You have no records yet. Create your first one below.</div>
          )}
          {records && records.length > 0 && (
            <div className="list">
              {records.map((r) => (
                <button key={r.public_id} className={`item ${r.public_id === selectedId ? 'active' : ''}`} onClick={() => navigate(r.public_id)}>
                  <div className="row"><strong>{r.title}</strong><span className="muted">{money(r.amount_cents)}</span></div>
                  <div className="muted">{r.category}</div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <h2>Create record</h2>
          <form onSubmit={onCreate}>
            <div className="grid2">
              <div className="field"><label htmlFor="title">Title</label><input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} /></div>
              <div className="field"><label htmlFor="category">Category</label><input id="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required maxLength={100} /></div>
            </div>
            <div className="field"><label htmlFor="content">Content</label><textarea id="content" rows={3} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required maxLength={5000} /></div>
            <div className="field" style={{ maxWidth: 220 }}><label htmlFor="amount">Amount (USD)</label><input id="amount" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" /></div>
            {formError && <div className="alert" role="alert" style={{ marginBottom: 12 }}>{formError}</div>}
            <button className="btn" type="submit">Create record</button>
          </form>
        </section>

        <section className="card">
          <h2>Audit trail</h2>
          {audits.length === 0 ? (
            <div className="empty">No activity recorded yet.</div>
          ) : (
            <div className="scroll">
              <table>
                <thead><tr><th>When</th><th>Action</th><th>Record</th><th>Audit ID</th></tr></thead>
                <tbody>
                  {audits.map((a) => (
                    <tr key={a.public_id}>
                      <td>{a.created_at}</td><td>{a.action}</td>
                      <td>{a.record_title} <code>{a.record_public_id}</code></td><td><code>{a.public_id}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
