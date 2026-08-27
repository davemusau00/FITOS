import { useEffect, useState } from "react";
import { api } from "../../lib/api/client";
import type {
  TenantSubscriptionResponse,
  UsageQuotaMetricsResponse,
  FeatureFlagResponse
} from "@fitos/contracts";

function UsageBar({ used, max, label }: { used: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
  const warn = pct >= 80;
  const critical = pct >= 95;
  return (
    <div className="usage-bar-item">
      <div className="usage-bar-header">
        <span className="usage-label">{label}</span>
        <span className={`usage-count ${critical ? "crit" : warn ? "warn" : ""}`}>
          {used.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      <div className="usage-bar-track">
        <div
          className={`usage-bar-fill ${critical ? "crit" : warn ? "warn" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const PLAN_COLORS: Record<string, string> = {
  starter: "#22c55e",
  pro: "#6366f1",
  elite: "#f59e0b",
  enterprise: "#ec4899"
};

const PLAN_LABELS: Record<string, string> = {
  starter: "FITOS Starter",
  pro: "FITOS Pro",
  elite: "FITOS Elite",
  enterprise: "Enterprise"
};

const CATEGORY_ICONS: Record<string, string> = {
  core: "⚡",
  advanced: "🔬",
  beta: "🧪"
};

export default function AccountSubscriptionPage() {
  const [sub, setSub] = useState<TenantSubscriptionResponse | null>(null);
  const [usage, setUsage] = useState<UsageQuotaMetricsResponse | null>(null);
  const [flags, setFlags] = useState<FeatureFlagResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.tenantSubscription(), api.tenantUsageQuotas(), api.featureFlags()])
      .then(([s, u, f]) => {
        setSub(s);
        setUsage(u);
        setFlags(f);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="sub-page">
        <div className="sub-loading">Loading subscription…</div>
      </div>
    );
  }

  const planColor = sub ? (PLAN_COLORS[sub.plan] ?? "#6366f1") : "#6366f1";
  const daysLeft = sub?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  const byCategory: Record<string, FeatureFlagResponse[]> = {};
  for (const f of flags) {
    const list = byCategory[f.category] ?? [];
    list.push(f);
    byCategory[f.category] = list;
  }

  return (
    <div className="sub-page">
      <div className="sub-header">
        <h1 className="sub-title">Subscription & Usage</h1>
        <p className="sub-subtitle">
          Your current plan, quota consumption, and unlocked capabilities.
        </p>
      </div>

      <div className="sub-grid">
        {/* Plan card */}
        <div className="sub-plan-card">
          <div
            className="plan-badge"
            style={{
              background: `${planColor}22`,
              borderColor: `${planColor}55`,
              color: planColor
            }}
          >
            {PLAN_LABELS[sub?.plan ?? "pro"] ?? sub?.planName}
          </div>
          <div className="plan-status-row">
            <span className={`plan-status-dot ${sub?.status}`} />
            <span className="plan-status-label">
              {sub?.status === "trial"
                ? "Free Trial"
                : sub?.status === "active"
                  ? "Active"
                  : sub?.status}
            </span>
          </div>
          {sub?.status === "trial" && daysLeft !== null && (
            <div className="trial-countdown">
              <span className="trial-days">{daysLeft}</span>
              <span className="trial-unit">days remaining</span>
            </div>
          )}
          {sub?.trialEndsAt && (
            <p className="plan-date">
              Trial ends{" "}
              {new Date(sub.trialEndsAt).toLocaleDateString("en-KE", { dateStyle: "long" })}
            </p>
          )}
          <button className="btn-upgrade">Upgrade Plan</button>
        </div>

        {/* Usage quotas */}
        {usage && (
          <div className="sub-usage-card">
            <h2 className="card-section-title">Usage Quotas</h2>
            <div className="usage-bars">
              <UsageBar used={usage.activeMembers} max={usage.maxMembers} label="Active Members" />
              <UsageBar used={usage.activeStaff} max={usage.maxStaff} label="Staff Accounts" />
              <UsageBar used={usage.branches} max={usage.maxBranches} label="Branches" />
              <UsageBar
                used={usage.automationRunsThisMonth}
                max={usage.maxAutomationRuns}
                label="Automation Runs (this month)"
              />
              <UsageBar used={usage.storageUsedMb} max={usage.maxStorageMb} label="Storage (MB)" />
            </div>
          </div>
        )}
      </div>

      {/* Feature flags */}
      {Object.keys(byCategory).length > 0 && (
        <div className="sub-features-card">
          <h2 className="card-section-title">Feature Access</h2>
          {Object.entries(byCategory).map(([cat, items]) => (
            <div key={cat} className="feature-category">
              <div className="feature-cat-header">
                <span className="feature-cat-icon">{CATEGORY_ICONS[cat] ?? "📦"}</span>
                <span className="feature-cat-label">
                  {cat.charAt(0).toUpperCase() + cat.slice(1)} Features
                </span>
              </div>
              <div className="feature-list">
                {items.map((flag) => (
                  <div
                    key={flag.key}
                    className={`feature-item ${flag.enabled ? "enabled" : "disabled"}`}
                  >
                    <div className="feature-item-left">
                      <div className={`feature-dot ${flag.enabled ? "on" : "off"}`} />
                      <div>
                        <div className="feature-name">{flag.name}</div>
                        <div className="feature-desc">{flag.description}</div>
                      </div>
                    </div>
                    <span className={`feature-toggle ${flag.enabled ? "on" : "off"}`}>
                      {flag.enabled ? "Enabled" : "Upgrade"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .sub-page { max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
        .sub-loading { color: rgba(255,255,255,0.4); text-align: center; padding: 4rem; }
        .sub-header h1 { font-size: 1.7rem; font-weight: 800; color: white; margin-bottom: .35rem; }
        .sub-subtitle { color: rgba(255,255,255,0.45); }
        .sub-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 1.25rem; }
        @media (max-width: 640px) { .sub-grid { grid-template-columns: 1fr; } }

        .sub-plan-card, .sub-usage-card, .sub-features-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 1.5rem;
        }
        .sub-plan-card { display: flex; flex-direction: column; gap: 1rem; }

        .plan-badge {
          display: inline-block;
          font-size: .75rem; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;
          padding: .3rem .9rem; border-radius: 99px; border: 1px solid;
          align-self: flex-start;
        }
        .plan-status-row { display: flex; align-items: center; gap: .5rem; }
        .plan-status-dot { width: 8px; height: 8px; border-radius: 50%; }
        .plan-status-dot.trial { background: #f59e0b; box-shadow: 0 0 8px #f59e0b; }
        .plan-status-dot.active { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
        .plan-status-label { font-size: .85rem; color: rgba(255,255,255,0.6); }

        .trial-countdown { text-align: center; padding: 1rem 0; }
        .trial-days { font-size: 3.5rem; font-weight: 900; color: white; display: block; line-height: 1; }
        .trial-unit { font-size: .85rem; color: rgba(255,255,255,0.4); }
        .plan-date { font-size: .8rem; color: rgba(255,255,255,0.35); margin: 0; }

        .btn-upgrade {
          padding: .65rem; border-radius: 10px; font-size: .85rem; font-weight: 700;
          background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white;
          border: none; cursor: pointer; transition: all .2s; text-align: center;
        }
        .btn-upgrade:hover { opacity: .9; transform: translateY(-1px); }

        .card-section-title { font-size: .9rem; font-weight: 700; color: rgba(255,255,255,0.8); margin-bottom: 1.25rem; }
        .usage-bars { display: flex; flex-direction: column; gap: 1rem; }
        .usage-bar-item { display: flex; flex-direction: column; gap: 5px; }
        .usage-bar-header { display: flex; justify-content: space-between; align-items: center; }
        .usage-label { font-size: .8rem; color: rgba(255,255,255,0.55); }
        .usage-count { font-size: .8rem; font-weight: 600; color: rgba(255,255,255,0.65); }
        .usage-count.warn { color: #f59e0b; }
        .usage-count.crit { color: #f87171; }
        .usage-bar-track {
          height: 6px; border-radius: 99px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
        }
        .usage-bar-fill {
          height: 100%; border-radius: 99px;
          background: linear-gradient(90deg, #6366f1, #8b5cf6);
          transition: width .5s ease;
        }
        .usage-bar-fill.warn { background: linear-gradient(90deg, #f59e0b, #fb923c); }
        .usage-bar-fill.crit { background: linear-gradient(90deg, #ef4444, #f87171); }

        .feature-category { margin-bottom: 1.25rem; }
        .feature-cat-header { display: flex; align-items: center; gap: .5rem; margin-bottom: .75rem; }
        .feature-cat-icon { font-size: 1rem; }
        .feature-cat-label { font-size: .8rem; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1px; }
        .feature-list { display: flex; flex-direction: column; gap: .5rem; }
        .feature-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: .85rem 1rem; border-radius: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          transition: border-color .2s;
        }
        .feature-item.enabled { border-color: rgba(99,102,241,0.15); }
        .feature-item-left { display: flex; align-items: center; gap: .85rem; }
        .feature-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .feature-dot.on { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
        .feature-dot.off { background: rgba(255,255,255,0.15); }
        .feature-name { font-size: .85rem; font-weight: 600; color: white; margin-bottom: 2px; }
        .feature-desc { font-size: .75rem; color: rgba(255,255,255,0.38); }
        .feature-toggle {
          font-size: .72rem; font-weight: 700; padding: .2rem .6rem; border-radius: 6px;
          flex-shrink: 0;
        }
        .feature-toggle.on { background: rgba(34,197,94,0.12); color: #4ade80; border: 1px solid rgba(34,197,94,0.2); }
        .feature-toggle.off { background: rgba(99,102,241,0.1); color: #818cf8; border: 1px solid rgba(99,102,241,0.2); }
      `}</style>
    </div>
  );
}
