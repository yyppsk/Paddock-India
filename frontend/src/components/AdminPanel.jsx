import { CheckCircle2, Database, History, LogOut, PlayCircle, Plus, Save, Shield, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiRequest, navigate } from '../api.js';

const roleOptions = [
  { value: 'user', label: 'Member' },
  { value: 'content_manager', label: 'Content Manager' },
  { value: 'super_admin', label: 'Super Admin' },
];

export function AdminPanel() {
  const [user, setUser] = useState(null);
  const [sections, setSections] = useState([]);
  const [users, setUsers] = useState([]);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [migrationRunning, setMigrationRunning] = useState(false);
  const [status, setStatus] = useState('Loading admin panel...');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    async function loadAdmin() {
      try {
        const session = await apiRequest('/api/auth/session');

        if (!session.user) {
          navigate('/admin/login');
          return;
        }

        if (!session.user.isAdmin) {
          setUser(session.user);
          setStatus('');
          setError('Your account does not have admin access.');
          return;
        }

        const [content, userList, migrations] = await Promise.all([
          apiRequest('/api/admin/content'),
          session.user.isSuperAdmin ? apiRequest('/api/admin/users') : Promise.resolve({ users: [] }),
          session.user.isSuperAdmin ? apiRequest('/api/admin/system/migrations') : Promise.resolve(null),
        ]);

        if (!alive) return;
        setUser(session.user);
        setSections(content.sections);
        setUsers(userList.users);
        setMigrationStatus(migrations);
        setStatus('');
      } catch (requestError) {
        if (!alive) return;
        setStatus('');
        setError(readableError(requestError));
      }
    }

    loadAdmin();
    return () => {
      alive = false;
    };
  }, []);

  function updateSection(id, patch) {
    setSections((current) => current.map((section) => (section.id === id ? { ...section, ...patch } : section)));
  }

  async function saveSection(section) {
    setStatus(`Saving ${section.navLabel || section.title}...`);
    setError('');

    try {
      const result = await apiRequest(`/api/admin/content/${section.id}`, {
        method: 'PATCH',
        csrf: true,
        body: section,
      });
      updateSection(section.id, result.section);
      setStatus('Saved.');
    } catch (requestError) {
      setError(readableError(requestError));
      setStatus('');
    }
  }

  async function createSection() {
    setStatus('Creating section...');
    setError('');

    try {
      const nextOrder = Math.max(0, ...sections.map((section) => Number(section.sortOrder || 0))) + 10;
      const slug = `custom-${Date.now()}`;
      const result = await apiRequest('/api/admin/content', {
        method: 'POST',
        csrf: true,
        body: {
          slug,
          panelKey: slug,
          navLabel: 'New',
          navDetail: 'Draft',
          eyebrow: 'Draft',
          title: 'New Section',
          body: 'Add copy for this section.',
          sortOrder: nextOrder,
          progress: 0.5,
          isNavItem: true,
          isPublished: false,
          settings: { tone: 'quiet', links: [] },
        },
      });
      setSections((current) => [...current, result.section].sort((left, right) => left.sortOrder - right.sortOrder));
      setStatus('Draft created.');
    } catch (requestError) {
      setError(readableError(requestError));
      setStatus('');
    }
  }

  async function changeRole(targetUser, role) {
    setStatus(`Updating ${targetUser.email}...`);
    setError('');

    try {
      const result = await apiRequest(`/api/admin/users/${targetUser.id}/role`, {
        method: 'PATCH',
        csrf: true,
        body: { role },
      });
      setUsers((current) => current.map((entry) => (entry.id === targetUser.id ? result.user : entry)));
      setStatus('Role updated.');
    } catch (requestError) {
      setError(readableError(requestError));
      setStatus('');
    }
  }

  async function runMigrationsFromAdmin() {
    setMigrationRunning(true);
    setStatus('Running migrations...');
    setError('');

    try {
      const result = await apiRequest('/api/admin/system/migrations/run', {
        method: 'POST',
        csrf: true,
      });
      setMigrationStatus(result);
      setStatus(result.applied?.length ? `Applied ${result.applied.length} migration${result.applied.length === 1 ? '' : 's'}.` : 'Migrations are up to date.');
    } catch (requestError) {
      setError(readableError(requestError));
      setStatus('');
    } finally {
      setMigrationRunning(false);
    }
  }

  async function logout() {
    await apiRequest('/api/auth/logout', { method: 'POST', csrf: true }).catch(() => null);
    navigate('/');
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <button className="auth-back" type="button" onClick={() => navigate('/')}>
          Track
        </button>
        <div>
          <p className="eyebrow">Super Admin</p>
          <h1>Content Panel</h1>
        </div>
        {user ? (
          <button className="admin-logout" type="button" onClick={logout}>
            <LogOut aria-hidden="true" />
            Logout
          </button>
        ) : null}
      </header>

      {status ? <p className="admin-status">{status}</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}

      {user?.isAdmin ? (
        <section className="admin-grid">
          <div className="admin-card admin-card--wide">
            <div className="admin-card__header">
              <div>
                <p className="eyebrow">Public Track Story</p>
                <h2>Navigation Sections</h2>
              </div>
              <button type="button" onClick={createSection}>
                <Plus aria-hidden="true" />
                Section
              </button>
            </div>

            <div className="content-editor-list">
              {sections.map((section) => (
                <ContentEditor
                  key={section.id}
                  section={section}
                  onChange={(patch) => updateSection(section.id, patch)}
                  onSave={() => saveSection(section)}
                />
              ))}
            </div>
          </div>

          {user.isSuperAdmin ? (
            <div className="admin-side-stack">
              <div className="admin-card">
                <div className="admin-card__header">
                  <div>
                    <p className="eyebrow">Access</p>
                    <h2>Roles</h2>
                  </div>
                  <Users aria-hidden="true" />
                </div>
                <div className="user-role-list">
                  {users.map((entry) => (
                    <article key={entry.id} className="user-role-row">
                      <div>
                        <strong>{entry.email}</strong>
                        <span>{entry.displayName || 'No name set'}</span>
                      </div>
                      <select value={entry.role} onChange={(event) => changeRole(entry, event.target.value)}>
                        {roleOptions.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </article>
                  ))}
                </div>
              </div>
              <SystemSettings migrations={migrationStatus} onRunMigrations={runMigrationsFromAdmin} running={migrationRunning} />
            </div>
          ) : (
            <div className="admin-card">
              <Shield aria-hidden="true" />
              <h2>Content Manager</h2>
              <p>You can edit public sections. User role management is reserved for super admins.</p>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}

function SystemSettings({ migrations, onRunMigrations, running }) {
  const appliedHistory = migrations?.appliedHistory || [];
  const pendingCount = Number(migrations?.pendingCount || 0);
  const total = Number(migrations?.total || 0);

  return (
    <div className="admin-card system-settings-card">
      <div className="admin-card__header">
        <div>
          <p className="eyebrow">System Settings</p>
          <h2>Migrations</h2>
        </div>
        <Database aria-hidden="true" />
      </div>

      <div className="migration-summary">
        <div>
          <span>Applied</span>
          <strong>{migrations ? `${migrations.appliedCount}/${total}` : '--'}</strong>
        </div>
        <div>
          <span>Pending</span>
          <strong>{migrations ? pendingCount : '--'}</strong>
        </div>
      </div>

      <button type="button" disabled={!migrations || pendingCount === 0 || running} onClick={onRunMigrations}>
        <PlayCircle aria-hidden="true" />
        {running ? 'Running' : pendingCount ? 'Run Pending' : 'Up To Date'}
      </button>

      <div className="migration-history">
        <div className="migration-history__header">
          <History aria-hidden="true" />
          <strong>Applied History</strong>
        </div>

        {appliedHistory.length ? (
          <ol>
            {appliedHistory.map((migration) => (
              <li key={migration.version}>
                <CheckCircle2 aria-hidden="true" />
                <span>{migration.version}</span>
                <time dateTime={migration.appliedAt || undefined}>{formatDateTime(migration.appliedAt)}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p>{migrations ? 'No migrations have been applied yet.' : 'Loading migration history...'}</p>
        )}
      </div>
    </div>
  );
}

function ContentEditor({ section, onChange, onSave }) {
  const [linksText, setLinksText] = useState(() => JSON.stringify(section.settings?.links || [], null, 2));
  const [linksError, setLinksError] = useState('');

  useEffect(() => {
    setLinksText(JSON.stringify(section.settings?.links || [], null, 2));
    setLinksError('');
  }, [section.id, section.settings?.links]);

  function updateLinks(value) {
    setLinksText(value);

    try {
      const links = JSON.parse(value || '[]');
      if (!Array.isArray(links)) throw new Error('Links must be an array.');
      setLinksError('');
      onChange({ settings: { ...(section.settings || {}), links } });
    } catch {
      setLinksError('Links must be valid JSON.');
    }
  }

  return (
    <article className="content-editor">
      <div className="content-editor__top">
        <strong>{section.navLabel}</strong>
        <span>{Math.round(Number(section.progress || 0) * 100)}%</span>
      </div>

      <div className="content-editor__fields">
        <label>
          <span>Nav Label</span>
          <input value={section.navLabel} onChange={(event) => onChange({ navLabel: event.target.value })} />
        </label>
        <label>
          <span>Detail</span>
          <input value={section.navDetail} onChange={(event) => onChange({ navDetail: event.target.value })} />
        </label>
        <label>
          <span>Eyebrow</span>
          <input value={section.eyebrow} onChange={(event) => onChange({ eyebrow: event.target.value })} />
        </label>
        <label>
          <span>Title</span>
          <input value={section.title} onChange={(event) => onChange({ title: event.target.value })} />
        </label>
        <label className="content-editor__wide">
          <span>Body</span>
          <textarea rows={3} value={section.body} onChange={(event) => onChange({ body: event.target.value })} />
        </label>
        <label className="content-editor__wide">
          <span>Links JSON</span>
          <textarea rows={4} value={linksText} onChange={(event) => updateLinks(event.target.value)} />
          {linksError ? <small>{linksError}</small> : null}
        </label>
        <label>
          <span>Progress</span>
          <input
            max="1"
            min="0"
            step="0.01"
            type="number"
            value={section.progress}
            onChange={(event) => onChange({ progress: Number(event.target.value) })}
          />
        </label>
        <label>
          <span>Order</span>
          <input
            min="0"
            step="1"
            type="number"
            value={section.sortOrder}
            onChange={(event) => onChange({ sortOrder: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="content-editor__actions">
        <label>
          <input
            checked={section.isNavItem}
            type="checkbox"
            onChange={(event) => onChange({ isNavItem: event.target.checked })}
          />
          Nav item
        </label>
        <label>
          <input
            checked={section.isPublished}
            type="checkbox"
            onChange={(event) => onChange({ isPublished: event.target.checked })}
          />
          Published
        </label>
        <button type="button" onClick={onSave}>
          <Save aria-hidden="true" />
          Save
        </button>
      </div>
    </article>
  );
}

function readableError(error) {
  const label = String(error.message || '').replace(/_/g, ' ');
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : 'Request failed.';
}

function formatDateTime(value) {
  if (!value) {
    return 'Not recorded';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not recorded';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
