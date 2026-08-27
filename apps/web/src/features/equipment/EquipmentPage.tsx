import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api/client";
import type {
  EquipmentAssetResponse,
  EquipmentPoolResponse,
  EquipmentMaintenanceRecordResponse,
  CreateEquipmentAssetRequest,
  CreateMaintenanceRecordRequest
} from "@fitos/contracts";

const STATUS_META: Record<string, { label: string; color: string }> = {
  available: { label: "Available", color: "#22c55e" },
  in_use: { label: "In Use", color: "#3b82f6" },
  maintenance: { label: "Maintenance", color: "#f59e0b" },
  calibration_due: { label: "Calibration Due", color: "#f97316" },
  out_of_service: { label: "Out of Service", color: "#ef4444" },
  retired: { label: "Retired", color: "#6b7280" }
};

const MAINT_TYPE_META: Record<string, { label: string; color: string }> = {
  maintenance: { label: "Maintenance", color: "#6366f1" },
  calibration: { label: "Calibration", color: "#3b82f6" },
  inspection: { label: "Inspection", color: "#22c55e" },
  repair: { label: "Repair", color: "#f59e0b" }
};

function daysUntil(iso: string | null) {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return d;
}

function ServiceDue({ label, dateIso }: { label: string; dateIso: string | null }) {
  if (!dateIso) return null;
  const days = daysUntil(dateIso);
  const overdue = (days ?? 0) < 0;
  const soon = !overdue && (days ?? 999) <= 14;
  return (
    <div className={`service-due ${overdue ? "overdue" : soon ? "soon" : ""}`}>
      <span className="service-due-icon">{overdue ? "⚠" : soon ? "⏱" : "✓"}</span>
      <span>
        {label}: {overdue ? `${Math.abs(days ?? 0)}d overdue` : `${days}d`}
      </span>
    </div>
  );
}

type Tab = "assets" | "pools" | "maintenance";

