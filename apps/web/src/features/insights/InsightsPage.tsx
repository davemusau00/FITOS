import { useState } from "react";
import { Card, Icon, PageHeader } from "@fitos/ui";

type InsightsTab = "overview" | "attendance" | "bookings" | "retention" | "leads";

const INSIGHT_TABS: { id: InsightsTab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "dashboard" },
  { id: "attendance", label: "Attendance", icon: "check" },
  { id: "bookings", label: "Bookings", icon: "calendar" },
  { id: "retention", label: "Retention", icon: "users" },
  { id: "leads", label: "Lead Conversion", icon: "spark" }
];

const KPI_CARDS = [
  { label: "Avg Weekly Visits", value: "127", change: "+12%", up: true },
  { label: "Class Occupancy Rate", value: "73%", change: "+5%", up: true },
  { label: "Member Retention (90d)", value: "84%", change: "-2%", up: false },
  { label: "Lead Conversion Rate", value: "31%", change: "+8%", up: true }
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = ["6AM", "8AM", "10AM", "12PM", "2PM", "4PM", "6PM", "8PM"];

// Mock heatmap data: 7 days × 8 time slots
const HEATMAP_DATA = [
  [2, 8, 14, 7, 4, 2, 1, 0],
  [3, 10, 18, 9, 5, 6, 4, 1],
  [4, 12, 20, 11, 7, 8, 6, 2],
  [5, 11, 19, 13, 9, 10, 8, 3],
  [6, 14, 22, 15, 11, 12, 10, 4],
  [8, 16, 24, 18, 14, 15, 12, 5],
  [4, 9, 12, 8, 6, 14, 18, 8]
];

const FUNNEL_STAGES = [
  { label: "New Leads", count: 120, pct: 100 },
  { label: "Contacted", count: 88, pct: 73 },
  { label: "Trial Booked", count: 51, pct: 42 },
  { label: "Trial Done", count: 40, pct: 33 },
  { label: "Offer Made", count: 29, pct: 24 },
  { label: "Joined", count: 18, pct: 15 }
];

const ATTENDANCE_BARS = [
  { day: "Mon", val: 45 },
  { day: "Tue", val: 62 },
  { day: "Wed", val: 78 },
  { day: "Thu", val: 71 },
  { day: "Fri", val: 85 },
  { day: "Sat", val: 92 },
  { day: "Sun", val: 38 }
];

const RETENTION_COHORTS = [
  { label: "Month 1", pct: 100, color: "#c6ff00" },
  { label: "Month 2", pct: 88, color: "#a3d900" },
  { label: "Month 3", pct: 76, color: "#7eb800" },
  { label: "Month 4", pct: 65, color: "#5d8c00" },
  { label: "Month 5", pct: 54, color: "#3e6200" },
  { label: "Month 6", pct: 46, color: "#274000" }
];

export function InsightsPage() {
  const [activeTab, setActiveTab] = useState<InsightsTab>("overview");

  const maxBar = Math.max(...ATTENDANCE_BARS.map((b) => b.val));
  const maxHeat = Math.max(...HEATMAP_DATA.flat());

  return (
    <>
      <PageHeader
        eyebrow="Growth"
        title="Insights & Analytics"
        description="Understand your gym's performance with data on attendance, retention, and lead conversion."
        actions={
          <button className="fitos-button fitos-button--secondary fitos-button--small" type="button">
            <Icon name="spark" size={14} />
            Export CSV
          </button>
        }
      />

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
              {KPI_CARDS.map((kpi) => (
                <Card className="kpi" key={kpi.label}>
                  <span>{kpi.label}</span>
                  <strong>{kpi.value}</strong>
                  <div
                    className="kpi__change"
                    style={{ color: kpi.up ? "var(--success)" : "var(--danger)" }}
                  >
                    {kpi.up ? "▲" : "▼"} {kpi.change} vs last month
                  </div>
                </Card>
              ))}
            </div>

            {/* Attendance bar chart */}
            <Card>
              <h2>Weekly Attendance</h2>
              <p className="muted" style={{ fontSize: "0.8rem", marginBottom: "1rem" }}>
                Total check-ins per day this week
              </p>
              <div className="insights-bar-chart">
                {ATTENDANCE_BARS.map((bar) => (
                  <div className="insights-bar-chart__col" key={bar.day}>
                    <div className="insights-bar-chart__value">{bar.val}</div>
                    <div
                      className="insights-bar-chart__bar"
                      style={{ height: `${(bar.val / maxBar) * 160}px` }}
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
                Last 30 days · {FUNNEL_STAGES[FUNNEL_STAGES.length - 1]?.count ?? 0} members joined
              </p>
              <div className="insights-funnel">
                {FUNNEL_STAGES.map((stage) => (
                  <div className="insights-funnel__stage" key={stage.label}>
                    <div
                      className="insights-funnel__bar"
                      style={{ width: `${stage.pct}%` }}
                    />
                    <div className="insights-funnel__meta">
                      <span>{stage.label}</span>
                      <span>
                        {stage.count} &nbsp;·&nbsp; {stage.pct}%
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
                Average check-ins by day and time · Last 4 weeks
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
                    {HEATMAP_DATA.map((row, ri) =>
                      row.map((val, ci) => {
                        const intensity = val / maxHeat;
                        return (
                          <div
                            className="heatmap-cell"
                            key={`${ri}-${ci}`}
                            style={{
                              background: `rgba(198, 255, 0, ${intensity * 0.85 + 0.05})`,
                              opacity: 0.7 + intensity * 0.3
                            }}
                            title={`${DAYS[ri]} ${HOURS[ci]}: ${val} check-ins`}
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
                  {[0.05, 0.2, 0.4, 0.6, 0.85].map((v) => (
                    <div
                      key={v}
                      style={{ background: `rgba(198,255,0,${v})`, width: 20, height: 14, borderRadius: 3 }}
                    />
                  ))}
                </div>
                <span>More visits</span>
              </div>
            </Card>

            {/* Classes by Popularity */}
            <Card>
              <h2>Class Popularity</h2>
              <div className="form-stack">
                {[
                  { name: "HIIT Blast", pct: 94, count: 142 },
                  { name: "Yoga Flow", pct: 78, count: 118 },
                  { name: "Strength Circuit", pct: 71, count: 107 },
                  { name: "Spin Class", pct: 65, count: 98 },
                  { name: "Boxing", pct: 52, count: 79 }
                ].map((cls) => (
                  <div className="class-popularity-row" key={cls.name}>
                    <span className="class-popularity-row__name">{cls.name}</span>
                    <div className="class-popularity-row__bar-wrap">
                      <div
                        className="class-popularity-row__bar"
                        style={{ width: `${cls.pct}%` }}
                      />
                    </div>
                    <span className="class-popularity-row__count">{cls.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── BOOKINGS ── */}
        {activeTab === "bookings" && (
          <div className="form-stack">
            <div className="kpi-grid">
              {[
                { label: "Total Bookings (30d)", value: "1,247" },
                { label: "Cancellations", value: "89" },
                { label: "No Shows", value: "34" },
                { label: "Avg per Member", value: "4.2" }
              ].map((k) => (
                <Card className="kpi" key={k.label}>
                  <span>{k.label}</span>
                  <strong>{k.value}</strong>
                </Card>
              ))}
            </div>
            <Card>
              <h2>Bookings by Day of Week</h2>
              <div className="insights-bar-chart">
                {ATTENDANCE_BARS.map((bar) => (
                  <div className="insights-bar-chart__col" key={bar.day}>
                    <div className="insights-bar-chart__value">{bar.val * 2}</div>
                    <div
                      className="insights-bar-chart__bar insights-bar-chart__bar--muted"
                      style={{ height: `${(bar.val / maxBar) * 160}px` }}
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
              {[
                { label: "30-Day Retention", value: "91%" },
                { label: "90-Day Retention", value: "84%" },
                { label: "6-Month Retention", value: "68%" },
                { label: "At-Risk Members", value: "23" }
              ].map((k) => (
                <Card className="kpi" key={k.label}>
                  <span>{k.label}</span>
                  <strong>{k.value}</strong>
                </Card>
              ))}
            </div>

            {/* Retention Cohort Chart */}
            <Card>
              <h2>Retention Cohort Analysis</h2>
              <p className="muted" style={{ fontSize: "0.8rem", marginBottom: "1.5rem" }}>
                % of members still active each month after joining
              </p>
              <div className="retention-cohort-chart">
                {RETENTION_COHORTS.map((c) => (
                  <div className="retention-cohort-row" key={c.label}>
                    <span className="retention-cohort-row__label">{c.label}</span>
                    <div className="retention-cohort-row__bar-wrap">
                      <div
                        className="retention-cohort-row__bar"
                        style={{
                          width: `${c.pct}%`,
                          background: c.color
                        }}
                      />
                    </div>
                    <span className="retention-cohort-row__pct">{c.pct}%</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* At-Risk Members */}
            <Card>
              <h2>At-Risk Members</h2>
              <p className="muted" style={{ fontSize: "0.8rem", marginBottom: "1rem" }}>
                Members with no check-in in the last 21+ days
              </p>
              <div className="form-stack">
                {["Jane Doe", "Marcus Omondi", "Faith Njeri", "Kevin Mutua"].map((name, i) => (
                  <div className="at-risk-row" key={name}>
                    <div className="at-risk-row__avatar">{name[0]}</div>
                    <div className="at-risk-row__info">
                      <strong>{name}</strong>
                      <span>Last visit: {21 + i * 3} days ago</span>
                    </div>
                    <button className="fitos-button fitos-button--secondary fitos-button--small" type="button">
                      Send Nudge
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── LEAD CONVERSION ── */}
        {activeTab === "leads" && (
          <div className="form-stack">
            <div className="kpi-grid">
              {[
                { label: "New Leads (30d)", value: "120" },
                { label: "Trials Completed", value: "40" },
                { label: "Converted", value: "18" },
                { label: "Conversion Rate", value: "15%" }
              ].map((k) => (
                <Card className="kpi" key={k.label}>
                  <span>{k.label}</span>
                  <strong>{k.value}</strong>
                </Card>
              ))}
            </div>
            <Card>
              <h2>Lead Funnel Breakdown</h2>
              <div className="insights-funnel">
                {FUNNEL_STAGES.map((stage) => (
                  <div className="insights-funnel__stage" key={stage.label}>
                    <div className="insights-funnel__bar" style={{ width: `${stage.pct}%` }} />
                    <div className="insights-funnel__meta">
                      <span>{stage.label}</span>
                      <span>
                        {stage.count} &nbsp;·&nbsp; {stage.pct}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h2>Lost Lead Reasons</h2>
              <div className="form-stack">
                {[
                  { reason: "Price too high", count: 28, pct: 52 },
                  { reason: "Distance / location", count: 11, pct: 20 },
                  { reason: "Schedule conflict", count: 8, pct: 15 },
                  { reason: "Joined competitor", count: 5, pct: 9 },
                  { reason: "Other", count: 2, pct: 4 }
                ].map((r) => (
                  <div className="class-popularity-row" key={r.reason}>
                    <span className="class-popularity-row__name">{r.reason}</span>
                    <div className="class-popularity-row__bar-wrap">
                      <div
                        className="class-popularity-row__bar"
                        style={{
                          width: `${r.pct}%`,
                          background: "var(--danger)"
                        }}
                      />
                    </div>
                    <span className="class-popularity-row__count">{r.count}</span>
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
