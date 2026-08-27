import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api/client";
import type {
  InventoryItemResponse,
  InventoryMovementResponse,
  PurchaseOrderResponse,
  CreateInventoryItemRequest,
  CreateInventoryMovementRequest,
  CreatePurchaseOrderRequest,
  InventoryMovementType
} from "@fitos/contracts";

const MOVEMENT_LABELS: Record<
  InventoryMovementType,
  { label: string; color: string; sign: string }
> = {
  purchase_in: { label: "Purchase In", color: "#22c55e", sign: "+" },
  sale_out: { label: "Retail Sale", color: "#6366f1", sign: "-" },
  session_usage: { label: "Session Consumed", color: "#f59e0b", sign: "-" },
  adjustment: { label: "Stock Adjustment", color: "#3b82f6", sign: "±" },
  transfer: { label: "Branch Transfer", color: "#8b5cf6", sign: "↔" },
  waste: { label: "Waste / Expired", color: "#ef4444", sign: "-" }
};

type Tab = "items" | "movements" | "po" | "lots" | "stocktake";

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("items");
  const [items, setItems] = useState<InventoryItemResponse[]>([]);
  const [movements, setMovements] = useState<InventoryMovementResponse[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderResponse[]>([]);
  const [lots, setLots] = useState<import("@fitos/contracts").InventoryLotResponse[]>([]);
  const [stocktakes, setStocktakes] = useState<import("@fitos/contracts").StocktakeResponse[]>([]);
  const [selectedStocktake, setSelectedStocktake] = useState<
    import("@fitos/contracts").StocktakeResponse | null
  >(null);
  const [showNewLot, setShowNewLot] = useState(false);
  const [showNewStocktake, setShowNewStocktake] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedItem, setSelectedItem] = useState<InventoryItemResponse | null>(null);
  const [showNewItem, setShowNewItem] = useState(false);
  const [showNewMovement, setShowNewMovement] = useState(false);
  const [showNewPO, setShowNewPO] = useState(false);
  const [movementItemId, setMovementItemId] = useState<string>("");

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "retail" | "consumable" | "low_stock">(
    "all"
  );
  const [filterCategory, setFilterCategory] = useState("all");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [i, m, p, l, s] = await Promise.all([
        api.inventoryItems(),
        api.inventoryMovements(),
        api.purchaseOrders(),
        api.inventoryLots(),
        api.stocktakes()
      ]);
      setItems(i);
      setMovements(m);
      setPurchaseOrders(p);
      setLots(l);
      setStocktakes(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const categories = Array.from(new Set(items.map((i) => i.category)));
  const lowStockCount = items.filter((i) => i.stockOnHand <= i.reorderPoint).length;
  const totalStockValueMinor = items.reduce((acc, i) => acc + i.stockOnHand * i.unitCostMinor, 0);

  const filtered = items.filter((item) => {
    if (filterType === "retail" && !item.isRetail) return false;
    if (filterType === "consumable" && !item.isConsumable) return false;
    if (filterType === "low_stock" && item.stockOnHand > item.reorderPoint) return false;
    if (filterCategory !== "all" && item.category !== filterCategory) return false;
    if (
      search &&
      !item.name.toLowerCase().includes(search.toLowerCase()) &&
      !item.sku.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div className="inv-page">
      <div className="inv-header">
        <div>
          <h1 className="inv-title">Inventory & Stock</h1>
          <p className="inv-subtitle">
            Manage retail merchandise, therapy consumables, and purchase orders.
          </p>
        </div>
        <div className="inv-header-actions">
          <button className="btn-secondary" onClick={() => setShowNewPO(true)}>
            + New Purchase Order
          </button>
          <button className="btn-secondary" onClick={() => setShowNewMovement(true)}>
            + Record Movement
          </button>
          <button className="btn-primary" onClick={() => setShowNewItem(true)}>
            + Add Item
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="inv-stats">
        <div className="inv-stat-card">
          <div className="stat-label">Total Stock Value</div>
          <div className="stat-value">
            {(totalStockValueMinor / 100).toLocaleString("en-KE", {
              style: "currency",
              currency: "KES",
              maximumFractionDigits: 0
            })}
          </div>
          <div className="stat-sub">{items.length} unique SKUs</div>
        </div>
        <div
          className="inv-stat-card"
          onClick={() => setFilterType("low_stock")}
          style={{ cursor: "pointer" }}
        >
          <div className="stat-label">Low Stock Alerts</div>
          <div className={`stat-value ${lowStockCount > 0 ? "warn" : ""}`}>{lowStockCount}</div>
          <div className="stat-sub">
            {lowStockCount > 0 ? "Requires reordering" : "All stock healthy"}
          </div>
        </div>
        <div className="inv-stat-card">
          <div className="stat-label">Purchase Orders</div>
          <div className="stat-value">{purchaseOrders.length}</div>
          <div className="stat-sub">
            {purchaseOrders.filter((p) => p.status === "ordered").length} pending delivery
          </div>
        </div>
        <div className="inv-stat-card">
          <div className="stat-label">Movements (30d)</div>
          <div className="stat-value">{movements.length}</div>
          <div className="stat-sub">Stock ledger transactions</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="inv-tabs">
        <button
          className={`inv-tab ${tab === "items" ? "active" : ""}`}
          onClick={() => setTab("items")}
        >
          Stock Registry ({items.length})
        </button>
        <button
          className={`inv-tab ${tab === "lots" ? "active" : ""}`}
          onClick={() => setTab("lots")}
        >
          Inventory Lots ({lots.length})
        </button>
        <button
          className={`inv-tab ${tab === "stocktake" ? "active" : ""}`}
          onClick={() => setTab("stocktake")}
        >
          Stocktakes ({stocktakes.length})
        </button>
        <button
          className={`inv-tab ${tab === "movements" ? "active" : ""}`}
          onClick={() => setTab("movements")}
        >
          Movements Ledger ({movements.length})
        </button>
        <button className={`inv-tab ${tab === "po" ? "active" : ""}`} onClick={() => setTab("po")}>
          Purchase Orders ({purchaseOrders.length})
        </button>
      </div>

      {tab === "items" && (
        <>
          <div className="inv-filters">
            <input
              type="text"
              placeholder="Search by SKU or name…"
              className="filter-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="filter-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            >
              <option value="all">All Types</option>
              <option value="retail">Retail Items</option>
              <option value="consumable">Consumables & Supplies</option>
              <option value="low_stock">Low Stock Only</option>
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
            <div className="inv-loading">Loading inventory…</div>
          ) : (
            <div className="item-grid">
              {filtered.map((item) => {
                const isLow = item.stockOnHand <= item.reorderPoint;
                const margin =
                  item.retailPriceMinor > 0
                    ? Math.round(
                        ((item.retailPriceMinor - item.unitCostMinor) / item.retailPriceMinor) * 100
                      )
                    : null;
                return (
                  <div
                    key={item.id}
                    className={`item-card ${isLow ? "low-stock" : ""}`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="item-card-top">
                      <span className="item-sku">{item.sku}</span>
                      <div className="item-badges">
                        {item.isRetail && <span className="badge-retail">Retail</span>}
                        {item.isConsumable && <span className="badge-consumable">Consumable</span>}
                      </div>
                    </div>
                    <h3 className="item-name">{item.name}</h3>
                    <div className="item-category">{item.category}</div>

                    <div className="stock-level-row">
                      <div className="stock-count-box">
                        <span className={`stock-count ${isLow ? "low" : ""}`}>
                          {item.stockOnHand}
                        </span>
                        <span className="stock-unit">{item.unit}s in stock</span>
                      </div>
                      {isLow && (
                        <span className="reorder-badge">Reorder Point: {item.reorderPoint}</span>
                      )}
                    </div>

                    <div className="item-prices">
                      <div>
                        <span className="price-label">Cost</span>
                        <span className="price-val">
                          KES {(item.unitCostMinor / 100).toLocaleString()}
                        </span>
                      </div>
                      {item.isRetail && item.retailPriceMinor > 0 && (
                        <div>
                          <span className="price-label">Retail ({margin}% margin)</span>
                          <span className="price-val retail">
                            KES {(item.retailPriceMinor / 100).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="inv-empty">No inventory items match your filters.</div>
              )}
            </div>
          )}
        </>
      )}

      {tab === "movements" && (
        <div className="mvt-list">
          {movements.map((m) => {
            const meta = MOVEMENT_LABELS[m.movementType] ?? {
              label: m.movementType,
              color: "#6366f1",
              sign: ""
            };
            return (
              <div key={m.id} className="mvt-row">
                <div
                  className="mvt-badge"
                  style={{
                    background: `${meta.color}15`,
                    color: meta.color,
                    borderColor: `${meta.color}35`
                  }}
                >
                  {meta.label}
                </div>
                <div className="mvt-info">
                  <div className="mvt-item">{m.itemName}</div>
                  {m.notes && <div className="mvt-notes">{m.notes}</div>}
                  <div className="mvt-by">Recorded by {m.recordedByName ?? "Staff"}</div>
                </div>
                <div className="mvt-qty-col">
                  <div className={`mvt-qty ${m.quantity > 0 ? "pos" : "neg"}`}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </div>
                  <div className="mvt-date">
                    {new Date(m.recordedAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}
                  </div>
                </div>
              </div>
            );
          })}
          {movements.length === 0 && (
            <div className="inv-empty">No inventory movements recorded yet.</div>
          )}
        </div>
      )}

      {tab === "lots" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
              Showing batch lots with expiry dates and on-hand tracking.
            </span>
            <button className="btn-primary" onClick={() => setShowNewLot(true)}>
              + Receive Lot
            </button>
          </div>
          <div
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              borderRadius: "0.75rem",
              border: "1px solid rgba(255,255,255,0.08)",
              overflow: "hidden"
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: "0.9rem"
              }}
            >
              <thead
                style={{
                  background: "rgba(30, 41, 59, 0.6)",
                  borderBottom: "1px solid rgba(255,255,255,0.08)"
                }}
              >
                <tr>
                  <th style={{ padding: "0.75rem 1rem" }}>Lot Code</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Item SKU / Name</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Received Qty</th>
                  <th style={{ padding: "0.75rem 1rem" }}>On Hand</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Expires On</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Received Date</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((l) => {
                  const item = items.find((i) => i.id === l.itemId);
                  const isExpiringSoon =
                    l.expiresOn && new Date(l.expiresOn).getTime() - Date.now() < 30 * 86400000;
                  return (
                    <tr key={l.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#60a5fa" }}>
                        {l.lotCode || "—"}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        {item ? `${item.sku} · ${item.name}` : l.itemId}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>{l.quantityReceived}</td>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>
                        {l.quantityOnHand}
                      </td>
                      <td
                        style={{
                          padding: "0.75rem 1rem",
                          color: isExpiringSoon ? "#f87171" : "#94a3b8"
                        }}
                      >
                        {l.expiresOn
                          ? `${l.expiresOn} ${isExpiringSoon ? "⚠️ Expiring" : ""}`
                          : "No Expiry"}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#64748b" }}>
                        {new Date(l.receivedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
                {lots.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}
                    >
                      No inventory lots received yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "stocktake" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {!selectedStocktake ? (
            <>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
                  Reconcile physical inventory counts against system records.
                </span>
                <button
                  className="btn-primary"
                  onClick={async () => {
                    const created = await api.createStocktake({});
                    setStocktakes((prev) => [created, ...prev]);
                    setSelectedStocktake(created);
                  }}
                >
                  + Start New Stocktake
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "1rem"
                }}
              >
                {stocktakes.map((st) => (
                  <div
                    key={st.id}
                    onClick={() => setSelectedStocktake(st)}
                    style={{
                      background: "rgba(30, 41, 59, 0.6)",
                      padding: "1.25rem",
                      borderRadius: "0.75rem",
                      border: "1px solid rgba(255,255,255,0.08)",
                      cursor: "pointer"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.5rem"
                      }}
                    >
                      <strong style={{ fontSize: "1rem" }}>Stocktake #{st.id.slice(0, 8)}</strong>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "0.25rem",
                          background:
                            st.status === "completed"
                              ? "rgba(16, 185, 129, 0.2)"
                              : "rgba(245, 158, 11, 0.2)",
                          color: st.status === "completed" ? "#34d399" : "#fbbf24"
                        }}
                      >
                        {st.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                      {st.lines.length} items counted
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.5rem" }}>
                      Created {new Date(st.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
                {stocktakes.length === 0 && (
                  <div
                    style={{
                      padding: "2rem",
                      color: "#64748b",
                      textAlign: "center",
                      gridColumn: "1 / -1"
                    }}
                  >
                    No stocktakes performed yet.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div
              style={{
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "0.75rem",
                padding: "1.5rem"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1.5rem"
                }}
              >
                <div>
                  <button
                    onClick={() => setSelectedStocktake(null)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#60a5fa",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      marginBottom: "0.25rem"
                    }}
                  >
                    ← Back to Stocktakes
                  </button>
                  <h3 style={{ margin: 0 }}>Stocktake #{selectedStocktake.id.slice(0, 8)}</h3>
                </div>
                {selectedStocktake.status !== "completed" && (
                  <button
                    className="btn-primary"
                    onClick={async () => {
                      const completed = await api.completeStocktake(selectedStocktake.id);
                      setSelectedStocktake(completed);
                      void reload();
                    }}
                  >
                    Complete & Post Adjustments
                  </button>
                )}
              </div>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "0.9rem"
                }}
              >
                <thead style={{ background: "rgba(30, 41, 59, 0.6)" }}>
                  <tr>
                    <th style={{ padding: "0.75rem 1rem" }}>Item</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Expected Stock</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Physical Count</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedStocktake.lines.map((line) => (
                    <tr key={line.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>
                        {line.itemName || line.itemId}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>{line.expectedQuantity}</td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        {selectedStocktake.status === "completed" ? (
                          (line.countedQuantity ?? "—")
                        ) : (
                          <input
                            type="number"
                            defaultValue={line.countedQuantity ?? ""}
                            onBlur={async (e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) {
                                const updated = await api.recordStocktakeCount(
                                  selectedStocktake.id,
                                  { itemId: line.itemId, countedQuantity: val }
                                );
                                setSelectedStocktake(updated);
                              }
                            }}
                            style={{ width: "80px", padding: "0.3rem", borderRadius: "0.3rem" }}
                          />
                        )}
                      </td>
                      <td
                        style={{
                          padding: "0.75rem 1rem",
                          fontWeight: 600,
                          color:
                            (line.variance ?? 0) < 0
                              ? "#f87171"
                              : (line.variance ?? 0) > 0
                                ? "#34d399"
                                : "#94a3b8"
                        }}
                      >
                        {line.variance !== null
                          ? `${line.variance > 0 ? "+" : ""}${line.variance}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "po" && (
        <div className="po-grid">
          {purchaseOrders.map((po) => (
            <div key={po.id} className="po-card">
              <div className="po-card-header">
                <div>
                  <span className="po-num">{po.poNumber}</span>
                  <h3 className="po-supplier">{po.supplierName}</h3>
                </div>
                <span className={`po-status ${po.status}`}>{po.status}</span>
              </div>
              <div className="po-items-list">
                {po.items.map((i, idx) => (
                  <div key={idx} className="po-item-line">
                    <span>
                      {i.quantity}x {i.itemName}
                    </span>
                    <span>KES {(i.totalMinor / 100).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="po-footer">
                <div className="po-total">
                  <span>Total</span>
                  <strong>KES {(po.totalMinor / 100).toLocaleString()}</strong>
                </div>
                <div className="po-date">
                  {po.orderedAt &&
                    `Ordered ${new Date(po.orderedAt).toLocaleDateString("en-KE", { dateStyle: "short" })}`}
                  {po.receivedAt &&
                    ` • Received ${new Date(po.receivedAt).toLocaleDateString("en-KE", { dateStyle: "short" })}`}
                </div>
              </div>
            </div>
          ))}
          {purchaseOrders.length === 0 && (
            <div className="inv-empty">No purchase orders found.</div>
          )}
        </div>
      )}

      {/* Item Detail Drawer */}
      {selectedItem && (
        <div className="drawer-overlay" onClick={() => setSelectedItem(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <span className="drawer-sku">{selectedItem.sku}</span>
                <h2 className="drawer-title">{selectedItem.name}</h2>
              </div>
              <button className="drawer-close" onClick={() => setSelectedItem(null)}>
                ✕
              </button>
            </div>
            <div className="drawer-body">
              <div className="drawer-field-grid">
                <div className="drawer-field">
                  <span>Category</span>
                  <strong>{selectedItem.category}</strong>
                </div>
                <div className="drawer-field">
                  <span>Unit</span>
                  <strong>{selectedItem.unit}</strong>
                </div>
                <div className="drawer-field">
                  <span>Stock on Hand</span>
                  <strong>
                    {selectedItem.stockOnHand} {selectedItem.unit}s
                  </strong>
                </div>
                <div className="drawer-field">
                  <span>Reorder Point</span>
                  <strong>{selectedItem.reorderPoint}</strong>
                </div>
                <div className="drawer-field">
                  <span>Unit Cost</span>
                  <strong>KES {(selectedItem.unitCostMinor / 100).toLocaleString()}</strong>
                </div>
                <div className="drawer-field">
                  <span>Retail Price</span>
                  <strong>KES {(selectedItem.retailPriceMinor / 100).toLocaleString()}</strong>
                </div>
              </div>

              <div className="drawer-actions-row">
                <button
                  className="btn-primary"
                  onClick={() => {
                    setMovementItemId(selectedItem.id);
                    setShowNewMovement(true);
                  }}
                >
                  + Adjust Stock Level
                </button>
              </div>

              <div className="drawer-history">
                <h4>Recent Movements</h4>
                {movements
                  .filter((m) => m.itemId === selectedItem.id)
                  .map((m) => (
                    <div key={m.id} className="mini-mvt-row">
                      <span className="mini-mvt-type">{m.movementType.replace(/_/g, " ")}</span>
                      <span className={`mini-mvt-qty ${m.quantity > 0 ? "pos" : "neg"}`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </span>
                      <span className="mini-mvt-date">
                        {new Date(m.recordedAt).toLocaleDateString("en-KE", { dateStyle: "short" })}
                      </span>
                    </div>
                  ))}
                {movements.filter((m) => m.itemId === selectedItem.id).length === 0 && (
                  <p className="mini-empty">No movements for this item.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Item Modal */}
      {showNewItem && (
        <NewItemModal
          onClose={() => setShowNewItem(false)}
          onCreated={() => {
            setShowNewItem(false);
            void reload();
          }}
        />
      )}

      {/* New Movement Modal */}
      {showNewMovement && (
        <NewMovementModal
          items={items}
          defaultItemId={movementItemId}
          onClose={() => {
            setShowNewMovement(false);
            setMovementItemId("");
          }}
          onCreated={() => {
            setShowNewMovement(false);
            setMovementItemId("");
            void reload();
          }}
        />
      )}

      {/* New Purchase Order Modal */}
      {showNewPO && (
        <NewPOModal
          items={items}
          onClose={() => setShowNewPO(false)}
          onCreated={() => {
            setShowNewPO(false);
            void reload();
          }}
        />
      )}

      <style>{`
        .inv-page { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
        .inv-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
        .inv-title { font-size: 1.7rem; font-weight: 800; color: white; margin-bottom: .35rem; }
        .inv-subtitle { color: rgba(255,255,255,0.45); }
        .inv-header-actions { display: flex; gap: .75rem; flex-wrap: wrap; }

        .inv-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
        .inv-stat-card {
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px; padding: 1.25rem; display: flex; flex-direction: column; gap: 4px;
          transition: border-color .2s;
        }
        .inv-stat-card:hover { border-color: rgba(255,255,255,0.15); }
        .stat-label { font-size: .75rem; font-weight: 600; color: rgba(255,255,255,0.45); }
        .stat-value { font-size: 1.6rem; font-weight: 800; color: white; line-height: 1.2; }
        .stat-value.warn { color: #f59e0b; }
        .stat-sub { font-size: .72rem; color: rgba(255,255,255,0.35); }

        .inv-tabs { display: flex; gap: .25rem; background: rgba(255,255,255,0.04); border-radius: 12px; padding: .35rem; border: 1px solid rgba(255,255,255,0.07); align-self: flex-start; }
        .inv-tab { padding: .45rem 1rem; border-radius: 8px; font-size: .82rem; font-weight: 600; color: rgba(255,255,255,0.45); background: none; border: none; cursor: pointer; transition: all .2s; }
        .inv-tab.active { background: rgba(99,102,241,0.25); color: #a5b4fc; }

        .inv-filters { display: flex; gap: .75rem; flex-wrap: wrap; }
        .filter-search, .filter-select {
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px; padding: .5rem .85rem; color: white; font-size: .85rem; outline: none;
        }
        .filter-search { flex: 1; min-width: 180px; }
        .filter-search::placeholder { color: rgba(255,255,255,0.3); }
        .filter-select option { background: #1a1b2e; }

        .inv-loading, .inv-empty { color: rgba(255,255,255,0.35); text-align: center; padding: 3rem; font-size: .9rem; }

        .item-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
        .item-card {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px; padding: 1.25rem; cursor: pointer; transition: all .2s;
          display: flex; flex-direction: column; gap: .6rem;
        }
        .item-card:hover { border-color: rgba(99,102,241,0.4); transform: translateY(-2px); }
        .item-card.low-stock { border-color: rgba(245,158,11,0.35); }
        .item-card-top { display: flex; align-items: center; justify-content: space-between; }
        .item-sku { font-size: .7rem; font-weight: 700; color: rgba(255,255,255,0.35); letter-spacing: 1px; }
        .item-badges { display: flex; gap: 4px; }
        .badge-retail { font-size: .62rem; font-weight: 700; padding: .15rem .45rem; border-radius: 99px; background: rgba(99,102,241,0.15); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.25); }
        .badge-consumable { font-size: .62rem; font-weight: 700; padding: .15rem .45rem; border-radius: 99px; background: rgba(34,197,94,0.12); color: #4ade80; border: 1px solid rgba(34,197,94,0.2); }
        .item-name { font-size: .92rem; font-weight: 700; color: white; line-height: 1.3; }
        .item-category { font-size: .72rem; color: rgba(255,255,255,0.4); }

        .stock-level-row { display: flex; align-items: center; justify-content: space-between; padding: .4rem 0; }
        .stock-count-box { display: flex; align-items: baseline; gap: 4px; }
        .stock-count { font-size: 1.4rem; font-weight: 800; color: white; }
        .stock-count.low { color: #f59e0b; }
        .stock-unit { font-size: .75rem; color: rgba(255,255,255,0.4); }
        .reorder-badge { font-size: .68rem; font-weight: 600; color: #f59e0b; background: rgba(245,158,11,0.12); padding: .2rem .5rem; border-radius: 6px; }

        .item-prices { display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.06); padding-top: .6rem; }
        .price-label { font-size: .68rem; color: rgba(255,255,255,0.35); display: block; }
        .price-val { font-size: .82rem; font-weight: 700; color: rgba(255,255,255,0.7); }
        .price-val.retail { color: #4ade80; }

        .mvt-list { display: flex; flex-direction: column; gap: .6rem; }
        .mvt-row {
          display: flex; align-items: center; gap: 1rem;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: .85rem 1.25rem;
        }
        .mvt-badge { font-size: .7rem; font-weight: 700; padding: .25rem .65rem; border-radius: 99px; border: 1px solid; flex-shrink: 0; white-space: nowrap; }
        .mvt-info { flex: 1; }
        .mvt-item { font-size: .88rem; font-weight: 600; color: white; }
        .mvt-notes { font-size: .75rem; color: rgba(255,255,255,0.45); margin-top: 2px; }
        .mvt-by { font-size: .7rem; color: rgba(255,255,255,0.3); margin-top: 2px; }
        .mvt-qty-col { text-align: right; flex-shrink: 0; }
        .mvt-qty { font-size: 1.1rem; font-weight: 800; }
        .mvt-qty.pos { color: #4ade80; }
        .mvt-qty.neg { color: #f87171; }
        .mvt-date { font-size: .72rem; color: rgba(255,255,255,0.35); }

        .po-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
        .po-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
        .po-card-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .po-num { font-size: .7rem; font-weight: 700; color: rgba(255,255,255,0.35); letter-spacing: 1px; }
        .po-supplier { font-size: .95rem; font-weight: 700; color: white; margin-top: 2px; }
        .po-status { font-size: .7rem; font-weight: 700; padding: .2rem .6rem; border-radius: 99px; text-transform: uppercase; }
        .po-status.received { background: rgba(34,197,94,0.15); color: #4ade80; }
        .po-status.ordered { background: rgba(99,102,241,0.15); color: #a5b4fc; }
        .po-items-list { display: flex; flex-direction: column; gap: 4px; font-size: .8rem; color: rgba(255,255,255,0.6); }
        .po-item-line { display: flex; justify-content: space-between; }
        .po-footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid rgba(255,255,255,0.06); padding-top: .75rem; }
        .po-total span { font-size: .7rem; color: rgba(255,255,255,0.4); display: block; }
        .po-total strong { font-size: 1rem; color: white; }
        .po-date { font-size: .72rem; color: rgba(255,255,255,0.35); text-align: right; }

        /* Drawer */
        .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200; display: flex; justify-content: flex-end; }
        .drawer { width: min(480px, 100vw); height: 100%; background: #111827; border-left: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; overflow: hidden; }
        .drawer-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 1.5rem 1.5rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .drawer-sku { font-size: .7rem; font-weight: 700; color: rgba(255,255,255,0.35); letter-spacing: 1px; }
        .drawer-title { font-size: 1.1rem; font-weight: 800; color: white; line-height: 1.3; }
        .drawer-close { background: rgba(255,255,255,0.08); border: none; color: rgba(255,255,255,0.6); width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: .9rem; }
        .drawer-body { flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
        .drawer-field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
        .drawer-field { display: flex; flex-direction: column; gap: 3px; }
        .drawer-field span { font-size: .7rem; color: rgba(255,255,255,0.35); }
        .drawer-field strong { font-size: .85rem; color: white; }
        .drawer-actions-row { display: flex; gap: .75rem; }
        .drawer-history h4 { font-size: .8rem; font-weight: 700; color: rgba(255,255,255,0.6); margin-bottom: .75rem; }
        .mini-mvt-row { display: flex; align-items: center; justify-content: space-between; padding: .5rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: .8rem; }
        .mini-mvt-type { color: rgba(255,255,255,0.6); text-transform: capitalize; }
        .mini-mvt-qty { font-weight: 700; }
        .mini-mvt-qty.pos { color: #4ade80; }
        .mini-mvt-qty.neg { color: #f87171; }
        .mini-mvt-date { color: rgba(255,255,255,0.35); font-size: .73rem; }
        .mini-empty { font-size: .8rem; color: rgba(255,255,255,0.3); }

        .btn-primary { padding: .6rem 1.25rem; border-radius: 10px; font-size: .85rem; font-weight: 700; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: white; border: none; cursor: pointer; transition: all .2s; }
        .btn-primary:hover { opacity: .9; transform: translateY(-1px); }
        .btn-secondary { padding: .6rem 1.25rem; border-radius: 10px; font-size: .85rem; font-weight: 600; background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.12); cursor: pointer; transition: all .2s; }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}

// ── Modals ───────────────────────────────────────────────────────────────────
function NewItemModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "Retail",
    unit: "unit",
    unitCostMinor: 0,
    retailPriceMinor: 0,
    initialStock: 0,
    reorderPoint: 10,
    isRetail: true,
    isConsumable: false,
    branchId: ""
  } as Partial<CreateInventoryItemRequest>);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.branches().then((b) => setBranches(b.map((br) => ({ id: br.id, name: br.name }))));
  }, []);

  const set = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.createInventoryItem(form as CreateInventoryItemRequest);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create inventory item.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Inventory Item</h2>
          <button className="drawer-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Item Name</label>
            <input
              type="text"
              placeholder="Grip Socks Unisex"
              value={form.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>SKU</label>
              <input
                type="text"
                placeholder="RET-SOCK-01"
                value={form.sku ?? ""}
                onChange={(e) => set("sku", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <input
                type="text"
                placeholder="Apparel"
                value={form.category ?? ""}
                onChange={(e) => set("category", e.target.value)}
              />
            </div>
          </div>
          <div className="form-row">
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
            <div className="form-group">
              <label>Unit</label>
              <input
                type="text"
                placeholder="pair / bottle / pack"
                value={form.unit ?? ""}
                onChange={(e) => set("unit", e.target.value)}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Unit Cost (KES)</label>
              <input
                type="number"
                placeholder="600"
                value={form.unitCostMinor ? form.unitCostMinor / 100 : ""}
                onChange={(e) =>
                  set("unitCostMinor", Math.round(parseFloat(e.target.value) * 100) || 0)
                }
              />
            </div>
            <div className="form-group">
              <label>Retail Price (KES)</label>
              <input
                type="number"
                placeholder="1500"
                value={form.retailPriceMinor ? form.retailPriceMinor / 100 : ""}
                onChange={(e) =>
                  set("retailPriceMinor", Math.round(parseFloat(e.target.value) * 100) || 0)
                }
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Initial Stock</label>
              <input
                type="number"
                placeholder="0"
                value={form.initialStock ?? 0}
                onChange={(e) => set("initialStock", parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div className="form-group">
              <label>Reorder Point</label>
              <input
                type="number"
                placeholder="10"
                value={form.reorderPoint ?? 10}
                onChange={(e) => set("reorderPoint", parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>
          <div className="form-checkbox-row">
            <label>
              <input
                type="checkbox"
                checked={form.isRetail ?? true}
                onChange={(e) => set("isRetail", e.target.checked)}
              />{" "}
              Retail item (sold to members)
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.isConsumable ?? false}
                onChange={(e) => set("isConsumable", e.target.checked)}
              />{" "}
              Consumable / Session supply
            </label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={submit}
              disabled={loading || !form.name || !form.sku || !form.branchId}
            >
              {loading ? "Saving…" : "Create Item"}
            </button>
          </div>
        </div>
      </div>
      <style>{modalStyles}</style>
    </div>
  );
}

function NewMovementModal({
  items,
  defaultItemId,
  onClose,
  onCreated
}: {
  items: InventoryItemResponse[];
  defaultItemId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<Partial<CreateInventoryMovementRequest>>({
    itemId: defaultItemId,
    movementType: "adjustment",
    quantity: 1,
    notes: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = items.find((i) => i.id === form.itemId);

  const set = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      await api.createInventoryMovement({
        ...form,
        branchId: selected.branchId
      } as CreateInventoryMovementRequest);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to record movement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Record Stock Movement</h2>
          <button className="drawer-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Item</label>
            <select value={form.itemId ?? ""} onChange={(e) => set("itemId", e.target.value)}>
              <option value="">Select item…</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.stockOnHand} on hand)
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Movement Type</label>
              <select
                value={form.movementType ?? "adjustment"}
                onChange={(e) => set("movementType", e.target.value)}
              >
                {Object.entries(MOVEMENT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Quantity delta (+ or -)</label>
              <input
                type="number"
                value={form.quantity ?? 1}
                onChange={(e) => set("quantity", parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Notes / Reason</label>
            <input
              type="text"
              placeholder="Stock recount, received shipment, spoiled item…"
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
              disabled={loading || !form.itemId || !form.quantity}
            >
              {loading ? "Saving…" : "Save Movement"}
            </button>
          </div>
        </div>
      </div>
      <style>{modalStyles}</style>
    </div>
  );
}

function NewPOModal({
  items,
  onClose,
  onCreated
}: {
  items: InventoryItemResponse[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [supplierName, setSupplierName] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [orderLines, setOrderLines] = useState<
    Array<{ itemId: string; quantity: number; unitCostMinor: number }>
  >([{ itemId: items[0]?.id ?? "", quantity: 10, unitCostMinor: items[0]?.unitCostMinor ?? 0 }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.branches().then((b) => {
      setBranches(b.map((br) => ({ id: br.id, name: br.name })));
      if (b[0]) setBranchId(b[0].id);
    });
  }, []);

  const addLine = () => {
    const first = items[0];
    setOrderLines((l) => [
      ...l,
      { itemId: first?.id ?? "", quantity: 10, unitCostMinor: first?.unitCostMinor ?? 0 }
    ]);
  };

  const setLine = (
    idx: number,
    patch: Partial<{ itemId: string; quantity: number; unitCostMinor: number }>
  ) => {
    setOrderLines((lines) =>
      lines.map((l, i) => {
        if (i !== idx) return l;
        const next = { ...l, ...patch };
        if (patch.itemId) {
          const itm = items.find((it) => it.id === patch.itemId);
          if (itm) next.unitCostMinor = itm.unitCostMinor;
        }
        return next;
      })
    );
  };

  const totalMinor = orderLines.reduce((sum, l) => sum + l.quantity * l.unitCostMinor, 0);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.createPurchaseOrder({
        branchId,
        supplierName,
        items: orderLines
      } as CreatePurchaseOrderRequest);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create purchase order.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px" }}>
        <div className="modal-header">
          <h2>Create Purchase Order</h2>
          <button className="drawer-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Supplier Name</label>
              <input
                type="text"
                placeholder="e.g. East Africa Fitness Supplies"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Branch</label>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="po-lines-section">
            <div className="po-lines-header">
              <span>Order Lines</span>
              <button type="button" className="btn-add-line" onClick={addLine}>
                + Add Line
              </button>
            </div>
            {orderLines.map((line, idx) => (
              <div key={idx} className="po-line-row">
                <select
                  value={line.itemId}
                  onChange={(e) => setLine(idx, { itemId: e.target.value })}
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Qty"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => setLine(idx, { quantity: parseInt(e.target.value, 10) || 1 })}
                  style={{ width: "70px" }}
                />
                <span className="line-total">
                  KES {((line.quantity * line.unitCostMinor) / 100).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <div className="po-total-row">
            <span>Estimated Total:</span>
            <strong>KES {(totalMinor / 100).toLocaleString()}</strong>
          </div>

          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={submit}
              disabled={loading || !supplierName || !branchId || orderLines.length === 0}
            >
              {loading ? "Ordering…" : "Create Purchase Order"}
            </button>
          </div>
        </div>
      </div>
      <style>{modalStyles}</style>
    </div>
  );
}

const modalStyles = `
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
  .form-group input, .form-group select, .form-group textarea { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: .5rem .75rem; color: white; font-size: .85rem; outline: none; }
  .form-group input::placeholder, .form-group textarea::placeholder { color: rgba(255,255,255,0.2); }
  .form-group select option { background: #1a1b2e; }
  .form-checkbox-row { display: flex; flex-direction: column; gap: 6px; font-size: .82rem; color: rgba(255,255,255,0.7); }
  .form-checkbox-row label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
  .form-error { color: #f87171; font-size: .8rem; }
  .po-lines-section { display: flex; flex-direction: column; gap: .5rem; }
  .po-lines-header { display: flex; justify-content: space-between; align-items: center; font-size: .8rem; font-weight: 700; color: rgba(255,255,255,0.6); }
  .btn-add-line { background: none; border: none; color: #818cf8; font-size: .8rem; font-weight: 700; cursor: pointer; }
  .po-line-row { display: flex; gap: .5rem; align-items: center; }
  .po-line-row select { flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: .4rem .6rem; color: white; font-size: .82rem; }
  .po-line-row select option { background: #1a1b2e; }
  .line-total { font-size: .8rem; font-weight: 700; color: #4ade80; white-space: nowrap; }
  .po-total-row { display: flex; justify-content: space-between; align-items: center; padding: .6rem 0; border-top: 1px solid rgba(255,255,255,0.08); font-size: .9rem; color: white; }
`;
