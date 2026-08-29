const fs = require('fs');

// 1. Update VariantSelector.tsx
let vsContent = fs.readFileSync('E:/MutationMechanic/components/VariantSelector.tsx', 'utf8');
vsContent = vsContent.replace(
  'className="bg-slate-850 p-6 rounded-xl border border-slate-700 shadow-sm"',
  'className="mm-card-glowing mm-glow mm-glow--blue p-6 rounded-xl shadow-xl transition-all duration-300"'
);

// Enhancement: Make Quick Presets button glow slightly
vsContent = vsContent.replace(
  "bg-primary/20 border-primary text-white font-bold shadow-sm",
  "bg-primary/20 border-primary text-white font-bold shadow-[0_0_12px_rgba(34,211,238,0.4)] mm-glow--cyan"
);

fs.writeFileSync('E:/MutationMechanic/components/VariantSelector.tsx', vsContent);

// 2. Update HistoryTable.tsx
let htContent = fs.readFileSync('E:/MutationMechanic/components/Analytics/HistoryTable.tsx', 'utf8');
htContent = htContent.replace(
  /className="bg-slate-900 border border-slate-800 rounded-2xl p-6"/g,
  'className="mm-card-glowing mm-glow mm-glow--cyan p-6 rounded-2xl shadow-xl transition-all duration-300"'
);

// Make the table container glow as well
htContent = htContent.replace(
  'className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200"',
  'className="mm-card-glowing mm-glow mm-glow--purple rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-300 shadow-xl"'
);

// Enhancement: Update new patient button to tactical button style
htContent = htContent.replace(
  "'text-sm font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300',",
  "'text-xs font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 uppercase tracking-widest shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:shadow-[0_0_20px_rgba(34,211,238,0.6)]',"
);

// Enhancement: Make stats block a bit more glowing
htContent = htContent.replace(
  /className={`rounded-xl border p-4 \${isEmpty\(patients.length\) \? 'border-slate-800 bg-slate-950\/50' : 'border-slate-800 bg-slate-950'}`}/g,
  'className={`rounded-xl border p-4 transition-all ${isEmpty(patients.length) ? "border-slate-800 bg-slate-950/50" : "border-cyan-500/30 bg-cyan-950/20 shadow-[inset_0_0_10px_rgba(34,211,238,0.05)]"}`}'
);

htContent = htContent.replace(
  /className={`rounded-xl border p-4 \${isEmpty\(history.length\) \? 'border-slate-800 bg-slate-950\/50' : 'border-slate-800 bg-slate-950'}`}/g,
  'className={`rounded-xl border p-4 transition-all ${isEmpty(history.length) ? "border-slate-800 bg-slate-950/50" : "border-cyan-500/30 bg-cyan-950/20 shadow-[inset_0_0_10px_rgba(34,211,238,0.05)]"}`}'
);

fs.writeFileSync('E:/MutationMechanic/components/Analytics/HistoryTable.tsx', htContent);

// 3. Update AnalyticsDashboard.tsx export buttons
let adContent = fs.readFileSync('E:/MutationMechanic/components/Analytics/AnalyticsDashboard.tsx', 'utf8');

// The active export format button
adContent = adContent.replace(
  /'bg-primary\/10 border-primary text-white shadow-\[0_0_15px_rgba\(99,102,241,0\.2\)\]'/g,
  "'bg-rose-500/10 border-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)] mm-glow--rose'"
);

fs.writeFileSync('E:/MutationMechanic/components/Analytics/AnalyticsDashboard.tsx', adContent);

console.log('Successfully applied glowing borders and enhancements');
