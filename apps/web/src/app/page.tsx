import Link from "next/link";

const features = [
  {
    title: "Scheduling",
    text: "Coordinate appointments, staff workflows, and day-to-day operations from one place.",
  },
  {
    title: "Documentation",
    text: "Keep operational and clinical documentation organized inside the same system.",
  },
  {
    title: "Billing",
    text: "Bring billing workflows and operational follow-through into a single workspace.",
  },
  {
    title: "Analytics",
    text: "See the information that matters without bouncing between disconnected tools.",
  },
];

export default function RootPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xl font-semibold tracking-tight">SBOS</p>
            <p className="text-xs text-slate-400">Success Brand Operating System</p>
          </div>
          <Link
            href="/login"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <div className="mb-5 inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Live operations platform
          </div>
          <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            One operating system for behavioral-health operations.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            SBOS brings scheduling, documentation, billing workflows, and analytics into one connected workspace so teams can spend less time chasing systems and more time running the work.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Open SBOS
            </Link>
            <a
              href="mailto:lonniebimages@gmail.com?subject=SBOS%20Access"
              className="rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold transition hover:bg-white/10"
            >
              Request access
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Access is currently provisioned for authorized users. This site does not represent HealthOS as deployed.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
          <p className="text-sm font-medium text-slate-300">Built for connected operations</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                <h2 className="font-semibold">{feature.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="text-2xl font-semibold">Web + API</p>
              <p className="mt-2 text-sm text-slate-400">A connected application stack, not a static mockup.</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">Role-based access</p>
              <p className="mt-2 text-sm text-slate-400">Protected workspaces keep operational screens behind authentication.</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">Operational focus</p>
              <p className="mt-2 text-sm text-slate-400">Designed around the workflows teams actually need to complete.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-10 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>SBOS · Success Brand Operating System</p>
        <Link href="/login" className="text-slate-300 hover:text-white">
          Authorized user sign in
        </Link>
      </footer>
    </main>
  );
}
