import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api/client";
import type {
  TherapyModalityResponse,
  TherapyProtocolResponse,
  TherapySessionResponse,
  CreateTherapySessionRequest,
  ModalityCode,
  TherapySessionStatus
} from "@fitos/contracts";

// ── Metadata ──────────────────────────────────────────────────────────────────
const MODALITY_META: Record<ModalityCode, { icon: string; color: string; tagline: string }> = {
  neubie_direct_current: { icon: "⚡", color: "#8b5cf6", tagline: "Pulsed Direct Current Neuromuscular Stimulation" },
  alterg_anti_gravity:  { icon: "🛸", color: "#6366f1", tagline: "NASA-Patented Anti-Gravity Treadmill" },
  normatec_compression: { icon: "🦵", color: "#0ea5e9", tagline: "Dynamic Air Compression Recovery" },
  hyperbaric_oxygen:    { icon: "🫁", color: "#22c55e", tagline: "Hyperbaric Oxygen Therapy" },
  cryotherapy:          { icon: "❄️", color: "#38bdf8", tagline: "Whole-Body Cryotherapy" },
  infrared_sauna:       { icon: "🔆", color: "#f59e0b", tagline: "Far-Infrared Sauna Detox" }
};

const STATUS_META: Record<TherapySessionStatus, { label: string; color: string }> = {
  completed:   { label: "Completed",   color: "#22c55e" },
  in_progress: { label: "In Progress", color: "#f59e0b" },
  interrupted: { label: "Interrupted", color: "#ef4444" }
};

type Tab = "sessions" | "protocols" | "modalities";

