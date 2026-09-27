import Sidebar from "./Sidebar";

export default function Layout({ children, title, subtitle, actions }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 border-b border-base-border bg-base-bg/80 backdrop-blur px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="font-display font-semibold text-xl text-ink-100">{title}</h1>
            {subtitle && <p className="text-[13px] text-ink-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions}
        </header>
        <div className="px-8 py-7">{children}</div>
      </main>
    </div>
  );
}
