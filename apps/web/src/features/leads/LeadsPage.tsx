import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  DataTable,
  type DataTableColumn,
  EmptyState,
  Icon,
  Modal,
  PageHeader,
  SearchBar
} from "@fitos/ui";
import type { LeadResponse } from "@fitos/contracts";
import { api } from "../../lib/api/client";
import { PageLoading, ErrorNotice, formatDate } from "../shared";

export const leadStages = [
  "new",
  "contacted",
  "trial_booked",
  "trial_completed",
  "offer",
  "joined",
  "lost"
] as const;

type LeadStage = (typeof leadStages)[number];

const STAGE_META: Record<
  LeadStage,
  { label: string; color: string; icon: string; description: string }
> = {
  new: {
    label: "New",
    color: "var(--accent)",
    icon: "spark",
    description: "Just enquired"
  },
  contacted: {
    label: "Contacted",
    color: "#60a5fa",
    icon: "users",
    description: "Reached out"
  },
  trial_booked: {
    label: "Trial Booked",
    color: "#a78bfa",
    icon: "calendar",
    description: "Trial scheduled"
  },
  trial_completed: {
    label: "Trial Done",
    color: "#f59e0b",
    icon: "check",
    description: "Trial attended"
  },
  offer: {
    label: "Offer Made",
    color: "#fb923c",
    icon: "spark",
    description: "Package proposed"
  },
  joined: {
    label: "Joined ✓",
    color: "var(--success)",
    icon: "check",
    description: "Converted"
  },
  lost: {
    label: "Lost",
    color: "var(--danger)",
    icon: "bell",
    description: "Did not convert"
  }
};

const LOST_REASONS = [
  "Price too high",
  "Distance / location",
  "Schedule conflict",
  "Joined competitor",
  "No longer interested",
  "Stopped responding",
  "Other"
];

