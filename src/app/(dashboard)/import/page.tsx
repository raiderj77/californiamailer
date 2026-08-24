'use client';

import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/AuthContext';
import { addProspect, getProspects, type Prospect } from '@/lib/firestore';
import { parseCSV } from '@/lib/csv';
import { contactGate, contactQueueStatuses, duplicateReasons, isCurrentProspectStatus } from '@/lib/prospectRules';
import { suppressProspectIdentity } from '@/lib/prospectSuppressionClient';
import Link from 'next/link';
import { useState } from 'react';
import { FOUNDING_CAMPAIGN } from '@/config/foundingCampaign';

type ImportRow = { row: number; data: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'>; errors: string[] };
const maxFileBytes = 1_000_000;
const maxRows = 500;
const value = (row: Record<string, string>, ...keys: string[]) => keys.map((key) => row[key]).find((item) => item !== undefined)?.trim() || '';
const numberValue = (input: string) => input && Number.isFinite(Number(input)) ? Number(input) : undefined;
const yes = (input: string) => ['yes', 'true', '1', 'y'].includes(input.trim().toLowerCase());

export default function ImportPage() {
  const { user, loading, logout } = useAuth();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  async function inspectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setRows([]); setResult(''); setError(''); setFileName(file?.name || '');
    if (!file || !user) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { setError('Select a .csv file.'); return; }
    if (file.size > maxFileBytes) { setError('The CSV exceeds the 1 MB review limit. Split it into smaller files.'); return; }
    const parsed = parseCSV(await file.text());
    if (!parsed.length) { setError('No data rows were found.'); return; }
    if (parsed.length > maxRows) { setError(`The CSV has ${parsed.length} rows; the owner review limit is ${maxRows}.`); return; }
    let existing: Prospect[];
    try { existing = await getProspects(user.uid); } catch { setError('Existing prospects could not be checked, so import is blocked.'); return; }
    const staged: Prospect[] = [...existing];
    const reviewed = parsed.map((raw, index) => {
      const rawStatus = value(raw, 'Contact Status', 'Status') || 'researching';
      const status: Prospect['status'] = isCurrentProspectStatus(rawStatus) ? rawStatus : 'researching';
      const rawQualification = value(raw, 'Qualification Status', 'Qualification').toLowerCase() || 'verify';
      const qualificationStatus: Prospect['qualificationStatus'] = ['verify', 'qualified', 'disqualified'].includes(rawQualification)
        ? rawQualification as Prospect['qualificationStatus'] : 'verify';
      const rawPriority = value(raw, 'Priority').toLowerCase() || 'medium';
      const priority: Prospect['priority'] = ['urgent', 'high', 'medium', 'low'].includes(rawPriority) ? rawPriority as Prospect['priority'] : 'medium';
      const doNotContact = yes(value(raw, 'Do Not Contact')) || rawStatus.trim().toLowerCase() === 'do_not_contact';
      const item: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'> = {
        businessName: value(raw, 'Business Name'), businessCategory: value(raw, 'Business Category'), website: value(raw, 'Website'),
        contactName: value(raw, 'Contact Name'), contactRole: value(raw, 'Contact Role'), email: value(raw, 'Email'), phone: value(raw, 'Phone'),
        address: value(raw, 'Address'), city: value(raw, 'City'), serviceArea: value(raw, 'Service Area'), territoryId: value(raw, 'Territory ID'),
        territoryName: value(raw, 'Territory') || 'Monterey Peninsula', mailingTerritoryFit: value(raw, 'Mailing Territory Fit'),
        currentAdvertisedOffer: value(raw, 'Current Advertised Offer'), estimatedCustomerValue: numberValue(value(raw, 'Estimated Customer Value')),
        activeAdvertisingEvidence: value(raw, 'Active Advertising Evidence'), officialSource: value(raw, 'Official Source'),
        officialSourceCheckedAt: value(raw, 'Official Source Checked At'), leadSource: value(raw, 'Lead Source'), priority,
        qualificationStatus, qualificationReason: value(raw, 'Qualification Reason'), status: doNotContact ? 'do_not_contact' : status,
        lastContactDate: value(raw, 'Last Contact Date'), nextFollowUpDate: value(raw, 'Next Follow-Up Date', 'Next Follow Up Date'),
        contactAttempts: numberValue(value(raw, 'Contact Attempts')) || 0, notes: value(raw, 'Notes'),
        campaignId: value(raw, 'Campaign ID') || FOUNDING_CAMPAIGN.id,
        offeredPlacement: 'standard', quotedPrice: numberValue(value(raw, 'Quoted Price')),
        categoryReservationStatus: 'none', paymentStatus: 'none', proofStatus: value(raw, 'Proof Status') || 'not_started',
        renewalStatus: value(raw, 'Renewal Status') || 'none', renewalDate: value(raw, 'Renewal Date'), doNotContact, userId: user.uid,
      };
      const errors: string[] = [];
      if (!item.businessName) errors.push('business name required');
      if (rawStatus && !isCurrentProspectStatus(rawStatus)) errors.push(`invalid status: ${rawStatus}`);
      if (!['verify', 'qualified', 'disqualified'].includes(rawQualification)) errors.push(`invalid qualification: ${rawQualification}`);
      if (!['urgent', 'high', 'medium', 'low'].includes(rawPriority)) errors.push(`invalid priority: ${rawPriority}`);
      const duplicates = duplicateReasons(staged, item);
      if (duplicates.length) errors.push(`duplicate ${duplicates.join('/')}`);
      if (contactQueueStatuses.has(item.status) && !contactGate(item).allowed) errors.push(`contact gate: ${contactGate(item).missing.join('/')}`);
      if (!errors.length) staged.push({ ...item, id: `staged-${index}` });
      return { row: index + 2, data: item, errors };
    });
    setRows(reviewed);
  }

  async function importValidRows() {
    if (!user) return;
    const valid = rows.filter((row) => row.errors.length === 0);
    if (!valid.length) { setError('There are no valid rows to import.'); return; }
    setBusy(true); setError(''); setResult('');
    let imported = 0;
    try {
      const idToken = await user.getIdToken();
      for (const row of valid) {
        if (row.data.doNotContact === true || row.data.status === 'do_not_contact') {
          const prospectId = await addProspect({
            ...row.data,
            status: 'poor_fit',
            doNotContact: false,
            suppressed: false,
            notes: [row.data.notes, 'Imported as a non-contactable pending record before owner-server identity-wide DNC.'].filter(Boolean).join('\n'),
          }, idToken);
          await suppressProspectIdentity(prospectId, idToken);
        } else {
          await addProspect(row.data, idToken);
        }
        imported += 1;
      }
      setResult(`${imported} reviewed prospect record(s) imported. No outreach was sent.`); setRows([]); setFileName('');
    } catch { setError(`Import stopped after ${imported} record(s). Re-open the prospect list and reconcile before retrying.`); }
    finally { setBusy(false); }
  }

  if (loading) return <Centered>Loading owner access…</Centered>;
  if (!user) return <Centered>Sign in with the owner account to import prospects.</Centered>;
  const validCount = rows.filter((row) => row.errors.length === 0).length;

  return <div className="min-h-screen bg-slate-50 md:flex"><Sidebar /><main className="min-w-0 flex-1 p-4 md:p-8">
    <header className="mb-7 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">Owner workspace</p><h1 className="text-3xl font-black">Review-first prospect import</h1></div><button onClick={logout} className="rounded-lg border px-3 py-2 text-sm">Sign out</button></header>
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">Import is for individually researched businesses, not purchased or scraped lists. Every row is checked for duplicates and qualification-gate errors before it can be saved. Import never sends a message.</div>
    {error && <div className="mb-4 rounded-lg bg-rose-100 p-3 text-sm text-rose-900">{error}</div>}{result && <div className="mb-4 rounded-lg bg-emerald-100 p-3 text-sm text-emerald-900">{result}</div>}
    <section className="rounded-xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-black">1. Use the controlled template</h2><p className="mt-2 text-sm text-slate-600">Unknown values should remain blank or VERIFY. Do not guess decision makers or contact details.</p><Link href="/templates/californiamailer-prospects.csv" className="mt-4 inline-flex rounded-lg border px-4 py-2 text-sm font-bold text-blue-700 underline">Download clean CSV template</Link>
      <h2 className="mt-8 text-xl font-black">2. Select and inspect</h2><input aria-label="Prospect CSV" type="file" accept=".csv,text/csv" onChange={(event) => void inspectFile(event)} className="mt-4 block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-blue-100 file:px-4 file:py-2 file:font-bold file:text-blue-800" />{fileName && <p className="mt-2 text-sm text-slate-500">Selected: {fileName}</p>}
    </section>
    {rows.length > 0 && <section className="mt-6 overflow-hidden rounded-xl border bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="text-xl font-black">3. Review every exception</h2><p className="text-sm text-slate-500">{validCount} valid · {rows.length - validCount} blocked · {rows.length} total</p></div><button disabled={busy || validCount === 0} onClick={() => void importValidRows()} className="rounded-lg bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-40">{busy ? 'Importing…' : `Import ${validCount} valid row(s)`}</button></div><div className="max-h-[520px] overflow-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="p-3">CSV row</th><th className="p-3">Business</th><th className="p-3">Category</th><th className="p-3">Qualification</th><th className="p-3">Status</th><th className="p-3">Review result</th></tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.row} className={row.errors.length ? 'bg-rose-50' : ''}><td className="p-3">{row.row}</td><td className="p-3 font-bold">{row.data.businessName || 'Missing'}</td><td className="p-3">{row.data.businessCategory || 'Unverified'}</td><td className="p-3">{row.data.qualificationStatus}</td><td className="p-3">{row.data.status}</td><td className={`p-3 ${row.errors.length ? 'font-bold text-rose-800' : 'text-emerald-800'}`}>{row.errors.length ? row.errors.join('; ') : 'Ready to import'}</td></tr>)}</tbody></table></div></section>}
  </main></div>;
}

function Centered({ children }: { children: React.ReactNode }) { return <div className="flex min-h-screen items-center justify-center p-8 text-center text-slate-600">{children}</div>; }