export default function EquipmentPage() {
  const [tab, setTab] = useState<Tab>("assets");
  const [assets, setAssets] = useState<EquipmentAssetResponse[]>([]);
  const [pools, setPools] = useState<EquipmentPoolResponse[]>([]);
  const [maintenance, setMaintenance] = useState<EquipmentMaintenanceRecordResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<EquipmentAssetResponse | null>(null);
  const [showNewAsset, setShowNewAsset] = useState(false);
  const [showNewMaint, setShowNewMaint] = useState(false);
  const [maintAssetId, setMaintAssetId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [a, p, m] = await Promise.all([
        api.equipmentAssets(),
        api.equipmentPools(),
        api.equipmentMaintenance()
      ]);
      setAssets(a);
      setPools(p);
      setMaintenance(m);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const categories = Array.from(new Set(assets.map((a) => a.category)));
  const filtered = assets.filter((a) => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (filterCategory !== "all" && a.category !== filterCategory) return false;
    if (
      search &&
      !a.name.toLowerCase().includes(search.toLowerCase()) &&
      !a.assetCode.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div className="equip-page">
      <div className="equip-header">
        <div>
          <h1 className="equip-title">Equipment & Resources</h1>
          <p className="equip-subtitle">Asset registry, equipment pools, and maintenance log.</p>
        </div>
        <div className="equip-header-actions">
          <button className="btn-secondary" onClick={() => setShowNewMaint(true)}>
            + Log Maintenance
          </button>
          <button className="btn-primary" onClick={() => setShowNewAsset(true)}>
            + Add Asset
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="equip-stats">
        {(["available", "in_use", "maintenance", "out_of_service"] as const).map((s) => {
          const count = assets.filter((a) => a.status === s).length;
          const meta = STATUS_META[s] ?? { label: s, color: "#6366f1" };
          return (
            <div
              key={s}
              className="equip-stat-card"
              onClick={() => setFilterStatus(s === filterStatus ? "all" : s)}
              style={{ cursor: "pointer" }}
            >
              <div className="stat-dot" style={{ background: meta.color }} />
              <div>
                <div className="stat-count">{count}</div>
                <div className="stat-label">{meta.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="equip-tabs">
        {(["assets", "pools", "maintenance"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`equip-tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "assets"
              ? `Assets (${assets.length})`
              : t === "pools"
                ? `Pools (${pools.length})`
                : `Maintenance (${maintenance.length})`}
          </button>
        ))}
      </div>

      {tab === "assets" && (
        <>
          <div className="equip-filters">
            <input
              type="text"
              placeholder="Search assets…"
              className="filter-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <select
              className="filter-select"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="equip-loading">Loading assets…</div>
          ) : (
            <div className="asset-grid">
              {filtered.map((asset) => {
                const meta = STATUS_META[asset.status] ?? { label: asset.status, color: "#6366f1" };
                const nextService = daysUntil(asset.nextServiceDueAt);
                const nextCal = daysUntil(asset.nextCalibrationDueAt);
                const urgent =
                  (nextService !== null && nextService <= 7) || (nextCal !== null && nextCal <= 7);
                return (
                  <div
                    key={asset.id}
                    className={`asset-card ${urgent ? "urgent" : ""}`}
                    onClick={() => setSelectedAsset(asset)}
                  >
                    <div className="asset-card-header">
                      <div className="asset-code">{asset.assetCode}</div>
                      <span
                        className="asset-status-badge"
                        style={{
                          background: `${meta.color}20`,
                          color: meta.color,
                          borderColor: `${meta.color}40`
                        }}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <h3 className="asset-name">{asset.name}</h3>
                    <div className="asset-meta">
                      <span className="asset-category">{asset.category}</span>
                      {asset.roomName && <span className="asset-room">{asset.roomName}</span>}
                    </div>
                    <div className="asset-model">{asset.modelName}</div>
                    <div className="asset-service-row">
                      {asset.nextServiceDueAt && (
                        <ServiceDue label="Service" dateIso={asset.nextServiceDueAt} />
                      )}
                      {asset.nextCalibrationDueAt && (
                        <ServiceDue label="Calibration" dateIso={asset.nextCalibrationDueAt} />
                      )}
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="equip-empty">No assets match your filters.</div>
              )}
            </div>
          )}
        </>
      )}

      {tab === "pools" && (
        <div className="pool-grid">
          {pools.map((pool) => (
            <div key={pool.id} className="pool-card">
              <div className="pool-header">
                <h3 className="pool-name">{pool.name}</h3>
                <span className="pool-category">{pool.category}</span>
              </div>
              <div className="pool-stats">
                <div className="pool-stat">
                  <div className="pool-stat-val">{pool.availableQuantity}</div>
                  <div className="pool-stat-label">Available</div>
                </div>
                <div className="pool-stat">
                  <div className="pool-stat-val">{pool.totalQuantity - pool.availableQuantity}</div>
                  <div className="pool-stat-label">In Use</div>
                </div>
                <div className="pool-stat">
                  <div className="pool-stat-val">{pool.totalQuantity}</div>
                  <div className="pool-stat-label">Total</div>
                </div>
              </div>
              <div className="pool-bar-track">
                <div
                  className="pool-bar-fill"
                  style={{ width: `${(pool.availableQuantity / pool.totalQuantity) * 100}%` }}
                />
              </div>
              <div className="pool-branch">{pool.branchName}</div>
            </div>
          ))}
          {pools.length === 0 && <div className="equip-empty">No equipment pools configured.</div>}
        </div>
      )}

      {tab === "maintenance" && (
        <div className="maint-list">
          {maintenance.map((record) => {
            const meta = MAINT_TYPE_META[record.type] ?? { label: record.type, color: "#6366f1" };
            return (
              <div key={record.id} className="maint-row">
                <div
                  className="maint-type-badge"
                  style={{
                    background: `${meta.color}15`,
                    color: meta.color,
                    borderColor: `${meta.color}30`
                  }}
                >
                  {meta.label}
                </div>
                <div className="maint-info">
                  <div className="maint-asset">{record.assetName}</div>
                  <div className="maint-notes">{record.notes}</div>
                  <div className="maint-by">By {record.performedBy}</div>
                </div>
                <div className="maint-right">
                  <div className="maint-date">
                    {new Date(record.performedAt).toLocaleDateString("en-KE", {
                      dateStyle: "medium"
                    })}
                  </div>
                  {record.nextDueAt && (
                    <div className="maint-next">
                      Next:{" "}
                      {new Date(record.nextDueAt).toLocaleDateString("en-KE", {
                        dateStyle: "medium"
                      })}
                    </div>
                  )}
                  {record.costMinor != null && (
                    <div className="maint-cost">
                      {(record.costMinor / 100).toLocaleString("en-KE", {
                        style: "currency",
                        currency: "KES",
                        maximumFractionDigits: 0
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {maintenance.length === 0 && (
            <div className="equip-empty">No maintenance records yet.</div>
          )}
        </div>
      )}

      {/* Asset Detail Drawer */}
      {selectedAsset && (
        <div className="drawer-overlay" onClick={() => setSelectedAsset(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <div className="drawer-code">{selectedAsset.assetCode}</div>
                <h2 className="drawer-title">{selectedAsset.name}</h2>
              </div>
              <button className="drawer-close" onClick={() => setSelectedAsset(null)}>
                ✕
              </button>
            </div>
            <div className="drawer-body">
              <div className="drawer-field-grid">
                <div className="drawer-field">
                  <span>Model</span>
                  <strong>{selectedAsset.modelName}</strong>
                </div>
                <div className="drawer-field">
                  <span>Category</span>
                  <strong>{selectedAsset.category}</strong>
                </div>
                <div className="drawer-field">
                  <span>Status</span>
                  <strong style={{ color: STATUS_META[selectedAsset.status]?.color }}>
                    {STATUS_META[selectedAsset.status]?.label}
                  </strong>
                </div>
                {selectedAsset.serialNumber && (
                  <div className="drawer-field">
                    <span>Serial</span>
                    <strong>{selectedAsset.serialNumber}</strong>
                  </div>
                )}
                {selectedAsset.branchName && (
                  <div className="drawer-field">
                    <span>Branch</span>
                    <strong>{selectedAsset.branchName}</strong>
                  </div>
                )}
                {selectedAsset.roomName && (
                  <div className="drawer-field">
                    <span>Room</span>
                    <strong>{selectedAsset.roomName}</strong>
                  </div>
                )}
                {selectedAsset.purchaseDate && (
                  <div className="drawer-field">
                    <span>Purchased</span>
                    <strong>
                      {new Date(selectedAsset.purchaseDate).toLocaleDateString("en-KE", {
                        dateStyle: "medium"
                      })}
                    </strong>
                  </div>
                )}
                {selectedAsset.warrantyEndsAt && (
                  <div className="drawer-field">
                    <span>Warranty Ends</span>
                    <strong>
                      {new Date(selectedAsset.warrantyEndsAt).toLocaleDateString("en-KE", {
                        dateStyle: "medium"
                      })}
                    </strong>
                  </div>
                )}
                {selectedAsset.lastServicedAt && (
                  <div className="drawer-field">
                    <span>Last Serviced</span>
                    <strong>
                      {new Date(selectedAsset.lastServicedAt).toLocaleDateString("en-KE", {
                        dateStyle: "medium"
                      })}
                    </strong>
                  </div>
                )}
                {selectedAsset.nextServiceDueAt && (
                  <div className="drawer-field">
                    <span>Next Service</span>
                    <strong>
                      {new Date(selectedAsset.nextServiceDueAt).toLocaleDateString("en-KE", {
                        dateStyle: "medium"
                      })}
                    </strong>
                  </div>
                )}
                {selectedAsset.lastCalibratedAt && (
                  <div className="drawer-field">
                    <span>Last Calibrated</span>
                    <strong>
                      {new Date(selectedAsset.lastCalibratedAt).toLocaleDateString("en-KE", {
                        dateStyle: "medium"
                      })}
                    </strong>
                  </div>
                )}
                {selectedAsset.nextCalibrationDueAt && (
                  <div className="drawer-field">
                    <span>Next Calibration</span>
                    <strong>
                      {new Date(selectedAsset.nextCalibrationDueAt).toLocaleDateString("en-KE", {
                        dateStyle: "medium"
                      })}
                    </strong>
                  </div>
                )}
              </div>
              {selectedAsset.notes && (
                <div className="drawer-notes">
                  <span>Notes</span>
                  <p>{selectedAsset.notes}</p>
                </div>
              )}
              <div className="drawer-related-maint">
                <h4>Maintenance History</h4>
                {maintenance
                  .filter((m) => m.assetId === selectedAsset.id)
                  .map((r) => (
                    <div key={r.id} className="mini-maint-row">
                      <span
                        className="mini-maint-type"
                        style={{ color: MAINT_TYPE_META[r.type]?.color }}
                      >
                        {r.type}
                      </span>
                      <span>
                        {r.notes.slice(0, 60)}
                        {r.notes.length > 60 ? "…" : ""}
                      </span>
                      <span className="mini-maint-date">
                        {new Date(r.performedAt).toLocaleDateString("en-KE", {
                          dateStyle: "short"
                        })}
                      </span>
                    </div>
                  ))}
                {maintenance.filter((m) => m.assetId === selectedAsset.id).length === 0 && (
                  <p className="mini-maint-empty">No records for this asset.</p>
                )}
              </div>
              <button
                className="btn-log-maint"
                onClick={() => {
                  setMaintAssetId(selectedAsset.id);
                  setShowNewMaint(true);
                }}
              >
                + Log Maintenance Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Asset Modal */}
      {showNewAsset && (
        <NewAssetModal
          onClose={() => setShowNewAsset(false)}
          onCreated={() => {
            setShowNewAsset(false);
            void reload();
          }}
        />
      )}

      {/* New Maintenance Modal */}
      {showNewMaint && (
        <NewMaintenanceModal
          assets={assets}
          defaultAssetId={maintAssetId}
          onClose={() => {
            setShowNewMaint(false);
            setMaintAssetId("");
          }}
          onCreated={() => {
            setShowNewMaint(false);
            setMaintAssetId("");
            void reload();
          }}
        />
      )}

      <style>{`
        .equip-page { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
        .equip-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
        .equip-title { font-size: 1.7rem; font-weight: 800; color: white; margin-bottom: .35rem; }
        .equip-subtitle { color: rgba(255,255,255,0.45); }
        .equip-header-actions { display: flex; gap: .75rem; }
        .btn-primary { padding: .6rem 1.25rem; border-radius: 10px; font-size: .85rem; font-weight: 700; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: white; border: none; cursor: pointer; transition: all .2s; }
        .btn-primary:hover { opacity: .9; transform: translateY(-1px); }
        .btn-secondary { padding: .6rem 1.25rem; border-radius: 10px; font-size: .85rem; font-weight: 600; background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.12); cursor: pointer; transition: all .2s; }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); }

        .equip-stats { display: flex; gap: 1rem; flex-wrap: wrap; }
        .equip-stat-card {
          display: flex; align-items: center; gap: .75rem;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; padding: .85rem 1.25rem; flex: 1; min-width: 120px;
          transition: border-color .2s;
        }
        .equip-stat-card:hover { border-color: rgba(255,255,255,0.15); }
        .stat-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .stat-count { font-size: 1.5rem; font-weight: 800; color: white; line-height: 1; }
        .stat-label { font-size: .72rem; color: rgba(255,255,255,0.4); }

        .equip-tabs { display: flex; gap: .25rem; background: rgba(255,255,255,0.04); border-radius: 12px; padding: .35rem; border: 1px solid rgba(255,255,255,0.07); align-self: flex-start; }
        .equip-tab { padding: .45rem 1rem; border-radius: 8px; font-size: .82rem; font-weight: 600; color: rgba(255,255,255,0.45); background: none; border: none; cursor: pointer; transition: all .2s; }
        .equip-tab.active { background: rgba(99,102,241,0.25); color: #a5b4fc; }

        .equip-filters { display: flex; gap: .75rem; flex-wrap: wrap; }
        .filter-search, .filter-select {
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px; padding: .5rem .85rem; color: white; font-size: .85rem; outline: none;
        }
        .filter-search { flex: 1; min-width: 180px; }
        .filter-search::placeholder { color: rgba(255,255,255,0.3); }
        .filter-select option { background: #1a1b2e; }
        .filter-search:focus, .filter-select:focus { border-color: rgba(99,102,241,0.6); }

        .equip-loading, .equip-empty { color: rgba(255,255,255,0.35); text-align: center; padding: 3rem; font-size: .9rem; }

        .asset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
        .asset-card {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px; padding: 1.25rem; cursor: pointer;
          transition: all .2s; display: flex; flex-direction: column; gap: .5rem;
        }
        .asset-card:hover { border-color: rgba(99,102,241,0.4); transform: translateY(-2px); }
        .asset-card.urgent { border-color: rgba(251,146,60,0.4); }
        .asset-card-header { display: flex; align-items: center; justify-content: space-between; }
        .asset-code { font-size: .7rem; font-weight: 700; color: rgba(255,255,255,0.35); letter-spacing: 1px; }
        .asset-status-badge { font-size: .65rem; font-weight: 700; padding: .15rem .5rem; border-radius: 99px; border: 1px solid; }
        .asset-name { font-size: .9rem; font-weight: 700; color: white; line-height: 1.3; }
        .asset-meta { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
        .asset-category { font-size: .7rem; background: rgba(99,102,241,0.12); color: #a5b4fc; border-radius: 6px; padding: .15rem .5rem; }
        .asset-room { font-size: .7rem; color: rgba(255,255,255,0.35); }
        .asset-model { font-size: .75rem; color: rgba(255,255,255,0.4); }
        .asset-service-row { display: flex; flex-direction: column; gap: .25rem; margin-top: .25rem; }
        .service-due { display: flex; align-items: center; gap: .35rem; font-size: .72rem; color: rgba(255,255,255,0.45); }
        .service-due.soon { color: #fb923c; }
        .service-due.overdue { color: #f87171; }
        .service-due-icon { font-size: .8rem; }

        .pool-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
        .pool-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 1.25rem; display: flex; flex-direction: column; gap: .85rem; }
        .pool-header { display: flex; flex-direction: column; gap: .35rem; }
        .pool-name { font-size: .95rem; font-weight: 700; color: white; }
        .pool-category { font-size: .7rem; color: rgba(255,255,255,0.4); }
        .pool-stats { display: flex; gap: 1rem; }
        .pool-stat { text-align: center; flex: 1; }
        .pool-stat-val { font-size: 1.5rem; font-weight: 800; color: white; }
        .pool-stat-label { font-size: .65rem; color: rgba(255,255,255,0.35); }
        .pool-bar-track { height: 4px; background: rgba(255,255,255,0.08); border-radius: 99px; }
        .pool-bar-fill { height: 100%; background: linear-gradient(90deg,#22c55e,#4ade80); border-radius: 99px; transition: width .5s; }
        .pool-branch { font-size: .75rem; color: rgba(255,255,255,0.3); }

        .maint-list { display: flex; flex-direction: column; gap: .75rem; }
        .maint-row {
          display: flex; align-items: center; gap: 1rem;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 1rem 1.25rem; flex-wrap: wrap;
        }
        .maint-type-badge { font-size: .7rem; font-weight: 700; padding: .25rem .65rem; border-radius: 99px; border: 1px solid; flex-shrink: 0; white-space: nowrap; }
        .maint-info { flex: 1; min-width: 0; }
        .maint-asset { font-size: .9rem; font-weight: 600; color: white; }
        .maint-notes { font-size: .78rem; color: rgba(255,255,255,0.45); margin-top: 2px; }
        .maint-by { font-size: .73rem; color: rgba(255,255,255,0.3); margin-top: 2px; }
        .maint-right { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
        .maint-date { font-size: .8rem; color: rgba(255,255,255,0.55); font-weight: 600; }
        .maint-next { font-size: .73rem; color: rgba(255,255,255,0.35); }
        .maint-cost { font-size: .78rem; font-weight: 600; color: #4ade80; }

        /* Drawer */
        .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200; display: flex; justify-content: flex-end; }
        .drawer { width: min(480px, 100vw); height: 100%; background: #111827; border-left: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; overflow: hidden; }
        .drawer-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 1.5rem 1.5rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .drawer-code { font-size: .7rem; font-weight: 700; color: rgba(255,255,255,0.35); letter-spacing: 1px; margin-bottom: .25rem; }
        .drawer-title { font-size: 1.1rem; font-weight: 800; color: white; line-height: 1.3; }
        .drawer-close { background: rgba(255,255,255,0.08); border: none; color: rgba(255,255,255,0.6); width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: .9rem; flex-shrink: 0; }
        .drawer-body { flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
        .drawer-field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
        .drawer-field { display: flex; flex-direction: column; gap: 3px; }
        .drawer-field span { font-size: .7rem; color: rgba(255,255,255,0.35); }
        .drawer-field strong { font-size: .85rem; color: white; }
        .drawer-notes { display: flex; flex-direction: column; gap: .4rem; }
        .drawer-notes span { font-size: .7rem; color: rgba(255,255,255,0.35); }
        .drawer-notes p { font-size: .83rem; color: rgba(255,255,255,0.65); line-height: 1.5; }
        .drawer-related-maint h4 { font-size: .8rem; font-weight: 700; color: rgba(255,255,255,0.6); margin-bottom: .75rem; }
        .mini-maint-row { display: flex; align-items: center; gap: .75rem; padding: .5rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: .78rem; color: rgba(255,255,255,0.55); }
        .mini-maint-type { font-weight: 700; flex-shrink: 0; }
        .mini-maint-date { color: rgba(255,255,255,0.35); margin-left: auto; flex-shrink: 0; }
        .mini-maint-empty { font-size: .8rem; color: rgba(255,255,255,0.3); }
        .btn-log-maint { padding: .65rem 1.25rem; border-radius: 10px; font-size: .85rem; font-weight: 700; background: rgba(99,102,241,0.15); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.25); cursor: pointer; transition: all .2s; }
        .btn-log-maint:hover { background: rgba(99,102,241,0.25); }
      `}</style>
    </div>
  );
}

// ── New Asset Modal ──────────────────────────────────────────────────────────
function NewAssetModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "",
    assetCode: "",
    modelName: "",
    category: "Fitness Equipment",
    branchId: "",
    status: "available",
    notes: ""
  } as Partial<CreateEquipmentAssetRequest>);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    api.branches().then((b) => setBranches(b.map((br) => ({ id: br.id, name: br.name }))));
  }, []);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.createEquipmentAsset(form as CreateEquipmentAssetRequest);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create asset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Equipment Asset</h2>
          <button className="drawer-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Asset Name</label>
            <input
              type="text"
              placeholder="Balanced Body Reformer"
              value={form.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Asset Code</label>
              <input
                type="text"
                placeholder="REF-001"
                value={form.assetCode ?? ""}
                onChange={(e) => set("assetCode", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Model</label>
              <input
                type="text"
                placeholder="Allegro 2"
                value={form.modelName ?? ""}
                onChange={(e) => set("modelName", e.target.value)}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <input
                type="text"
                placeholder="Pilates & Core"
                value={form.category ?? ""}
                onChange={(e) => set("category", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Branch</label>
              <select value={form.branchId ?? ""} onChange={(e) => set("branchId", e.target.value)}>
                <option value="">Select branch…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea
              rows={2}
              placeholder="Additional notes…"
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={submit}
              disabled={loading || !form.name || !form.branchId}
            >
              {loading ? "Saving…" : "Add Asset"}
            </button>
          </div>
        </div>
        <style>{`
          .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 300; display: flex; align-items: center; justify-content: center; padding: 1rem; }
          .modal { background: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; width: 100%; max-width: 480px; display: flex; flex-direction: column; }
          .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
          .modal-header h2 { font-size: 1.1rem; font-weight: 800; color: white; }
          .modal-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: .85rem; }
          .modal-actions { display: flex; gap: .75rem; justify-content: flex-end; margin-top: .5rem; }
          .form-group { display: flex; flex-direction: column; gap: 5px; }
          .form-row { display: flex; gap: .75rem; }
          .form-row .form-group { flex: 1; }
          .form-group label { font-size: .78rem; font-weight: 600; color: rgba(255,255,255,0.55); }
          .form-group input, .form-group select, .form-group textarea { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: .5rem .75rem; color: white; font-size: .85rem; outline: none; resize: vertical; }
          .form-group input::placeholder, .form-group textarea::placeholder { color: rgba(255,255,255,0.2); }
          .form-group select option { background: #1a1b2e; }
          .form-error { color: #f87171; font-size: .8rem; }
        `}</style>
      </div>
    </div>
  );
}

// ── New Maintenance Modal ────────────────────────────────────────────────────
function NewMaintenanceModal({
  assets,
  defaultAssetId,
  onClose,
  onCreated
}: {
  assets: EquipmentAssetResponse[];
  defaultAssetId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<Partial<CreateMaintenanceRecordRequest>>({
    assetId: defaultAssetId,
    type: "maintenance",
    performedBy: "",
    notes: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.createEquipmentMaintenance(form as CreateMaintenanceRecordRequest);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to log maintenance.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Log Maintenance Record</h2>
          <button className="drawer-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Asset</label>
            <select value={form.assetId ?? ""} onChange={(e) => set("assetId", e.target.value)}>
              <option value="">Select asset…</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select
                value={form.type ?? "maintenance"}
                onChange={(e) => set("type", e.target.value)}
              >
                {Object.entries(MAINT_TYPE_META).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Performed By</label>
              <input
                type="text"
                placeholder="Technician name"
                value={form.performedBy ?? ""}
                onChange={(e) => set("performedBy", e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea
              rows={3}
              placeholder="What was done?"
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Cost (KES, optional)</label>
              <input
                type="number"
                placeholder="0"
                min={0}
                value={form.costMinor != null ? form.costMinor / 100 : ""}
                onChange={(e) =>
                  set("costMinor", Math.round(parseFloat(e.target.value) * 100) || 0)
                }
              />
            </div>
            <div className="form-group">
              <label>Next Due Date (optional)</label>
              <input
                type="date"
                value={form.nextDueAt ? form.nextDueAt.slice(0, 10) : ""}
                onChange={(e) => set("nextDueAt", new Date(e.target.value).toISOString())}
              />
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={submit}
              disabled={loading || !form.assetId || !form.performedBy || !form.notes}
            >
              {loading ? "Saving…" : "Log Record"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
