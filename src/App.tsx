import { useMemo, useState } from 'react';
import { Activity, CalendarDays, CheckSquare, ClipboardList, LayoutDashboard, MessageSquare, Phone, Search, Settings, ShieldCheck, Users } from 'lucide-react';

type Section = 'Dashboard' | 'Leads' | 'Clients' | 'Calendar' | 'Jessie Calls' | 'Tasks' | 'Communications' | 'Reports' | 'Staff' | 'Settings' | 'Audit Log';

const nav: Array<{ label: Section; icon: typeof LayoutDashboard }> = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Leads', icon: Users },
  { label: 'Clients', icon: ClipboardList },
  { label: 'Calendar', icon: CalendarDays },
  { label: 'Jessie Calls', icon: Phone },
  { label: 'Tasks', icon: CheckSquare },
  { label: 'Communications', icon: MessageSquare },
  { label: 'Reports', icon: Activity },
  { label: 'Staff', icon: Users },
  { label: 'Settings', icon: Settings },
  { label: 'Audit Log', icon: ShieldCheck },
];

const stats = [
  ['New leads today', '1'],
  ['Calls today', '4'],
  ['Appointments today', '4'],
  ['Awaiting confirmation', '3'],
  ['Open follow-ups', '6'],
  ['Overdue tasks', '1'],
  ['Intake pending', '1'],
  ['Calls needing review', '2'],
];

const leads = [
  ['Amanda Rivera', 'Individual Therapy', 'Psychology Today', 'New'],
  ['Sophia Martinez', 'Family Therapy', 'Instagram', 'Contacted'],
  ['Derrick Owens', 'Couples', 'Google', 'Attempted Contact'],
  ['Kevin Nguyen', 'Individual Therapy', 'Jessie AI', 'Appointment Scheduled'],
  ['Priya Shah', 'Intake', 'Referral', 'Intake Started'],
];

const tasks = [
  ['Call Amanda Rivera back', 'Marta Reyes', 'High'],
  ['Verify insurance for Emily Watts', 'Renee Cho', 'Normal'],
  ['Send intake packet to Priya Shah', 'Ju', 'Normal'],
  ['Review Jessie call - urgent triage', 'Dr. Alicia Ford', 'Urgent'],
];

function DataTable({ rows }: { rows: string[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join('-')}>
              {row.map((cell, i) => <td key={i}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function App() {
  const [section, setSection] = useState<Section>('Dashboard');
  const [query, setQuery] = useState('');
  const filteredLeads = useMemo(() => leads.filter((r) => r.join(' ').toLowerCase().includes(query.toLowerCase())), [query]);

  return (
    <div className="app-shell">
      <aside>
        <div className="brand"><div className="brand-mark">S</div><div><strong>SBOS</strong><span>SUCCESSBRAND OS</span></div></div>
        <nav>
          {nav.map(({ label, icon: Icon }) => (
            <button className={section === label ? 'active' : ''} key={label} onClick={() => setSection(label)}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
      </aside>

      <main>
        <div className="notice">MVP Operations Layer — not the official clinical record.</div>
        <header><div><span>SuccessBrand Behavioral Health</span></div><div className="user">Ju <b>Practice Administrator</b><i>J</i></div></header>

        <section className="content">
          <div className="title-row"><div><h1>{section}</h1><p>Operational workspace for SuccessBrand</p></div><div className="search"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" /></div></div>

          {section === 'Dashboard' && <>
            <div className="stats">{stats.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
            <div className="grid-2">
              <section className="panel"><h2>Today's Schedule</h2><DataTable rows={[["9:00 AM","Rachel Bloom","Dr. Alicia Ford","Confirmed"],["10:30 AM","Marcus Green","Dr. Marcus Lee","Scheduled"],["1:00 PM","Emily Watts","Dr. Alicia Ford","Scheduled"],["3:00 PM","Kevin Nguyen","Dr. Marcus Lee","Scheduled"]]} /></section>
              <section className="panel"><h2>Operational Alerts</h2><div className="alert danger">Urgent Jessie call requiring review</div><div className="alert warning">1 overdue task</div><div className="alert info">1 client with intake pending</div></section>
            </div>
            <div className="grid-3">
              <section className="panel"><h2>New Leads</h2><DataTable rows={filteredLeads.slice(0,4)} /></section>
              <section className="panel"><h2>Team Tasks</h2><DataTable rows={tasks} /></section>
              <section className="panel"><h2>Jessie Activity</h2><DataTable rows={[["Amanda Rivera","New inquiry","Pending review"],["Kevin Nguyen","Consultation booked","Reviewed"],["Anonymous","Escalated to clinician","Escalated"]]} /></section>
            </div>
          </>}

          {section === 'Leads' && <section className="panel"><h2>Lead Pipeline</h2><DataTable rows={filteredLeads} /></section>}
          {section === 'Tasks' && <section className="panel"><h2>Team Tasks</h2><DataTable rows={tasks} /></section>}
          {section !== 'Dashboard' && section !== 'Leads' && section !== 'Tasks' && <section className="panel placeholder"><h2>{section}</h2><p>This module is ready for live Supabase data and integration wiring.</p></section>}
        </section>
      </main>
    </div>
  );
}

export default App;
