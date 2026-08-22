import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api/client";
import type {
  AssessmentDefinitionResponse,
  AssessmentSessionResponse,
  CreateAssessmentSessionRequest,
  AssessmentCategory
} from "@fitos/contracts";

const CATEGORY_META: Record<AssessmentCategory, { label: string; color: string; icon: string }> = {
  body_composition: { label: "Body Composition", color: "#6366f1", icon: "⚖️" },
  neuromuscular_force: { label: "Force & Power", color: "#f59e0b", icon: "⚡" },
  cardiovascular_vo2: { label: "Cardiovascular VO2", color: "#ef4444", icon: "🫀" },
  mobility_rom: { label: "Mobility & ROM", color: "#22c55e", icon: "📐" },
  metabolic: { label: "Metabolic Rate", color: "#8b5cf6", icon: "🔥" }
};

const VENDOR_BADGES: Record<string, string> = {
  lookinbody_inbody: "InBody LookinBody",
  vald_forcedecks: "VALD ForceDecks",
  cosmed_k5: "COSMED Spirometry",
  pnoe: "PNOE Breath Bio",
  manual: "Manual Clinical Screen"
};

type Tab = "sessions" | "protocols";

export default function AssessmentsPage() {
  const [tab, setTab] = useState<Tab>("sessions");
  const [definitions, setDefinitions] = useState<AssessmentDefinitionResponse[]>([]);
  const [sessions, setSessions] = useState<AssessmentSessionResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSession, setSelectedSession] = useState<AssessmentSessionResponse | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [selectedDefId, setSelectedDefId] = useState<string>("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        api.assessmentDefinitions(),
        api.assessmentSessions()
      ]);
      setDefinitions(d);
      setSessions(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const filteredSessions = sessions.filter((s) => {
    if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
    if (search && !s.memberName.toLowerCase().includes(search.toLowerCase()) && !s.definitionName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="assess-page">
      <div className="assess-header">
        <div>
          <h1 className="assess-title">FITOS Assess • Performance Lab</h1>
          <p className="assess-subtitle">Diagnostic biometrics, force plate kinetics, and body composition profiling.</p>
        </div>
        <div className="assess-header-actions">
          <button className="btn-primary" onClick={() => setShowNewSession(true)}>
            + Record Assessment
          </button>
        </div>
      </div>

      {/* Stats summary strip */}
      <div className="assess-stats">
        <div className="assess-stat-card">
          <div className="stat-label">Total Scans Performed</div>
          <div className="stat-value">{sessions.length}</div>
          <div className="stat-sub">Across all diagnostic categories</div>
        </div>
        <div className="assess-stat-card">
          <div className="stat-label">Active Diagnostic Protocols</div>
          <div className="stat-value">{definitions.length}</div>
          <div className="stat-sub">Hardware integrated & manual</div>
        </div>
        <div className="assess-stat-card">
          <div className="stat-label">InBody 970 Scans</div>
          <div className="stat-value">{sessions.filter((s) => s.category === "body_composition").length}</div>
          <div className="stat-sub">Body composition analyses</div>
        </div>
        <div className="assess-stat-card">
          <div className="stat-label">Kinetic & VO2 Tests</div>
          <div className="stat-value">
            {sessions.filter((s) => s.category === "neuromuscular_force" || s.category === "cardiovascular_vo2").length}
          </div>
          <div className="stat-sub">Peak power & aerobic threshold</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="assess-tabs">
        <button className={`assess-tab ${tab === "sessions" ? "active" : ""}`} onClick={() => setTab("sessions")}>
          Assessment Sessions ({sessions.length})
        </button>
        <button className={`assess-tab ${tab === "protocols" ? "active" : ""}`} onClick={() => setTab("protocols")}>
          Protocols & Devices ({definitions.length})
        </button>
      </div>

      {tab === "sessions" && (
        <>
          <div className="assess-filters">
            <input
              type="text"
              placeholder="Search by member or protocol…"
              className="filter-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="filter-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All Diagnostic Modalities</option>
              {Object.entries(CATEGORY_META).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="assess-loading">Loading diagnostic sessions…</div>
          ) : (
            <div className="session-grid">
              {filteredSessions.map((s) => {
                const cat = CATEGORY_META[s.category] ?? { label: s.category, color: "#6366f1", icon: "📊" };
                return (
                  <div
                    key={s.id}
                    className="session-card"
                    onClick={() => setSelectedSession(s)}
                  >
                    <div className="session-card-top">
                      <span className="session-cat-badge" style={{ background: `${cat.color}15`, color: cat.color, borderColor: `${cat.color}35` }}>
                        {cat.icon} {cat.label}
                      </span>
                      <span className="session-date">
                        {new Date(s.conductedAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}
                      </span>
                    </div>

                    <h3 className="session-member">{s.memberName}</h3>
                    <div className="session-def-name">{s.definitionName}</div>
                    <p className="session-summary">{s.summary}</p>

                    {/* Metric Chips */}
                    <div className="session-metrics-preview">
                      {Object.entries(s.metrics).slice(0, 4).map(([k, v]) => (
                        <div key={k} className="metric-chip">
                          <span className="metric-k">{k.replace(/([A-Z])/g, " $1").replace(/Kg|Pct|Cm|Watts/g, "")}</span>
                          <span className="metric-v">{typeof v === "number" ? v.toLocaleString() : v}</span>
                        </div>
                      ))}
                    </div>

                    <div className="session-footer">
                      <span className="session-assessor">Conducted by {s.assessorName}</span>
                      {s.branchName && <span className="session-branch">{s.branchName}</span>}
                    </div>
                  </div>
                );
              })}
              {filteredSessions.length === 0 && (
                <div className="assess-empty">No assessment sessions match your filters.</div>
              )}
            </div>
          )}
        </>
      )}

      {tab === "protocols" && (
        <div className="protocol-grid">
          {definitions.map((def) => {
            const cat = CATEGORY_META[def.category] ?? { label: def.category, color: "#6366f1", icon: "📊" };
            return (
              <div key={def.id} className="protocol-card">
                <div className="protocol-card-top">
                  <span className="session-cat-badge" style={{ background: `${cat.color}15`, color: cat.color, borderColor: `${cat.color}35` }}>
                    {cat.icon} {cat.label}
                  </span>
                  <span className="vendor-badge">{VENDOR_BADGES[def.deviceVendor] ?? def.deviceVendor}</span>
                </div>
                <h3 className="protocol-title">{def.name}</h3>
                <p className="protocol-desc">{def.description}</p>
                <div className="protocol-metrics-list">
                  <div className="protocol-metrics-header">Tracked Biomarkers ({def.metrics.length})</div>
                  {def.metrics.map((m) => (
                    <div key={m.key} className="protocol-metric-row">
                      <span className="metric-name">{m.name}</span>
                      <span className="metric-unit">[{m.unit}]</span>
                    </div>
                  ))}
                </div>
                <button
                  className="btn-launch-scan"
                  onClick={() => { setSelectedDefId(def.id); setShowNewSession(true); }}
                >
                  + Launch New Scan
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Session Detail Drawer */}
      {selectedSession && (
        <div className="drawer-overlay" onClick={() => setSelectedSession(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <span className="drawer-sub">{new Date(selectedSession.conductedAt).toLocaleDateString("en-KE", { dateStyle: "long" })}</span>
                <h2 className="drawer-title">{selectedSession.memberName}</h2>
                <div className="drawer-protocol-tag">{selectedSession.definitionName}</div>
              </div>
              <button className="drawer-close" onClick={() => setSelectedSession(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div className="drawer-summary-card">
                <h4>Clinical Findings & Summary</h4>
                <p>{selectedSession.summary}</p>
              </div>

              <div className="drawer-metrics-section">
                <h4>Biometric Data Breakdown</h4>
                <div className="metrics-grid">
                  {Object.entries(selectedSession.metrics).map(([k, v]) => (
                    <div key={k} className="metric-box">
                      <span className="metric-label">{k.replace(/([A-Z])/g, " $1")}</span>
                      <span className="metric-val">{typeof v === "number" ? v.toLocaleString() : v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedSession.notes && (
                <div className="drawer-notes-section">
                  <h4>Staff Notes</h4>
                  <p>{selectedSession.notes}</p>
                </div>
              )}

              <div className="drawer-assessor-info">
                <span>Conducted by: <strong>{selectedSession.assessorName}</strong></span>
                {selectedSession.branchName && <span>Branch: <strong>{selectedSession.branchName}</strong></span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Assessment Session Modal */}
      {showNewSession && (
        <NewSessionModal
          definitions={definitions}
          defaultDefId={selectedDefId}
          onClose={() => { setShowNewSession(false); setSelectedDefId(""); }}
          onCreated={() => { setShowNewSession(false); setSelectedDefId(""); void reload(); }}
        />
      )}

      <style>{`
        .assess-page { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
        .assess-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
        .assess-title { font-size: 1.7rem; font-weight: 800; color: white; margin-bottom: .35rem; }
        .assess-subtitle { color: rgba(255,255,255,0.45); }
        .assess-header-actions { display: flex; gap: .75rem; }

        .assess-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
        .assess-stat-card {
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px; padding: 1.25rem; display: flex; flex-direction: column; gap: 4px;
        }
        .stat-label { font-size: .75rem; font-weight: 600; color: rgba(255,255,255,0.45); }
        .stat-value { font-size: 1.6rem; font-weight: 800; color: white; line-height: 1.2; }
        .stat-sub { font-size: .72rem; color: rgba(255,255,255,0.35); }

        .assess-tabs { display: flex; gap: .25rem; background: rgba(255,255,255,0.04); border-radius: 12px; padding: .35rem; border: 1px solid rgba(255,255,255,0.07); align-self: flex-start; }
        .assess-tab { padding: .45rem 1rem; border-radius: 8px; font-size: .82rem; font-weight: 600; color: rgba(255,255,255,0.45); background: none; border: none; cursor: pointer; transition: all .2s; }
        .assess-tab.active { background: rgba(99,102,241,0.25); color: #a5b4fc; }

        .assess-filters { display: flex; gap: .75rem; flex-wrap: wrap; }
        .filter-search, .filter-select {
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px; padding: .5rem .85rem; color: white; font-size: .85rem; outline: none;
        }
        .filter-search { flex: 1; min-width: 180px; }
        .filter-search::placeholder { color: rgba(255,255,255,0.3); }
        .filter-select option { background: #1a1b2e; }

        .assess-loading, .assess-empty { color: rgba(255,255,255,0.35); text-align: center; padding: 3rem; font-size: .9rem; }

        .session-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
        .session-card {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px; padding: 1.25rem; cursor: pointer; transition: all .2s;
          display: flex; flex-direction: column; gap: .6rem;
        }
        .session-card:hover { border-color: rgba(99,102,241,0.4); transform: translateY(-2px); }
        .session-card-top { display: flex; justify-content: space-between; align-items: center; }
        .session-cat-badge { font-size: .65rem; font-weight: 700; padding: .2rem .55rem; border-radius: 99px; border: 1px solid; }
        .session-date { font-size: .72rem; color: rgba(255,255,255,0.35); }
        .session-member { font-size: 1rem; font-weight: 800; color: white; }
        .session-def-name { font-size: .78rem; color: #818cf8; font-weight: 600; }
        .session-summary { font-size: .82rem; color: rgba(255,255,255,0.6); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

        .session-metrics-preview { display: grid; grid-template-columns: 1fr 1fr; gap: .4rem; margin-top: .25rem; }
        .metric-chip { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: .35rem .6rem; display: flex; justify-content: space-between; align-items: baseline; }
        .metric-k { font-size: .65rem; color: rgba(255,255,255,0.35); text-transform: capitalize; }
        .metric-v { font-size: .82rem; font-weight: 700; color: white; }

        .session-footer { display: flex; justify-content: space-between; font-size: .7rem; color: rgba(255,255,255,0.35); border-top: 1px solid rgba(255,255,255,0.06); padding-top: .6rem; margin-top: .25rem; }

        .protocol-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.25rem; }
        .protocol-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 1.5rem; display: flex; flex-direction: column; gap: .85rem; }
        .protocol-card-top { display: flex; justify-content: space-between; align-items: center; }
        .vendor-badge { font-size: .65rem; font-weight: 700; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.06); padding: .2rem .5rem; border-radius: 6px; }
        .protocol-title { font-size: 1rem; font-weight: 800; color: white; line-height: 1.3; }
        .protocol-desc { font-size: .82rem; color: rgba(255,255,255,0.5); line-height: 1.5; }
        .protocol-metrics-list { display: flex; flex-direction: column; gap: 4px; background: rgba(255,255,255,0.02); border-radius: 10px; padding: .75rem; }
        .protocol-metrics-header { font-size: .72rem; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: .25rem; }
        .protocol-metric-row { display: flex; justify-content: space-between; font-size: .78rem; }
        .metric-name { color: rgba(255,255,255,0.7); }
        .metric-unit { color: rgba(255,255,255,0.3); font-size: .7rem; }
        .btn-launch-scan { padding: .6rem; border-radius: 10px; font-size: .85rem; font-weight: 700; background: rgba(99,102,241,0.15); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.25); cursor: pointer; transition: all .2s; text-align: center; }
        .btn-launch-scan:hover { background: rgba(99,102,241,0.25); }

        /* Drawer */
        .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200; display: flex; justify-content: flex-end; }
        .drawer { width: min(520px, 100vw); height: 100%; background: #111827; border-left: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; overflow: hidden; }
        .drawer-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 1.5rem 1.5rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .drawer-sub { font-size: .72rem; color: rgba(255,255,255,0.35); }
        .drawer-title { font-size: 1.3rem; font-weight: 800; color: white; line-height: 1.2; margin-top: 2px; }
        .drawer-protocol-tag { font-size: .8rem; font-weight: 600; color: #818cf8; margin-top: 4px; }
        .drawer-close { background: rgba(255,255,255,0.08); border: none; color: rgba(255,255,255,0.6); width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: .9rem; }
        .drawer-body { flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }

        .drawer-summary-card { background: rgba(99,102,241,0.06); border: 1px solid rgba(99,102,241,0.15); border-radius: 12px; padding: 1rem; }
        .drawer-summary-card h4 { font-size: .75rem; font-weight: 700; color: #a5b4fc; text-transform: uppercase; letter-spacing: 1px; margin-bottom: .4rem; }
        .drawer-summary-card p { font-size: .85rem; color: rgba(255,255,255,0.8); line-height: 1.5; }

        .drawer-metrics-section h4 { font-size: .75rem; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1px; margin-bottom: .75rem; }
        .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .6rem; }
        .metric-box { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: .75rem; display: flex; flex-direction: column; gap: 2px; }
        .metric-label { font-size: .68rem; color: rgba(255,255,255,0.4); text-transform: capitalize; }
        .metric-val { font-size: 1.15rem; font-weight: 800; color: white; }

        .drawer-notes-section h4 { font-size: .75rem; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1px; margin-bottom: .4rem; }
        .drawer-notes-section p { font-size: .83rem; color: rgba(255,255,255,0.65); line-height: 1.5; }

        .drawer-assessor-info { display: flex; justify-content: space-between; font-size: .75rem; color: rgba(255,255,255,0.4); border-top: 1px solid rgba(255,255,255,0.06); padding-top: .75rem; }
        .drawer-assessor-info strong { color: rgba(255,255,255,0.8); }

        .btn-primary { padding: .6rem 1.25rem; border-radius: 10px; font-size: .85rem; font-weight: 700; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: white; border: none; cursor: pointer; transition: all .2s; }
        .btn-primary:hover { opacity: .9; transform: translateY(-1px); }
        .btn-secondary { padding: .6rem 1.25rem; border-radius: 10px; font-size: .85rem; font-weight: 600; background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.12); cursor: pointer; transition: all .2s; }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}

// ── New Session Modal ────────────────────────────────────────────────────────
function NewSessionModal({
  definitions,
  defaultDefId,
  onClose,
  onCreated
}: {
  definitions: AssessmentDefinitionResponse[];
  defaultDefId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [defId, setDefId] = useState(defaultDefId || definitions[0]?.id || "");
  const [memberId, setMemberId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [metrics, setMetrics] = useState<Record<string, number | string>>({});

  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.members(new URLSearchParams({ limit: "100" })).then((res) => {
      setMembers(res.data.map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}` })));
      if (res.data[0]) setMemberId(res.data[0].id);
    });
    api.branches().then((b) => {
      setBranches(b.map((br) => ({ id: br.id, name: br.name })));
      if (b[0]) setBranchId(b[0].id);
    });
  }, []);

  const selectedDef = definitions.find((d) => d.id === defId);

  const setMetric = (k: string, val: string) => {
    const num = parseFloat(val);
    setMetrics((m) => ({ ...m, [k]: isNaN(num) ? val : num }));
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.createAssessmentSession({
        branchId,
        memberId,
        definitionId: defId,
        summary,
        metrics,
        notes: notes || undefined
      });
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to record assessment session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px" }}>
        <div className="modal-header">
          <h2>Record Diagnostic Scan</h2>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Protocol / Device</label>
              <select value={defId} onChange={(e) => { setDefId(e.target.value); setMetrics({}); }}>
                {definitions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Member</label>
              <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Branch</label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {/* Dynamic Metrics */}
          {selectedDef && (
            <div className="metrics-entry-section">
              <label className="section-label">Biometric Inputs ({selectedDef.metrics.length})</label>
              <div className="metrics-entry-grid">
                {selectedDef.metrics.map((m) => (
                  <div key={m.key} className="form-group">
                    <label>{m.name} ({m.unit})</label>
                    <input
                      type="number"
                      step="any"
                      placeholder={`e.g. ${m.optimalMin ?? 0}`}
                      value={metrics[m.key] !== undefined ? String(metrics[m.key]) : ""}
                      onChange={(e) => setMetric(m.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Clinical Findings / Summary</label>
            <textarea
              rows={2}
              placeholder="Key observations and progress summary…"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Staff Recommendations (optional)</label>
            <input
              type="text"
              placeholder="Recommended training / nutrition adjustments…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn-primary"
              onClick={submit}
              disabled={loading || !defId || !memberId || !branchId || !summary}
            >
              {loading ? "Recording…" : "Save Scan Session"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 300; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .modal { background: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; width: 100%; max-width: 480px; display: flex; flex-direction: column; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .modal-header h2 { font-size: 1.1rem; font-weight: 800; color: white; }
        .modal-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: .85rem; }
        .modal-actions { display: flex; gap: .75rem; justify-content: flex-end; margin-top: .5rem; }
        .form-group { display: flex; flex-direction: column; gap: 5px; }
        .form-row { display: flex; gap: .75rem; }
        .form-row .form-group { flex: 1; }
        .form-group label { font-size: .78rem; font-weight: 600; color: rgba(255,255,255,0.55); }
        .form-group input, .form-group select, .form-group textarea { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: .5rem .75rem; color: white; font-size: .85rem; outline: none; }
        .form-group input::placeholder, .form-group textarea::placeholder { color: rgba(255,255,255,0.2); }
        .form-group select option { background: #1a1b2e; }
        .form-error { color: #f87171; font-size: .8rem; }
        .section-label { font-size: .75rem; font-weight: 700; color: #818cf8; text-transform: uppercase; letter-spacing: 1px; }
        .metrics-entry-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .6rem; margin-top: .4rem; }
      `}</style>
    </div>
  );
}