export function LeadsPage() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<LeadResponse | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [taskBody, setTaskBody] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [lostReasonLead, setLostReasonLead] = useState<{
    lead: LeadResponse;
    targetStage: LeadStage;
  } | null>(null);
  const [selectedLostReason, setSelectedLostReason] = useState("");
  const [customLostReason, setCustomLostReason] = useState("");

  const query = params.get("query") ?? "";
  const stage = params.get("stage") ?? "";
  const requestParams = useMemo(() => {
    const next = new URLSearchParams();
    if (query) next.set("query", query);
    if (stage) next.set("stage", stage);
    return next;
  }, [query, stage]);

  const leads = useQuery({
    queryKey: ["leads", requestParams.toString()],
    queryFn: () => api.leads(requestParams)
  });
  const updateStage = useMutation({
    mutationFn: ({
      id,
      nextStage,
      lostReason
    }: {
      id: string;
      nextStage: LeadStage;
      lostReason?: string;
    }) => api.updateLeadStage(id, { stage: nextStage, ...(lostReason ? { lostReason } : {}) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["leads"] })
  });
  const convert = useMutation({
    mutationFn: api.convertLead,
    onSuccess: (result) => {
      setSelectedLead(result.lead);
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
    }
  });
  const notes = useQuery({
    queryKey: ["lead", selectedLead?.id ?? "", "notes"],
    queryFn: () => api.leadNotes(selectedLead!.id),
    enabled: Boolean(selectedLead)
  });
  const tasks = useQuery({
    queryKey: ["lead", selectedLead?.id ?? "", "tasks"],
    queryFn: () => api.leadTasks(selectedLead!.id),
    enabled: Boolean(selectedLead)
  });
  const addNote = useMutation({
    mutationFn: (body: string) => api.addLeadNote(selectedLead!.id, body),
    onSuccess: () => {
      setNoteBody("");
      void queryClient.invalidateQueries({ queryKey: ["lead", selectedLead?.id, "notes"] });
    }
  });
  const addTask = useMutation({
    mutationFn: (body: string) => api.addLeadTask(selectedLead!.id, { body }),
    onSuccess: () => {
      setTaskBody("");
      void queryClient.invalidateQueries({ queryKey: ["lead", selectedLead?.id, "tasks"] });
    }
  });

  const set = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  };

  const requestStageChange = (lead: LeadResponse, nextStage: LeadStage) => {
    if (nextStage === "lost") {
      setLostReasonLead({ lead, targetStage: nextStage });
      setSelectedLostReason("");
      setCustomLostReason("");
    } else {
      updateStage.mutate({ id: lead.id, nextStage });
    }
  };

  const confirmLostReason = () => {
    if (!lostReasonLead) return;
    const reason = selectedLostReason === "Other" ? customLostReason.trim() : selectedLostReason;
    if (!reason) return;
    updateStage.mutate({ id: lostReasonLead.lead.id, nextStage: "lost", lostReason: reason });
    setLostReasonLead(null);
  };

  const activeStages = leadStages.filter((s) => s !== "lost");
  const allLeads = leads.data?.data ?? [];

  const columns: DataTableColumn<LeadResponse>[] = [
    {
      id: "lead",
      header: "Lead",
      cell: (lead) => (
        <div>
          <strong className="fitos-data-table__primary">
            {lead.contact.firstName} {lead.contact.lastName}
          </strong>
          <span className="fitos-data-table__muted">
            {lead.contact.phone ?? lead.contact.email ?? "No contact method"}
          </span>
        </div>
      )
    },
    { id: "interest", header: "Interest", cell: (lead) => lead.interest ?? "—" },
    { id: "source", header: "Source", cell: (lead) => lead.source ?? "—" },
    {
      id: "stage",
      header: "Stage",
      cell: (lead) => {
        const meta = STAGE_META[lead.stage as LeadStage];
        return (
          <span
            className="lead-stage-badge"
            style={{
              background: `${meta.color}22`,
              color: meta.color,
              borderColor: `${meta.color}44`
            }}
          >
            {meta.label}
          </span>
        );
      }
    },
    { id: "followup", header: "Follow-up", cell: (lead) => formatDate(lead.nextFollowUpAt) },
    {
      id: "actions",
      header: "",
      cell: (lead) => (
        <div className="form-actions">
          <Button onClick={() => setSelectedLead(lead)} size="small" variant="ghost">
            Open
          </Button>
          {lead.convertedMemberId ? (
            <Link className="text-link" to={`/app/members/${lead.convertedMemberId}`}>
              Member →
            </Link>
          ) : null}
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        eyebrow="Growth"
        title="Leads Pipeline"
        description="Track every prospect from first contact through to a paid membership."
        actions={
          <>
            <div className="view-toggle">
              <button
                className={`view-toggle__btn${viewMode === "kanban" ? " view-toggle__btn--active" : ""}`}
                onClick={() => setViewMode("kanban")}
                type="button"
              >
                <Icon name="dashboard" size={14} />
                Pipeline
              </button>
              <button
                className={`view-toggle__btn${viewMode === "table" ? " view-toggle__btn--active" : ""}`}
                onClick={() => setViewMode("table")}
                type="button"
              >
                <Icon name="users" size={14} />
                List
              </button>
            </div>
            <Link className="fitos-button fitos-button--primary" to="/app/leads/new">
              <Icon name="plus" size={16} />
              Add lead
            </Link>
          </>
        }
      />

      <ErrorNotice error={leads.error ?? updateStage.error ?? convert.error} />

      {/* Filters */}
      <section className="filter-row">
        <SearchBar
          aria-label="Search leads"
          onChange={(event) => set("query", event.currentTarget.value)}
          placeholder="Search name, phone, email or interest"
          value={query}
        />
        {viewMode === "table" && (
          <select
            aria-label="Filter leads by stage"
            className="fitos-control"
            onChange={(event) => set("stage", event.currentTarget.value)}
            value={stage}
          >
            <option value="">All stages</option>
            {leadStages.map((item) => (
              <option key={item} value={item}>
                {STAGE_META[item].label}
              </option>
            ))}
          </select>
        )}
      </section>

      {leads.isLoading ? (
        <PageLoading />
      ) : !allLeads.length ? (
        <EmptyState
          action={
            <Link className="fitos-button fitos-button--primary" to="/app/leads/new">
              Add first lead
            </Link>
          }
          description="Prospects will appear here with their source, interest, and follow-up status."
          title="No matching leads"
        />
      ) : viewMode === "kanban" ? (
        /* ── KANBAN PIPELINE ── */
        <div className="leads-kanban">
          {activeStages.map((stageKey) => {
            const meta = STAGE_META[stageKey];
            const stageLeads = allLeads.filter((l) => l.stage === stageKey);
            return (
              <div className="leads-kanban__col" key={stageKey}>
                <div className="leads-kanban__col-header">
                  <div className="leads-kanban__col-title">
                    <span className="leads-kanban__col-dot" style={{ background: meta.color }} />
                    <span>{meta.label}</span>
                  </div>
                  <span className="leads-kanban__col-count">{stageLeads.length}</span>
                </div>

                <div className="leads-kanban__cards">
                  {stageLeads.length === 0 ? (
                    <div className="leads-kanban__empty">No leads</div>
                  ) : (
                    stageLeads.map((lead) => (
                      <div
                        className="leads-kanban__card"
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && setSelectedLead(lead)}
                      >
                        <div className="leads-kanban__card-name">
                          {lead.contact.firstName} {lead.contact.lastName}
                        </div>
                        {lead.contact.phone && (
                          <div className="leads-kanban__card-meta">{lead.contact.phone}</div>
                        )}
                        {lead.interest && (
                          <div className="leads-kanban__card-interest">{lead.interest}</div>
                        )}
                        {lead.source && (
                          <div className="leads-kanban__card-source">via {lead.source}</div>
                        )}
                        {lead.nextFollowUpAt && (
                          <div className="leads-kanban__card-followup">
                            <Icon name="calendar" size={11} />
                            Follow-up: {formatDate(lead.nextFollowUpAt)}
                          </div>
                        )}
                        <div className="leads-kanban__card-actions">
                          {/* Advance Stage */}
                          {(() => {
                            const idx = activeStages.indexOf(stageKey);
                            const nextStage = activeStages[idx + 1];
                            return nextStage ? (
                              <button
                                className="leads-kanban__advance-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestStageChange(lead, nextStage);
                                }}
                                type="button"
                              >
                                Advance →
                              </button>
                            ) : null;
                          })()}
                          <button
                            className="leads-kanban__lost-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              requestStageChange(lead, "lost");
                            }}
                            type="button"
                          >
                            Mark Lost
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {/* Lost Column */}
          <div className="leads-kanban__col leads-kanban__col--lost">
            <div className="leads-kanban__col-header">
              <div className="leads-kanban__col-title">
                <span className="leads-kanban__col-dot" style={{ background: "var(--danger)" }} />
                <span>Lost</span>
              </div>
              <span className="leads-kanban__col-count">
                {allLeads.filter((l) => l.stage === "lost").length}
              </span>
            </div>
            <div className="leads-kanban__cards">
              {allLeads
                .filter((l) => l.stage === "lost")
                .slice(0, 5)
                .map((lead) => (
                  <div
                    className="leads-kanban__card leads-kanban__card--lost"
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedLead(lead)}
                  >
                    <div className="leads-kanban__card-name">
                      {lead.contact.firstName} {lead.contact.lastName}
                    </div>
                    {lead.lostReason && (
                      <div className="leads-kanban__card-lost-reason">{lead.lostReason}</div>
                    )}
                  </div>
                ))}
              {allLeads.filter((l) => l.stage === "lost").length === 0 && (
                <div className="leads-kanban__empty">No lost leads</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── TABLE VIEW ── */
        <DataTable columns={columns} data={allLeads} label="Leads" />
      )}

      {/* ── LEAD DETAIL DRAWER ── */}
      {selectedLead ? (
        <Modal
          description={`${selectedLead.contact.firstName} ${selectedLead.contact.lastName ?? ""}`.trim()}
          isOpen={true}
          onClose={() => setSelectedLead(null)}
          title="Lead Profile"
        >
          <div className="form-stack">
            {/* Stage + Contact */}
            <div className="lead-detail-header">
              <div
                className="lead-stage-badge lead-stage-badge--lg"
                style={{
                  background: `${STAGE_META[selectedLead.stage as LeadStage].color}22`,
                  color: STAGE_META[selectedLead.stage as LeadStage].color,
                  borderColor: `${STAGE_META[selectedLead.stage as LeadStage].color}44`
                }}
              >
                {STAGE_META[selectedLead.stage as LeadStage].label}
              </div>
              <div className="lead-detail-contact">
                {selectedLead.contact.phone && <span>📞 {selectedLead.contact.phone}</span>}
                {selectedLead.contact.email && <span>✉ {selectedLead.contact.email}</span>}
                {selectedLead.interest && <span>🎯 {selectedLead.interest}</span>}
                {selectedLead.source && <span>📣 {selectedLead.source}</span>}
              </div>
            </div>

            {/* Stage Actions */}
            <Card>
              <h3 style={{ margin: "0 0 0.75rem" }}>Move to Stage</h3>
              <div className="lead-stage-actions">
                {leadStages
                  .filter((s) => s !== selectedLead.stage && s !== "lost")
                  .map((s) => (
                    <button
                      className="lead-stage-action-btn"
                      key={s}
                      onClick={() => requestStageChange(selectedLead, s)}
                      type="button"
                    >
                      {STAGE_META[s].label}
                    </button>
                  ))}
              </div>
            </Card>

            {/* Convert / View Member */}
            {!selectedLead.convertedMemberId ? (
              <Button
                loading={convert.isPending}
                onClick={() => convert.mutate(selectedLead.id)}
                variant="primary"
              >
                ✓ Convert to Member
              </Button>
            ) : (
              <Link
                className="fitos-button fitos-button--secondary"
                to={`/app/members/${selectedLead.convertedMemberId}`}
              >
                Open Member Profile →
              </Link>
            )}

            {/* Notes */}
            <section>
              <h3>Notes</h3>
              <div className="form-actions">
                <input
                  aria-label="Lead note"
                  className="fitos-control"
                  onChange={(event) => setNoteBody(event.target.value)}
                  placeholder="Add a follow-up note…"
                  value={noteBody}
                />
                <Button
                  disabled={!noteBody.trim()}
                  loading={addNote.isPending}
                  onClick={() => addNote.mutate(noteBody.trim())}
                  size="small"
                >
                  Add
                </Button>
              </div>
              {notes.data?.length ? (
                <ul className="timeline">
                  {notes.data.map((note) => (
                    <li key={note.id}>
                      <span />
                      <div>
                        <strong>{note.body}</strong>
                        <p>{formatDate(note.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No notes yet.</p>
              )}
            </section>

            {/* Tasks */}
            <section>
              <h3>Tasks</h3>
              <div className="form-actions">
                <input
                  aria-label="Lead task"
                  className="fitos-control"
                  onChange={(event) => setTaskBody(event.target.value)}
                  placeholder="Add a follow-up task…"
                  value={taskBody}
                />
                <Button
                  disabled={!taskBody.trim()}
                  loading={addTask.isPending}
                  onClick={() => addTask.mutate(taskBody.trim())}
                  size="small"
                >
                  Add
                </Button>
              </div>
              {tasks.data?.length ? (
                <ul className="timeline">
                  {tasks.data.map((task) => (
                    <li key={task.id}>
                      <span />
                      <div>
                        <strong>{task.body}</strong>
                        <p>{task.completedAt ? "✓ Completed" : "Open"}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No tasks yet.</p>
              )}
            </section>

            <ErrorNotice error={notes.error ?? tasks.error ?? addNote.error ?? addTask.error} />

            <div className="form-actions" style={{ justifyContent: "flex-end" }}>
              <Button onClick={() => requestStageChange(selectedLead, "lost")} variant="ghost">
                Mark as Lost
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* ── LOST REASON MODAL ── */}
      {lostReasonLead ? (
        <Modal
          description={`${lostReasonLead.lead.contact.firstName} ${lostReasonLead.lead.contact.lastName ?? ""} — why did this lead not convert?`}
          isOpen={true}
          onClose={() => setLostReasonLead(null)}
          title="Mark Lead as Lost"
        >
          <div className="form-stack">
            <p className="muted" style={{ marginBottom: "0.5rem" }}>
              Recording a reason helps improve your conversion rate over time.
            </p>
            <div className="lost-reason-grid">
              {LOST_REASONS.map((reason) => (
                <button
                  className={`lost-reason-option${selectedLostReason === reason ? " lost-reason-option--selected" : ""}`}
                  key={reason}
                  onClick={() => setSelectedLostReason(reason)}
                  type="button"
                >
                  {reason}
                </button>
              ))}
            </div>

            {selectedLostReason === "Other" && (
              <input
                autoFocus
                className="fitos-control"
                onChange={(e) => setCustomLostReason(e.target.value)}
                placeholder="Describe the reason…"
                value={customLostReason}
              />
            )}

            <div className="form-actions">
              <Button onClick={() => setLostReasonLead(null)} variant="ghost">
                Cancel
              </Button>
              <Button
                disabled={
                  !selectedLostReason ||
                  (selectedLostReason === "Other" && !customLostReason.trim())
                }
                loading={updateStage.isPending}
                onClick={confirmLostReason}
                variant="primary"
              >
                Confirm Lost
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
