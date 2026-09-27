import { Construction } from "lucide-react";
import Layout from "../components/Layout";

export default function ComingSoon({ title, subtitle, phaseNote }) {
  return (
    <Layout title={title} subtitle={subtitle}>
      <div className="rounded-2xl border border-dashed border-base-border bg-base-surface/50 p-12 flex flex-col items-center text-center max-w-xl mx-auto mt-10">
        <div className="w-12 h-12 rounded-xl bg-base-surface2 border border-base-border flex items-center justify-center mb-4">
          <Construction size={20} className="text-ink-500" />
        </div>
        <h3 className="font-display font-semibold text-ink-100 mb-1.5">Not built yet</h3>
        <p className="text-[13px] text-ink-500 leading-relaxed">
          {phaseNote || "This section is planned for a later build phase and isn't implemented yet."}
        </p>
      </div>
    </Layout>
  );
}
