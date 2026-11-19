import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Button, ErrorState, Field, Skeleton, inputCls } from '../../components/ui';
import { ActionButton, Badge, PageTitle, dateOnly, dateTime, statusTone } from './shared';

interface Staff { id: string; email: string; role: string; status: string; created_at: string; last_login_at: string | null; admin_role: string | null }
interface Role { id: number; name: string; permissions: string[] }

export default function AdminAccounts() {
  const { me } = useAuth();
  const staff = useApi<Staff[]>('/admin/accounts');
  const roles = useApi<Role[]>('/admin/roles');
  const staffList: Staff[] = Array.isArray(staff.data) ? staff.data : Array.isArray((staff.data as any)?.items) ? (staff.data as any).items : [];
  const rolesList: Role[] = Array.isArray(roles.data) ? roles.data : Array.isArray((roles.data as any)?.items) ? (roles.data as any).items : [];
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [roleId, setRoleId] = useState('');
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);

  const create = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setOk('');
    if (password.length < 12) return setErr('Use a password of at least 12 characters.');
    setBusy(true);
    try { await api('/admin/accounts', { body: { email: email.trim(), password, roleId: Number(roleId || roles.data?.[0]?.id) } }); setOk(`Account created for ${email.trim()}. Share the password with them securely.`); setEmail(''); setPassword(''); staff.refetch(); }
    catch (e2) { setErr(e2 instanceof ApiError ? e2.message : 'Could not create the account.'); } finally { setBusy(false); }
  };
  const toggle = (u: Staff) => async () => { await api(`/admin/accounts/${u.id}/${u.status === 'active' ? 'suspend' : 'reinstate'}`, { method: 'POST', body: {} }); staff.refetch(); };

  if (staff.error) return <ErrorState message={staff.error} onRetry={staff.refetch} />;
  return (
    <div>
      <PageTitle title="Admin accounts" sub="Moderators review music, artists and reports. Super admins can manage everything." />
      <form onSubmit={create} className="grid gap-3 rounded-card border border-line p-4 sm:grid-cols-[1fr_1fr_170px_auto] sm:items-end">
        <Field label="Email"><input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" /></Field>
        <Field label="Temporary password" hint="At least 12 characters."><input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" /></Field>
        <Field label="Role"><select className={inputCls} value={roleId || String(rolesList[0]?.id ?? '')} onChange={(e) => setRoleId(e.target.value)}>{rolesList.map((r) => <option key={r.id} value={r.id}>{r.name.replace('_', ' ')}</option>)}</select></Field>
        <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create'}</Button>
        {err && <p role="alert" className="text-sm font-medium text-red-500 sm:col-span-4">{err}</p>}
        {ok && <p role="status" className="text-sm font-medium sm:col-span-4">{ok}</p>}
      </form>

      <div className="mt-6">
        {!staff.data ? <Skeleton className="h-40" /> : (
          <ul className="divide-y divide-line rounded-card border border-line">
            {staffList.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{u.email}{u.id === me?.id && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}</p>
                  <p className="text-xs text-muted">{(u.admin_role ?? u.role).replace('_', ' ')} · added {dateOnly(u.created_at)} · last login {dateTime(u.last_login_at)}</p></div>
                <Badge tone={statusTone(u.status)}>{u.status}</Badge>
                {u.id !== me?.id && <ActionButton variant="outline" label={u.status === 'active' ? 'Suspend' : 'Reinstate'} onClick={toggle(u)} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
