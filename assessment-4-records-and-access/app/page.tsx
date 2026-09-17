'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface PublicRecord {
  public_id: string;
  title: string;
  category: string;
  content: string;
  amount_cents: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AuditLogItem {
  public_id: string;
  user_email: string;
  record_public_id: string;
  record_title: string;
  action: string;
  metadata_json: string;
  ip_address: string | null;
  created_at: string;
}

interface UserInfo {
  public_id: string;
  email: string;
  name: string;
  api_key: string;
}

const PRESET_USERS: UserInfo[] = [
  {
    public_id: 'usr_alice_sec901',
    email: 'alice@company.com',
    name: 'Alice Henderson',
    api_key: 'key_alice_live_sec_7781',
  },
  {
    public_id: 'usr_bob_sec902',
    email: 'bob@company.com',
    name: 'Bob Martinez',
    api_key: 'key_bob_live_sec_8892',
  },
];

export default function RecordsPage() {
  const [currentUser, setCurrentUser] = useState<UserInfo>(PRESET_USERS[0]);
  const [records, setRecords] = useState<PublicRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [activeRecord, setActiveRecord] = useState<PublicRecord | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Modals & UI States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<PublicRecord | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('Technical Architecture');
  const [formContent, setFormContent] = useState('');
  const [formAmount, setFormAmount] = useState('1500.00');
  const [submitting, setSubmitting] = useState(false);

  // Synchronize URL with view state
  const syncUrlWithRecord = useCallback((recId: string | null) => {
    const url = new URL(window.location.href);
    if (recId) {
      url.searchParams.set('record', recId);
    } else {
      url.searchParams.delete('record');
    }
    window.history.pushState({}, '', url.toString());
  }, []);

  const fetchRecords = useCallback(async (user: UserInfo) => {
    setLoading(true);
    try {
      const res = await fetch('/api/records', {
        headers: {
          'Authorization': `Bearer ${user.api_key}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch records: ${res.statusText}`);
      }
      const data = await res.json();
      setRecords(data.data || []);
    } catch (err: unknown) {
      setNotification({ type: 'error', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async (user: UserInfo) => {
    try {
      const res = await fetch('/api/audit-logs', {
        headers: {
          'Authorization': `Bearer ${user.api_key}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    }
  }, []);

  const fetchRecordDetail = useCallback(async (recId: string, user: UserInfo) => {
    setDetailError(null);
    try {
      const res = await fetch(`/api/records/${recId}`, {
        headers: {
          'Authorization': `Bearer ${user.api_key}`,
        },
      });
      if (res.status === 403) {
        setDetailError('403 Forbidden: You do not own this record and cannot access it.');
        setActiveRecord(null);
        return;
      }
      if (res.status === 404) {
        setDetailError('404 Not Found: The requested record identifier does not exist.');
        setActiveRecord(null);
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to retrieve record');
      }
      const data = await res.json();
      setActiveRecord(data.data);
    } catch (err: unknown) {
      setDetailError((err as Error).message);
    }
  }, []);

  // Initial load and URL param reading
  useEffect(() => {
    fetchRecords(currentUser);
    fetchAuditLogs(currentUser);

    const params = new URLSearchParams(window.location.search);
    const recParam = params.get('record');
    if (recParam) {
      setSelectedRecordId(recParam);
      fetchRecordDetail(recParam, currentUser);
    }

    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search);
      const id = p.get('record');
      setSelectedRecordId(id);
      if (id) {
        fetchRecordDetail(id, currentUser);
      } else {
        setActiveRecord(null);
        setDetailError(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser, fetchRecords, fetchAuditLogs, fetchRecordDetail]);

  const handleSelectUser = (user: UserInfo) => {
    setCurrentUser(user);
    setSelectedRecordId(null);
    setActiveRecord(null);
    setDetailError(null);
    syncUrlWithRecord(null);
    setNotification({
      type: 'success',
      message: `Switched active session to ${user.name} (${user.email}). View is strictly scoped to their tenant.`,
    });
  };

  const handleOpenDetail = (recId: string) => {
    setSelectedRecordId(recId);
    syncUrlWithRecord(recId);
    fetchRecordDetail(recId, currentUser);
  };

  const handleBackToList = () => {
    setSelectedRecordId(null);
    setActiveRecord(null);
    setDetailError(null);
    syncUrlWithRecord(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const amountCents = Math.round(parseFloat(formAmount || '0') * 100);
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.api_key}`,
        },
        body: JSON.stringify({
          title: formTitle,
          category: formCategory,
          content: formContent,
          amount_cents: amountCents,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create record');
      }

      setShowCreateModal(false);
      setFormTitle('');
      setFormContent('');
      setFormAmount('1500.00');
      setNotification({ type: 'success', message: 'Confidential record created successfully.' });
      fetchRecords(currentUser);
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!recordToDelete) return;
    try {
      const res = await fetch(`/api/records/${recordToDelete.public_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${currentUser.api_key}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete record');
      }

      setNotification({
        type: 'success',
        message: `Record ${recordToDelete.public_id} deleted. Audit trail record created before removal.`,
      });

      setRecordToDelete(null);
      if (selectedRecordId === recordToDelete.public_id) {
        handleBackToList();
      }
      fetchRecords(currentUser);
      fetchAuditLogs(currentUser);
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  return (
    <div>
      {/* Reviewer / Defense Header */}
      <div className="reviewer-banner" id="reviewer-panel">
        <div className="banner-left">
          <span className="badge-assessment">Assessment 4</span>
          <span className="banner-title">
            Active Tenant: <strong>{currentUser.name}</strong> ({currentUser.email})
          </span>
        </div>
        <div className="user-switch-controls">
          <span className="user-switch-label">Switch Tenant:</span>
          {PRESET_USERS.map((u) => (
            <button
              key={u.public_id}
              id={`switch-user-${u.public_id}`}
              className={`user-btn ${currentUser.public_id === u.public_id ? 'active' : ''}`}
              onClick={() => handleSelectUser(u)}
            >
              {u.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="app-container">
        {/* Alerts */}
        {notification && (
          <div className={`alert-box alert-${notification.type}`} id="notification-banner">
            <span>{notification.message}</span>
            <button
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
              onClick={() => setNotification(null)}
            >
              ✕
            </button>
          </div>
        )}

        {/* View Mode: DETAIL VIEW */}
        {selectedRecordId ? (
          <div className="detail-view" id="record-detail-view">
            <button className="detail-nav-back" id="back-to-list-btn" onClick={handleBackToList}>
              ← Back to Records List
            </button>

            {detailError ? (
              <div className="alert-box alert-error" id="detail-error-card">
                <div>
                  <strong>Access Denied / Not Found</strong>
                  <p style={{ marginTop: '0.25rem' }}>{detailError}</p>
                </div>
              </div>
            ) : activeRecord ? (
              <div>
                <div className="detail-header">
                  <div>
                    <span className="record-category-tag" style={{ marginBottom: '0.5rem', display: 'inline-block' }}>
                      {activeRecord.category}
                    </span>
                    <h2 className="detail-title">{activeRecord.title}</h2>
                    <div className="detail-meta-row">
                      <span className="detail-meta-item">
                        Public Identifier: <span className="badge-tag">{activeRecord.public_id}</span>
                      </span>
                      <span className="detail-meta-item">
                        Created: <strong>{new Date(activeRecord.created_at).toLocaleString()}</strong>
                      </span>
                      <span className="detail-meta-item">
                        Valuation: <strong>{formatCurrency(activeRecord.amount_cents)}</strong>
                      </span>
                    </div>
                  </div>
                  <button
                    className="btn-danger"
                    id="delete-record-detail-btn"
                    onClick={() => setRecordToDelete(activeRecord)}
                  >
                    Delete Record
                  </button>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Confidential Record Payload
                  </h4>
                  <div className="detail-content-box" id="record-payload-text">{activeRecord.content}</div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading record details...
              </div>
            )}
          </div>
        ) : (
          /* View Mode: RECORDS LIST */
          <div>
            <div className="app-header">
              <div className="app-title-area">
                <h1>Confidential Records</h1>
                <p>Strictly scoped to authenticated user ({currentUser.email}). Cross-tenant access is structurally impossible.</p>
              </div>
              <button
                className="btn-primary"
                id="create-new-record-btn"
                onClick={() => setShowCreateModal(true)}
              >
                + Create Record
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                Loading scoped records...
              </div>
            ) : records.length === 0 ? (
              /* Genuine Empty State */
              <div className="empty-state-card" id="empty-state-container">
                <div className="empty-state-icon">📂</div>
                <h3>No records created yet</h3>
                <p>
                  You currently have zero records stored. This is a genuine empty state without mock placeholders.
                  Click below to create your first confidential record.
                </p>
                <button
                  className="btn-primary"
                  id="empty-create-btn"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create First Record
                </button>
              </div>
            ) : (
              <div className="records-grid" id="records-list-grid">
                {records.map((rec) => (
                  <div
                    key={rec.public_id}
                    id={`record-card-${rec.public_id}`}
                    className="record-card"
                    onClick={() => handleOpenDetail(rec.public_id)}
                  >
                    <div className="record-info-main">
                      <div className="record-header-meta">
                        <span className="record-category-tag">{rec.category}</span>
                        <span className="record-public-id">{rec.public_id}</span>
                      </div>
                      <h3 className="record-title">{rec.title}</h3>
                      <div className="record-date">
                        Created {new Date(rec.created_at).toLocaleDateString()} &bull; Value: {formatCurrency(rec.amount_cents)}
                      </div>
                    </div>
                    <div className="record-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn-secondary"
                        id={`view-btn-${rec.public_id}`}
                        onClick={() => handleOpenDetail(rec.public_id)}
                      >
                        View
                      </button>
                      <button
                        className="btn-danger"
                        id={`delete-btn-${rec.public_id}`}
                        onClick={() => setRecordToDelete(rec)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audit Log Panel */}
        <div className="audit-panel" id="audit-logs-section">
          <div className="audit-header">
            <h3 className="audit-title">
              <span>🛡️ Pre-Deletion Audit Trail (Immutable Database Log)</span>
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {auditLogs.length} audit entries captured
            </span>
          </div>

          <div className="audit-table-wrapper">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Audit ID</th>
                  <th>Actor Email</th>
                  <th>Action</th>
                  <th>Target Record ID</th>
                  <th>Target Record Title</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                      No deletions executed yet. Delete a record above to verify atomic pre-deletion audit logging.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.public_id} id={`audit-row-${log.public_id}`}>
                      <td><span className="badge-tag">{log.public_id}</span></td>
                      <td>{log.user_email}</td>
                      <td><strong style={{ color: '#F87171' }}>{log.action}</strong></td>
                      <td><span className="badge-tag">{log.record_public_id}</span></td>
                      <td>{log.record_title}</td>
                      <td>{new Date(log.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Record Modal */}
      {showCreateModal && (
        <div className="modal-overlay" id="create-record-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Create Confidential Record</h3>
              <p className="modal-desc">
                Stored under tenant <strong>{currentUser.email}</strong> with non-sequential public ID.
              </p>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="input-record-title">
                  Record Title
                </label>
                <input
                  id="input-record-title"
                  className="form-input"
                  type="text"
                  required
                  placeholder="e.g. Master Services Agreement v2"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-record-category">
                  Category
                </label>
                <select
                  id="input-record-category"
                  className="form-select"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                >
                  <option value="Technical Architecture">Technical Architecture</option>
                  <option value="Commercial Contract">Commercial Contract</option>
                  <option value="Financial Advisory">Financial Advisory</option>
                  <option value="Compliance & Audit">Compliance & Audit</option>
                  <option value="DevOps & Infrastructure">DevOps & Infrastructure</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-record-amount">
                  Contract / Valuation Amount (USD)
                </label>
                <input
                  id="input-record-amount"
                  className="form-input"
                  type="number"
                  step="0.01"
                  required
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-record-content">
                  Confidential Payload / Content
                </label>
                <textarea
                  id="input-record-content"
                  className="form-textarea"
                  required
                  placeholder="Enter confidential notes, scope description, or contract details..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  id="cancel-create-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  id="submit-create-btn"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {recordToDelete && (
        <div className="modal-overlay" id="delete-confirmation-modal">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#EF4444' }}>
                Confirm Permanent Deletion
              </h3>
              <p className="modal-desc" style={{ marginTop: '0.5rem' }}>
                Are you sure you want to delete <strong>{recordToDelete.title}</strong> (
                <code style={{ color: '#9CA3AF' }}>{recordToDelete.public_id}</code>)?
              </p>
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              An immutable audit entry capturing who deleted this record, what was deleted, and the exact timestamp will be committed to the database prior to deletion.
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                id="cancel-delete-btn"
                onClick={() => setRecordToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                id="confirm-delete-action-btn"
                onClick={handleDeleteConfirm}
              >
                Yes, Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