export default function TherapyPage() {
  const [tab, setTab] = useState<Tab>("sessions");

  const [modalities, setModalities] = useState<TherapyModalityResponse[]>([]);
  const [protocols, setProtocols]   = useState<TherapyProtocolResponse[]>([]);
  const [sessions, setSessions]     = useState<TherapySessionResponse[]>([]);
  const [loading, setLoading]       = useState(true);

  const [selectedSession, setSelectedSession] = useState<TherapySessionResponse | null>(null);
  const [selectedProtocol, setSelectedProtocol] = useState<TherapyProtocolResponse | null>(null);
  const [showNewSession, setShowNewSession]     = useState(false);
  const [defaultProtocolId, setDefaultProtocolId] = useState<string>("");

  const [search, setSearch]           = useState("");
  const [modalityFilter, setModalityFilter] = useState<string>("all");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [m, p, s] = await Promise.all([
        api.therapyModalities(),
        api.therapyProtocols(),
        api.therapySessions()
      ]);
      setModalities(m);
      setProtocols(p);
      setSessions(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const filteredSessions = sessions.filter((s) => {
    if (modalityFilter !== "all" && s.modalityCode !== modalityFilter) return false;
    if (search && !s.memberName.toLowerCase().includes(search.toLowerCase()) && !s.protocolName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const avgPainReduction = (() => {
    const valid = sessions.filter((s) => s.prePainScore !== null && s.postPainScore !== null);
    if (!valid.length) return 0;
    const total = valid.reduce((acc, s) => acc + ((s.prePainScore ?? 0) - (s.postPainScore ?? 0)), 0);
    return (total / valid.length).toFixed(1);
  })();

  const adverseCount = sessions.filter((s) => s.adverseReaction).length;

  return (
    <div className="therapy-page">
      <div className="therapy-header">
        <div>
          <h1 className="therapy-title">FITOS Therapy • Recovery Suite</h1>
          <p className="therapy-subtitle">NEUBIE neuromuscular stimulation, AlterG anti-gravity, Normatec compression & clinical recovery protocols.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNewSession(true)}>
          + Record Session
        </button>
      </div>

      {/* Stats strip */}
      <div className="therapy-stats">
        <div className="therapy-stat-card">
          <span className="stat-label">Total Sessions</span>
          <span className="stat-value">{sessions.length}</span>
          <span className="stat-sub">Across all modalities</span>
        </div>
        <div className="therapy-stat-card">
          <span className="stat-label">Active Protocols</span>
          <span className="stat-value">{protocols.filter((p) => p.isActive).length}</span>
          <span className="stat-sub">Clinical intervention templates</span>
        </div>
        <div className="therapy-stat-card">
          <span className="stat-label">Avg Pain Reduction</span>
          <span className="stat-value">{avgPainReduction}<span className="stat-unit"> pts</span></span>
          <span className="stat-sub">Pre → Post pain score delta</span>
        </div>
        <div className="therapy-stat-card">
          <span className="stat-label">Adverse Reactions</span>
          <span className="stat-value" style={{ color: adverseCount > 0 ? "#ef4444" : "#22c55e" }}>{adverseCount}</span>
          <span className="stat-sub">{adverseCount === 0 ? "Zero adverse events ✓" : "Requires clinical review"}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="therapy-tabs">
        {(["sessions", "protocols", "modalities"] as Tab[]).map((t) => (
          <button key={t} className={`therapy-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "sessions" ? `Sessions (${sessions.length})` : t === "protocols" ? `Protocols (${protocols.length})` : `Modalities (${modalities.length})`}
          </button>
        ))}
      </div>

      {/* Sessions Tab */}
      {tab === "sessions" && (
        <>
          <div className="therapy-filters">
            <input
              className="filter-search"
              type="text"
              placeholder="Search member or protocol…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="filter-select" value={modalityFilter} onChange={(e) => setModalityFilter(e.target.value)}>
              <option value="all">All Modalities</option>
              {modalities.map((m) => (
                <option key={m.code} value={m.code}>{MODALITY_META[m.code]?.icon ?? "🔬"} {m.name}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="therapy-loading">Loading therapy sessions…</div>
          ) : filteredSessions.length === 0 ? (
            <div className="therapy-empty">No sessions match your filters. Record the first session.</div>
          ) : (
            <div className="session-table-wrap">
              <table className="session-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Protocol</th>
                    <th>Modality</th>
                    <th>Pre Pain</th>
                    <th>Post Pain</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((s) => {
                    const meta = MODALITY_META[s.modalityCode];
                    const status = STATUS_META[s.status];
                    const delta = s.prePainScore !== null && s.postPainScore !== null
                      ? s.prePainScore - s.postPainScore : null;
                    return (
                      <tr key={s.id} className="session-row" onClick={() => setSelectedSession(s)}>
                        <td className="cell-member">{s.memberName}</td>
                        <td className="cell-protocol">
                          <span className="protocol-truncate">{s.protocolName}</span>
                        </td>
                        <td>
                          <span className="modality-tag" style={{ color: meta?.color ?? "#6366f1", background: `${meta?.color ?? "#6366f1"}15`, borderColor: `${meta?.color ?? "#6366f1"}30` }}>
                            {meta?.icon ?? "🔬"} {s.modalityCode.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="cell-num">{s.prePainScore ?? "—"}</td>
                        <td className="cell-num">
                          {s.postPainScore ?? "—"}
                          {delta !== null && (
                            <span className="pain-delta" style={{ color: delta >= 0 ? "#22c55e" : "#ef4444" }}>
                              {delta >= 0 ? ` ↓${delta}` : ` ↑${Math.abs(delta)}`}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="status-pill" style={{ color: status.color, background: `${status.color}12`, borderColor: `${status.color}25` }}>
                            {status.label}
                          </span>
                        </td>
                        <td className="cell-date">{new Date(s.startedAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}</td>
                        <td className="cell-staff">{s.staffName}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Protocols Tab */}
      {tab === "protocols" && (
        <div className="protocol-grid">
          {protocols.map((p) => {
            const meta = MODALITY_META[p.modalityCode];
            return (
              <div key={p.id} className="protocol-card" onClick={() => setSelectedProtocol(p)}>
                <div className="protocol-card-top">
                  <span className="modality-tag" style={{ color: meta?.color ?? "#6366f1", background: `${meta?.color ?? "#6366f1"}15`, borderColor: `${meta?.color ?? "#6366f1"}30` }}>
                    {meta?.icon ?? "🔬"} {p.modalityCode.replace(/_/g, " ")}
                  </span>
                </div>
                <h3 className="protocol-title">{p.name}</h3>
                <div className="protocol-indication">Indication: {p.indication}</div>
                <div className="protocol-target">Target: {p.targetArea}</div>

                <div className="protocol-checklist">
                  <span className="checklist-label">Safety Checklist ({p.safetyChecklist.length})</span>
                  {p.safetyChecklist.slice(0, 2).map((c, i) => (
                    <div key={i} className="checklist-item">✓ {c}</div>
                  ))}
                  {p.safetyChecklist.length > 2 && (
                    <div className="checklist-more">+{p.safetyChecklist.length - 2} more items…</div>
                  )}
                </div>

                <button
                  className="btn-launch"
                  onClick={(e) => { e.stopPropagation(); setDefaultProtocolId(p.id); setShowNewSession(true); }}
                >
                  + Start Session
                </button>
              </div>
            );
          })}
          {protocols.length === 0 && !loading && (
            <div className="therapy-empty">No clinical protocols defined yet. Add your first protocol.</div>
          )}
        </div>
      )}

      {/* Modalities Tab */}
      {tab === "modalities" && (
        <div className="modality-grid">
          {modalities.map((m) => {
            const meta = MODALITY_META[m.code];
            const modSessions = sessions.filter((s) => s.modalityCode === m.code);
            return (
              <div key={m.id} className="modality-card" style={{ borderTopColor: meta?.color ?? "#6366f1" }}>
                <div className="modality-card-icon" style={{ color: meta?.color ?? "#6366f1", background: `${meta?.color ?? "#6366f1"}12` }}>
                  {meta?.icon ?? "🔬"}
                </div>
                <h3 className="modality-name">{m.name}</h3>
                <p className="modality-desc">{m.description}</p>
                <div className="modality-meta-row">
                  <span className="modality-duration">⏱ {m.defaultDurationMinutes} min default</span>
                  <span className="modality-sessions">{modSessions.length} sessions</span>
                </div>
                <div className="modality-contraindications">
                  <span className="contra-label">Contraindications</span>
                  {m.contraindications.map((c, i) => (
                    <span key={i} className="contra-chip">⚠ {c}</span>
                  ))}
                </div>
              </div>
            );
          })}
          {modalities.length === 0 && !loading && (
            <div className="therapy-empty">No modalities configured for this facility.</div>
          )}
        </div>
      )}

      {/* Session Detail Drawer */}
      {selectedSession && (
        <div className="drawer-overlay" onClick={() => setSelectedSession(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <span className="drawer-sub">
                  {new Date(selectedSession.startedAt).toLocaleDateString("en-KE", { dateStyle: "long" })}
                </span>
                <h2 className="drawer-title">{selectedSession.memberName}</h2>
                <div className="drawer-protocol-tag">{selectedSession.protocolName}</div>
              </div>
              <button className="drawer-close" onClick={() => setSelectedSession(null)}>✕</button>
            </div>
            <div className="drawer-body">
              {/* Pain Scores */}
              <div className="pain-score-row">
                <div className="pain-score-box">
                  <span className="ps-label">Pre-Session Pain</span>
                  <span className="ps-val" style={{ color: "#ef4444" }}>{selectedSession.prePainScore ?? "—"}<span className="ps-unit">/10</span></span>
                </div>
                <div className="pain-arrow">→</div>
                <div className="pain-score-box">
                  <span className="ps-label">Post-Session Pain</span>
                  <span className="ps-val" style={{ color: "#22c55e" }}>{selectedSession.postPainScore ?? "—"}<span className="ps-unit">/10</span></span>
                </div>
                {selectedSession.prePainScore !== null && selectedSession.postPainScore !== null && (
                  <div className="pain-delta-box">
                    <span className="ps-label">Reduction</span>
                    <span className="ps-val" style={{ color: "#22c55e" }}>
                      ↓{selectedSession.prePainScore - selectedSession.postPainScore}
                    </span>
                  </div>
                )}
              </div>

              {/* Actual Dosage */}
              <div className="drawer-section">
                <h4>Actual Dosage Applied</h4>
                <div className="dosage-grid">
                  {Object.entries(selectedSession.actualDosage).map(([k, v]) => (
                    <div key={k} className="dosage-box">
                      <span className="dosage-k">{k.replace(/([A-Z])/g, " $1")}</span>
                      <span className="dosage-v">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status & Safety */}
              <div className="drawer-row">
                <div className="drawer-badge-group">
                  <span className="status-pill" style={{
                    color: STATUS_META[selectedSession.status].color,
                    background: `${STATUS_META[selectedSession.status].color}12`,
                    borderColor: `${STATUS_META[selectedSession.status].color}25`
                  }}>
                    {STATUS_META[selectedSession.status].label}
                  </span>
                  {selectedSession.adverseReaction && (
                    <span className="adverse-badge">⚠ Adverse Reaction Reported</span>
                  )}
                </div>
              </div>

              {selectedSession.sessionNotes && (
                <div className="drawer-section">
                  <h4>Clinical Notes</h4>
                  <p className="drawer-notes">{selectedSession.sessionNotes}</p>
                </div>
              )}

              <div className="drawer-assessor-info">
                <span>Administered by: <strong>{selectedSession.staffName}</strong></span>
                {selectedSession.branchName && <span>Branch: <strong>{selectedSession.branchName}</strong></span>}
                {selectedSession.assetName && <span>Device: <strong>{selectedSession.assetName}</strong></span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Protocol Detail Drawer */}
      {selectedProtocol && (
        <div className="drawer-overlay" onClick={() => setSelectedProtocol(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <span className="drawer-sub">{selectedProtocol.modalityName}</span>
                <h2 className="drawer-title">{selectedProtocol.name}</h2>
                <div className="drawer-protocol-tag">{selectedProtocol.targetArea}</div>
              </div>
              <button className="drawer-close" onClick={() => setSelectedProtocol(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div className="drawer-section">
                <h4>Clinical Indication</h4>
                <p className="drawer-notes">{selectedProtocol.indication}</p>
              </div>
              <div className="drawer-section">
                <h4>Protocol Parameters</h4>
                <div className="dosage-grid">
                  {Object.entries(selectedProtocol.parameters).map(([k, v]) => (
                    <div key={k} className="dosage-box">
                      <span className="dosage-k">{k.replace(/([A-Z])/g, " $1")}</span>
                      <span className="dosage-v">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="drawer-section">
                <h4>Safety Checklist</h4>
                <ul className="protocol-checklist-list">
                  {selectedProtocol.safetyChecklist.map((c, i) => (
                    <li key={i}>✓ {c}</li>
                  ))}
                </ul>
              </div>
              <div className="drawer-section">
                <h4>Clinical Notes</h4>
                <p className="drawer-notes">{selectedProtocol.clinicalNotes}</p>
              </div>
              <button
                className="btn-primary"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => { setSelectedProtocol(null); setDefaultProtocolId(selectedProtocol.id); setShowNewSession(true); }}
              >
                + Start Session from this Protocol
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Session Modal */}
      {showNewSession && (
        <NewSessionModal
          protocols={protocols}
          defaultProtocolId={defaultProtocolId}
          onClose={() => { setShowNewSession(false); setDefaultProtocolId(""); }}
          onCreated={() => { setShowNewSession(false); setDefaultProtocolId(""); void reload(); }}
        />
      )}

      <style>{`
        .therapy-page { max-width: 1120px; margin: 0 auto; padding: 2rem 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
        .therapy-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
        .therapy-title { font-size: 1.7rem; font-weight: 800; color: white; margin-bottom: .35rem; }
        .therapy-subtitle { color: rgba(255,255,255,0.45); font-size: .87rem; max-width: 600px; line-height: 1.5; }

        .therapy-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
        .therapy-stat-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 1.25rem; display: flex; flex-direction: column; gap: 4px; }
        .stat-label { font-size: .75rem; font-weight: 600; color: rgba(255,255,255,0.45); }
        .stat-value { font-size: 1.6rem; font-weight: 800; color: white; line-height: 1.2; }
        .stat-unit { font-size: 1rem; color: rgba(255,255,255,0.5); }
        .stat-sub { font-size: .72rem; color: rgba(255,255,255,0.3); }

        .therapy-tabs { display: flex; gap: .25rem; background: rgba(255,255,255,0.04); border-radius: 12px; padding: .35rem; border: 1px solid rgba(255,255,255,0.07); align-self: flex-start; }
        .therapy-tab { padding: .45rem 1rem; border-radius: 8px; font-size: .82rem; font-weight: 600; color: rgba(255,255,255,0.45); background: none; border: none; cursor: pointer; transition: all .2s; text-transform: capitalize; }
        .therapy-tab.active { background: rgba(139,92,246,0.25); color: #c4b5fd; }

        .therapy-filters { display: flex; gap: .75rem; flex-wrap: wrap; }
        .filter-search, .filter-select { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: .5rem .85rem; color: white; font-size: .85rem; outline: none; }
        .filter-search { flex: 1; min-width: 180px; }
        .filter-search::placeholder { color: rgba(255,255,255,0.25); }
        .filter-select option { background: #1a1b2e; }

        .therapy-loading, .therapy-empty { color: rgba(255,255,255,0.35); text-align: center; padding: 3rem; font-size: .9rem; }

        /* Sessions Table */
        .session-table-wrap { overflow-x: auto; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); }
        .session-table { width: 100%; border-collapse: collapse; }
        .session-table thead th { background: rgba(255,255,255,0.04); padding: .75rem 1rem; font-size: .73rem; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: .8px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .session-table tbody tr { border-bottom: 1px solid rgba(255,255,255,0.05); transition: background .15s; cursor: pointer; }
        .session-table tbody tr:hover { background: rgba(255,255,255,0.03); }
        .session-table tbody td { padding: .8rem 1rem; font-size: .84rem; color: rgba(255,255,255,0.8); vertical-align: middle; }
        .cell-member { font-weight: 700; color: white; white-space: nowrap; }
        .cell-protocol .protocol-truncate { display: block; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .8rem; color: rgba(255,255,255,0.6); }
        .cell-num { font-weight: 700; color: white; text-align: center; }
        .cell-date { font-size: .78rem; color: rgba(255,255,255,0.4); white-space: nowrap; }
        .cell-staff { font-size: .78rem; color: rgba(255,255,255,0.5); }
        .pain-delta { font-size: .75rem; font-weight: 700; margin-left: 4px; }

        .modality-tag { font-size: .68rem; font-weight: 700; padding: .2rem .55rem; border-radius: 99px; border: 1px solid; white-space: nowrap; }
        .status-pill { font-size: .7rem; font-weight: 700; padding: .2rem .55rem; border-radius: 99px; border: 1px solid; white-space: nowrap; }

        /* Protocol Grid */
        .protocol-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.25rem; }
        .protocol-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 1.4rem; display: flex; flex-direction: column; gap: .85rem; cursor: pointer; transition: border-color .2s, transform .2s; }
        .protocol-card:hover { border-color: rgba(139,92,246,0.4); transform: translateY(-2px); }
        .protocol-card-top { display: flex; justify-content: space-between; align-items: center; }
        .protocol-title { font-size: 1rem; font-weight: 800; color: white; line-height: 1.3; }
        .protocol-indication { font-size: .8rem; color: rgba(255,255,255,0.5); }
        .protocol-target { font-size: .8rem; color: #a5b4fc; font-weight: 600; }
        .protocol-checklist { display: flex; flex-direction: column; gap: .25rem; background: rgba(255,255,255,0.02); border-radius: 8px; padding: .6rem; }
        .checklist-label { font-size: .68rem; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: .8px; margin-bottom: 2px; }
        .checklist-item { font-size: .77rem; color: rgba(255,255,255,0.55); }
        .checklist-more { font-size: .72rem; color: rgba(255,255,255,0.3); font-style: italic; }
        .btn-launch { padding: .5rem; border-radius: 10px; font-size: .83rem; font-weight: 700; background: rgba(139,92,246,0.12); color: #c4b5fd; border: 1px solid rgba(139,92,246,0.22); cursor: pointer; transition: all .2s; text-align: center; }
        .btn-launch:hover { background: rgba(139,92,246,0.22); }

        /* Modality Grid */
        .modality-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.25rem; }
        .modality-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-top: 3px solid; border-radius: 14px; padding: 1.4rem; display: flex; flex-direction: column; gap: .85rem; }
        .modality-card-icon { font-size: 1.6rem; width: 52px; height: 52px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .modality-name { font-size: .95rem; font-weight: 800; color: white; line-height: 1.3; }
        .modality-desc { font-size: .82rem; color: rgba(255,255,255,0.55); line-height: 1.5; }
        .modality-meta-row { display: flex; justify-content: space-between; font-size: .78rem; color: rgba(255,255,255,0.45); }
        .modality-sessions { font-weight: 700; color: rgba(255,255,255,0.65); }
        .modality-contraindications { display: flex; flex-direction: column; gap: 4px; }
        .contra-label { font-size: .68rem; font-weight: 700; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: .8px; }
        .contra-chip { font-size: .72rem; color: #fca5a5; background: rgba(239,68,68,.08); padding: .2rem .5rem; border-radius: 6px; border: 1px solid rgba(239,68,68,.18); }

        /* Drawer */
        .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200; display: flex; justify-content: flex-end; }
        .drawer { width: min(540px, 100vw); height: 100%; background: #111827; border-left: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; overflow: hidden; }
        .drawer-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 1.5rem 1.5rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .drawer-sub { font-size: .72rem; color: rgba(255,255,255,0.35); }
        .drawer-title { font-size: 1.3rem; font-weight: 800; color: white; line-height: 1.2; margin-top: 2px; }
        .drawer-protocol-tag { font-size: .8rem; font-weight: 600; color: #818cf8; margin-top: 4px; }
        .drawer-close { background: rgba(255,255,255,0.08); border: none; color: rgba(255,255,255,0.6); width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: .9rem; flex-shrink: 0; }
        .drawer-body { flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
        .drawer-section h4 { font-size: .75rem; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: .5rem; }
        .drawer-notes { font-size: .84rem; color: rgba(255,255,255,0.75); line-height: 1.6; }

        .pain-score-row { display: flex; align-items: center; gap: .75rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 1rem; }
        .pain-score-box { display: flex; flex-direction: column; gap: 2px; flex: 1; text-align: center; }
        .pain-arrow { font-size: 1.2rem; color: rgba(255,255,255,0.25); }
        .pain-delta-box { display: flex; flex-direction: column; gap: 2px; flex: 1; text-align: center; }
        .ps-label { font-size: .68rem; font-weight: 600; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: .5px; }
        .ps-val { font-size: 1.5rem; font-weight: 800; line-height: 1.2; }
        .ps-unit { font-size: .85rem; color: rgba(255,255,255,0.4); }

        .dosage-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; }
        .dosage-box { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: .6rem .85rem; display: flex; justify-content: space-between; align-items: baseline; }
        .dosage-k { font-size: .68rem; color: rgba(255,255,255,0.35); text-transform: capitalize; }
        .dosage-v { font-size: .88rem; font-weight: 700; color: white; }

        .drawer-row { display: flex; gap: .75rem; flex-wrap: wrap; }
        .drawer-badge-group { display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; }
        .adverse-badge { font-size: .72rem; font-weight: 700; color: #fca5a5; background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.22); padding: .2rem .55rem; border-radius: 99px; }

        .protocol-checklist-list { list-style: none; display: flex; flex-direction: column; gap: .4rem; }
        .protocol-checklist-list li { font-size: .83rem; color: rgba(255,255,255,0.7); }

        .drawer-assessor-info { display: flex; justify-content: space-between; flex-wrap: wrap; gap: .35rem; font-size: .75rem; color: rgba(255,255,255,0.4); border-top: 1px solid rgba(255,255,255,0.06); padding-top: .75rem; }
        .drawer-assessor-info strong { color: rgba(255,255,255,0.8); }

        .btn-primary { padding: .6rem 1.25rem; border-radius: 10px; font-size: .85rem; font-weight: 700; background: linear-gradient(135deg,#8b5cf6,#6366f1); color: white; border: none; cursor: pointer; transition: all .2s; display: flex; align-items: center; gap: .4rem; }
        .btn-primary:hover { opacity: .9; transform: translateY(-1px); }
        .btn-secondary { padding: .6rem 1.25rem; border-radius: 10px; font-size: .85rem; font-weight: 600; background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.12); cursor: pointer; transition: all .2s; }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}

// ── New Session Modal ────────────────────────────────────────────────────────
function NewSessionModal({
  protocols,
  defaultProtocolId,
  onClose,
  onCreated
}: {
  protocols: TherapyProtocolResponse[];
  defaultProtocolId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [protocolId, setProtocolId] = useState(defaultProtocolId || protocols[0]?.id || "");
  const [memberId, setMemberId]     = useState("");
  const [branchId, setBranchId]     = useState("");
  const [prePain, setPrePain]       = useState<string>("");
  const [postPain, setPostPain]     = useState<string>("");
  const [dosage, setDosage]         = useState<Record<string, string | number>>({});
  const [adverse, setAdverse]       = useState(false);
  const [notes, setNotes]           = useState("");
  const [status, setStatus]         = useState<TherapySessionStatus>("completed");

  const [members, setMembers]   = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

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

  const selectedProto = protocols.find((p) => p.id === protocolId);

  const setDosageVal = (k: string, val: string) => {
    const num = parseFloat(val);
    setDosage((d) => ({ ...d, [k]: isNaN(num) ? val : num }));
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: CreateTherapySessionRequest = {
        branchId,
        memberId,
        protocolId,
        actualDosage: dosage,
        adverseReaction: adverse,
        sessionNotes: notes || undefined,
        status,
        prePainScore: prePain !== "" ? parseInt(prePain, 10) : undefined,
        postPainScore: postPain !== "" ? parseInt(postPain, 10) : undefined
      };
      await api.createTherapySession(payload);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to record session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Record Therapy Session</h2>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Protocol</label>
              <select value={protocolId} onChange={(e) => { setProtocolId(e.target.value); setDosage({}); }}>
                {protocols.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Member</label>
              <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Branch</label>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Session Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as TherapySessionStatus)}>
                <option value="completed">Completed</option>
                <option value="in_progress">In Progress</option>
                <option value="interrupted">Interrupted</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Pre-Session Pain Score (0-10)</label>
              <input type="number" min="0" max="10" step="1" placeholder="e.g. 6" value={prePain} onChange={(e) => setPrePain(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Post-Session Pain Score (0-10)</label>
              <input type="number" min="0" max="10" step="1" placeholder="e.g. 1" value={postPain} onChange={(e) => setPostPain(e.target.value)} />
            </div>
          </div>

          {/* Dosage fields from protocol defaults */}
          {selectedProto && Object.keys(selectedProto.parameters).length > 0 && (
            <div className="dosage-entry">
              <label className="section-label">Actual Dosage Applied</label>
              <div className="metrics-entry-grid">
                {Object.entries(selectedProto.parameters).map(([k]) => (
                  <div key={k} className="form-group">
                    <label>{k.replace(/([A-Z])/g, " $1")}</label>
                    <input
                      type="text"
                      placeholder={String(selectedProto.parameters[k])}
                      value={dosage[k] !== undefined ? String(dosage[k]) : ""}
                      onChange={(e) => setDosageVal(k, e.target.value || String(selectedProto.parameters[k]))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Clinical Notes (optional)</label>
            <textarea rows={2} placeholder="Observations, member feedback, next steps…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <label className="checkbox-row">
            <input type="checkbox" checked={adverse} onChange={(e) => setAdverse(e.target.checked)} />
            <span>Adverse reaction reported</span>
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={submit} disabled={loading || !protocolId || !memberId || !branchId}>
              {loading ? "Saving…" : "Save Session"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 300; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .modal { background: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; width: 100%; max-width: 540px; display: flex; flex-direction: column; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .modal-header h2 { font-size: 1.1rem; font-weight: 800; color: white; }
        .modal-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: .85rem; }
        .modal-actions { display: flex; gap: .75rem; justify-content: flex-end; margin-top: .5rem; }
        .form-group { display: flex; flex-direction: column; gap: 5px; }
        .form-row { display: flex; gap: .75rem; }
        .form-row .form-group { flex: 1; min-width: 0; }
        .form-group label { font-size: .78rem; font-weight: 600; color: rgba(255,255,255,0.55); }
        .form-group input, .form-group select, .form-group textarea { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: .5rem .75rem; color: white; font-size: .85rem; outline: none; }
        .form-group input::placeholder, .form-group textarea::placeholder { color: rgba(255,255,255,0.2); }
        .form-group select option { background: #1a1b2e; }
        .form-error { color: #f87171; font-size: .8rem; }
        .section-label { font-size: .75rem; font-weight: 700; color: #a5b4fc; text-transform: uppercase; letter-spacing: 1px; }
        .metrics-entry-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .6rem; margin-top: .35rem; }
        .dosage-entry { display: flex; flex-direction: column; gap: .35rem; }
        .checkbox-row { display: flex; align-items: center; gap: .5rem; font-size: .84rem; color: rgba(255,255,255,0.65); cursor: pointer; }
        .checkbox-row input { accent-color: #8b5cf6; }
      `}</style>
    </div>
  );
}
