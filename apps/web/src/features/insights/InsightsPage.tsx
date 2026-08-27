import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, Icon, PageHeader } from "@fitos/ui";
import { api } from "../../lib/api/client";
import { useBranch } from "../../app/branch-context";
import { ErrorNotice, PageLoading } from "../shared";
import type { InsightsOverviewResponse } from "@fitos/contracts";

type InsightsTab = "overview" | "attendance" | "bookings" | "retention" | "leads";

const INSIGHT_TABS: { id: InsightsTab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "dashboard" },
  { id: "attendance", label: "Attendance", icon: "check" },
  { id: "bookings", label: "Bookings", icon: "calendar" },
  { id: "retention", label: "Retention", icon: "users" },
  { id: "leads", label: "Lead Conversion", icon: "spark" }
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = ["6AM", "8AM", "10AM", "12PM", "2PM", "4PM", "6PM", "8PM"];

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadInsightsCsv(data: InsightsOverviewResponse): void {
  const rows = [
    ["Metric", "Value"],
    ["Average weekly visits", data.summary.avgWeeklyVisits],
    ["Class occupancy rate", `${data.summary.classOccupancyRate}%`],
    ["Member retention (90d)", `${data.summary.memberRetention90d}%`],
    ["Lead conversion rate", `${data.summary.leadConversionRate}%`],
    ["Active members", data.summary.totalActiveMembers],
    ["Leads in pipeline", data.summary.totalLeadsInPipeline]
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `fitos-insights-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function InsightsPage() {
  const [activeTab, setActiveTab] = useState<InsightsTab>("overview");
  const { activeBranchId } = useBranch();

  const insights = useQuery({
    queryKey: ["insights", activeBranchId],
    queryFn: () => api.insightsOverview(activeBranchId || undefined)
  });

  if (insights.isLoading) return <PageLoading />;

  const data = insights.data;
  const summary = data?.summary;
  const weeklyAttendance = data?.weeklyAttendance ?? [];
  const occupancyHeatmap = data?.occupancyHeatmap ?? [];
  const retentionCohorts = data?.retentionCohorts ?? [];
  const atRiskMembers = data?.atRiskMembers ?? [];
  const leadFunnel = data?.leadFunnel ?? [];
  const maxBar = Math.max(1, ...weeklyAttendance.map((b) => b.count));
  const maxHeat = Math.max(1, ...occupancyHeatmap.map((h) => h.occupancyPercent));

  return (
    <>
      <PageHeader
        eyebrow="Growth"
        title="Insights & Analytics"
        description="Live aggregate operational metrics across attendance, retention cohorts, class occupancy, and lead conversion."
        actions={
          <button
            className="fitos-button fitos-button--secondary fitos-button--small"
            disabled={!data}
            onClick={() => {
              if (data) downloadInsightsCsv(data);
            }}
            type="button"
          >
            <Icon name="spark" size={14} />
            Export CSV
          </button>
        }
      />

      <ErrorNotice error={insights.error} />

      {/* Tab Bar */}
      <div className="member-tab-bar">
        {INSIGHT_TABS.map((tab) => (
          <button
            className={`member-tab-bar__tab${activeTab === tab.id ? " member-tab-bar__tab--active" : ""}`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            <Icon name={tab.icon as Parameters<typeof Icon>[0]["name"]} size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="member-tab-content">
        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="form-stack">
            {/* KPI Row */}
            <div className="kpi-grid">
              <Card className="kpi kpi--energy">
                <span>Avg Weekly Visits</span>
                <strong>{summary?.avgWeeklyVisits ?? 0}</strong>
                <div className="kpi__change" style={{ color: "var(--success)" }}>
                  {summary?.avgWeeklyVisitsChangePct == null
                    ? "No comparison data"
                    : `${summary.avgWeeklyVisitsChangePct}% vs last month`}
                </div>
              </Card>

              <Card className="kpi">
                <span>Class Occupancy Rate</span>
                <strong>{summary?.classOccupancyRate ?? 0}%</strong>
                <div className="kpi__change" style={{ color: "var(--success)" }}>
                  {summary?.classOccupancyChangePct == null
                    ? "No comparison data"
                    : `${summary.classOccupancyChangePct}% vs last month`}
                </div>
              </Card>

              <Card className="kpi">
                <span>Member Retention (90d)</span>
                <strong>
                  {summary?.memberRetention90d == null ? "—" : `${summary.memberRetention90d}%`}
                </strong>
                <div
                  className="kpi__change"
                  style={{
                    color:
                      (summary?.memberRetentionChangePct ?? 0) >= 0
                        ? "var(--success)"
                        : "var(--danger)"
                  }}
                >
                  {summary?.memberRetentionChangePct == null
                    ? "— No comparison period yet"
                    : `${summary.memberRetentionChangePct >= 0 ? "▲" : "▼"} ${summary.memberRetentionChangePct}% vs last month`}
                </div>
              </Card>

              <Card className="kpi">
                <span>Lead Conversion Rate</span>
                <strong>
                  {summary?.leadConversionRate == null ? "—" : `${summary.leadConversionRate}%`}
                </strong>
                <div className="kpi__change" style={{ color: "var(--success)" }}>
                  {summary?.leadConversionChangePct == null
                    ? "No comparison data"
                    : `${summary.leadConversionChangePct}% vs last month`}
                </div>
              </Card>
            </div>

            {/* Attendance bar chart */}
            <Card>
              <h2>Weekly Attendance</h2>
              <p className="muted" style={{ fontSize: "0.8rem", marginBottom: "1rem" }}>
                Total check-ins per day this week (Live Aggregation)
              </p>
              <div className="insights-bar-chart">
                {weeklyAttendance.map((bar) => (
                  <div className="insights-bar-chart__col" key={bar.day}>
                    <div className="insights-bar-chart__value">{bar.count}</div>
                    <div
                      className="insights-bar-chart__bar"
                      style={{ height: `${(bar.count / maxBar) * 160}px` }}
                    />
                    <div className="insights-bar-chart__label">{bar.day}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Lead Funnel */}
            <Card>
              <h2>Lead Conversion Funnel</h2>
              <p className="muted" style={{ fontSize: "0.8rem", marginBottom: "1rem" }}>
                Active CRM pipeline · {summary?.totalLeadsInPipeline ?? 0} leads in funnel
              </p>
              <div className="insights-funnel">
                {leadFunnel.map((stage) => (
                  <div className="insights-funnel__stage" key={stage.stage}>
                    <div
                      className="insights-funnel__bar"
                      style={{ width: `${Math.max(5, stage.percentage)}%` }}
                    />
                    <div className="insights-funnel__meta">
                      <span>{stage.label}</span>
                      <span>
                        {stage.count} &nbsp;·&nbsp; {stage.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── ATTENDANCE ── */}
        {activeTab === "attendance" && (
          <div className="form-stack">
            {/* Occupancy Heatmap */}
            <Card>
              <h2>Occupancy Heatmap</h2>
              <p className="muted" style={{ fontSize: "0.8rem", marginBottom: "1rem" }}>
                Average occupancy % by day and time slot
              </p>
              <div className="heatmap-wrapper">
                <div className="heatmap-labels-y">
                  {DAYS.map((d) => (
                    <div className="heatmap-label-y" key={d}>
                      {d}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="heatmap-labels-x">
                    {HOURS.map((h) => (
                      <div className="heatmap-label-x" key={h}>
                        {h}
                      </div>
                    ))}
                  </div>
                  <div className="heatmap-grid">
                    {DAYS.map((d, di) =>
                      [6, 8, 10, 12, 14, 16, 18, 20].map((h, hi) => {
                        const point = occupancyHeatmap.find(
                          (pt) => pt.dayOfWeek === (di === 6 ? 0 : di + 1) && pt.hourOfDay === h
                        );
                        const pct = point?.occupancyPercent ?? 0;
                        const intensity = pct / maxHeat;
                        return (
                          <div
                            className="heatmap-cell"
                            key={`${di}-${hi}`}
                            style={{
                              background: `rgba(198, 255, 0, ${intensity * 0.85 + 0.08})`,
                              opacity: 0.7 + intensity * 0.3
                            }}
                            title={`${d} ${HOURS[hi]}: ${pct}% occupancy`}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
              <div className="heatmap-legend">
                <span>Fewer visits</span>
                <div className="heatmap-legend-scale">
                  {[0.08, 0.25, 0.45, 0.65, 0.9].map((v) => (
                    <div
                      key={v}
                      style={{
                        background: `rgba(198,255,0,${v})`,
                        width: 20,
                        height: 14,
                        borderRadius: 3
                      }}
                    />
                  ))}
                </div>
                <span>Peak rush</span>
              </div>
            </Card>

            {/* Popular Programs */}
            <Card>
              <h2>Active Programs</h2>
              <p className="muted">Program performance data is not available for this period.</p>
            </Card>
          </div>
        )}

        {/* ── BOOKINGS ── */}
        {activeTab === "bookings" && (
          <div className="form-stack">
            <div className="kpi-grid">
              <Card className="kpi">
                <span>Total Active Members</span>
                <strong>{summary?.totalActiveMembers ?? 0}</strong>
              </Card>
              <Card className="kpi">
                <span>Class Occupancy Rate</span>
                <strong>{summary?.classOccupancyRate ?? 0}%</strong>
              </Card>
              <Card className="kpi">
                <span>Avg Weekly Visits</span>
                <strong>{summary?.avgWeeklyVisits ?? 0}</strong>
              </Card>
              <Card className="kpi">
                <span>Leads In Pipeline</span>
                <strong>{summary?.totalLeadsInPipeline ?? 0}</strong>
              </Card>
            </div>
            <Card>
              <h2>Bookings by Day of Week</h2>
              <div className="insights-bar-chart">
                {weeklyAttendance.map((bar) => (
                  <div className="insights-bar-chart__col" key={bar.day}>
                    <div className="insights-bar-chart__value">{bar.count}</div>
                    <div
                      className="insights-bar-chart__bar insights-bar-chart__bar--muted"
                      style={{ height: `${(bar.count / maxBar) * 160}px` }}
                    />
                    <div className="insights-bar-chart__label">{bar.day}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── RETENTION ── */}
        {activeTab === "retention" && (
          <div className="form-stack">
            <div className="kpi-grid">
              <Card className="kpi">
                <span>90-Day Retention</span>
                <strong>
                  {summary?.memberRetention90d == null ? "—" : `${summary.memberRetention90d}%`}
                </strong>
              </Card>
              <Card className="kpi">
                <span>Active Members</span>
                <strong>{summary?.totalActiveMembers ?? 0}</strong>
              </Card>
              <Card className="kpi">
                <span>At-Risk Members</span>
                <strong>{atRiskMembers.length}</strong>
              </Card>
            </div>

            {/* Retention Cohort Chart */}
            <Card>
              <h2>Retention Cohort Analysis</h2>
              <p className="muted" style={{ fontSize: "0.8rem", marginBottom: "1.5rem" }}>
                % of members still active each month after joining
              </p>
              <div className="retention-cohort-chart">
                {retentionCohorts.map((c) => (
                  <div className="retention-cohort-row" key={c.cohortMonth}>
                    <span className="retention-cohort-row__label">
                      {c.cohortMonth} ({c.initialSize} members)
                    </span>
                    <div className="retention-cohort-row__bar-wrap">
                      <div
                        className="retention-cohort-row__bar"
                        style={{
                          width: `${c.month3Retention}%`,
                          background: "var(--fitos-energy)"
                        }}
                      />
                    </div>
                    <span className="retention-cohort-row__pct">
                      {c.month3Retention}% (Month 3)
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* At-Risk Members */}
            <Card>
              <h2>At-Risk Members (Winback Target)</h2>
              <p className="muted" style={{ fontSize: "0.8rem", marginBottom: "1rem" }}>
                Members with no check-in in the last 21+ days
              </p>
              <div className="form-stack">
                {atRiskMembers.map((m) => (
                  <div className="at-risk-row" key={m.id}>
                    <div className="at-risk-row__avatar">{m.firstName[0]}</div>
                    <div className="at-risk-row__info">
                      <strong>
                        {m.firstName} {m.lastName ?? ""}
                      </strong>
                      <span>
                        {m.planName} · {m.creditsRemaining} credits remaining · {m.daysInactive}{" "}
                        days inactive
                      </span>
                    </div>
                    <button
                      className="fitos-button fitos-button--secondary fitos-button--small"
                      disabled
                      title="Messaging provider is not configured."
                      type="button"
                    >
                      Messaging unavailable
                    </button>
                  </div>
                ))}
                {!atRiskMembers.length ? (
                  <p className="muted">
                    All members have active attendance within the last 21 days.
                  </p>
                ) : null}
              </div>
            </Card>
          </div>
        )}

        {/* ── LEAD CONVERSION ── */}
        {activeTab === "leads" && (
          <div className="form-stack">
            <div className="kpi-grid">
              <Card className="kpi">
                <span>Leads In Pipeline</span>
                <strong>{summary?.totalLeadsInPipeline ?? 0}</strong>
              </Card>
              <Card className="kpi">
                <span>Conversion Rate</span>
                <strong>{summary?.leadConversionRate ?? 0}%</strong>
              </Card>
            </div>

            <Card>
              <h2>Lead Funnel Breakdown</h2>
              <div className="insights-funnel">
                {leadFunnel.map((stage) => (
                  <div className="insights-funnel__stage" key={stage.stage}>
                    <div
                      className="insights-funnel__bar"
                      style={{ width: `${Math.max(5, stage.percentage)}%` }}
                    />
                    <div className="insights-funnel__meta">
                      <span>{stage.label}</span>
                      <span>
                        {stage.count} &nbsp;·&nbsp; {stage.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
