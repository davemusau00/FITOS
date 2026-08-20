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

export function LeadsPage() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<LeadResponse | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [taskBody, setTaskBody] = useState("");
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
      nextStage: (typeof leadStages)[number];
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
  const changeStage = (lead: LeadResponse, nextStage: (typeof leadStages)[number]) => {
    const lostReason =
      nextStage === "lost" ? window.prompt("Why was this lead lost?")?.trim() : undefined;
    if (nextStage === "lost" && !lostReason) return;
    updateStage.mutate({ id: lead.id, nextStage, lostReason });
  };
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
      cell: (lead) => (
        <select
          aria-label={`Change stage for ${lead.contact.firstName}`}
          className="fitos-control fitos-control--compact"
          disabled={updateStage.isPending}
          onChange={(event) =>
            changeStage(lead, event.currentTarget.value as (typeof leadStages)[number])
          }
          value={lead.stage}
        >
          {leadStages.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      )
    },
    { id: "followup", header: "Follow-up", cell: (lead) => formatDate(lead.nextFollowUpAt) },
    {
      id: "convert",
      header: "",
      cell: (lead) => (
        <div className="form-actions">
          <Button onClick={() => setSelectedLead(lead)} size="small" variant="ghost">
            Open
          </Button>
          {lead.convertedMemberId ? (
            <Link className="text-link" to={`/app/members/${lead.convertedMemberId}`}>
              Member
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
        title="Leads"
        description="Capture interest, track follow-up, and move every prospect toward a clear outcome."
        actions={
          <Link className="fitos-button fitos-button--primary" to="/app/leads/new">
            <Icon name="plus" size={16} />
            Add lead
          </Link>
        }
      />
      <ErrorNotice error={leads.error ?? updateStage.error ?? convert.error} />
      <section className="filter-row">
        <SearchBar
          aria-label="Search leads"
          onChange={(event) => set("query", event.currentTarget.value)}
          placeholder="Search name, phone, email or interest"
          value={query}
        />
        <select
          aria-label="Filter leads by stage"
          className="fitos-control"
          onChange={(event) => set("stage", event.currentTarget.value)}
          value={stage}
        >
          <option value="">All stages</option>
          {leadStages.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </section>
      {leads.isLoading ? (
        <PageLoading />
      ) : !leads.data?.data.length ? (
        <EmptyState
          action={
            <Link className="fitos-button fitos-button--primary" to="/app/leads/new">
              Add first lead
            </Link>
          }
          description="Prospects will appear here with their source, interest, and follow-up status."
          title="No matching leads"
        />
      ) : (
        <DataTable columns={columns} data={leads.data.data} label="Leads" />
      )}

      {selectedLead ? (
        <Modal
          description={`${selectedLead.contact.firstName} ${selectedLead.contact.lastName ?? ""}`.trim()}
          isOpen={true}
          onClose={() => setSelectedLead(null)}
          title="Lead follow-up"
        >
          <div className="form-stack">
            <Card>
              <p>
                <strong>Stage:</strong> {selectedLead.stage.replaceAll("_", " ")}
              </p>
              <p>
                <strong>Contact:</strong>{" "}
                {selectedLead.contact.phone ?? selectedLead.contact.email ?? "No contact method"}
              </p>
              {!selectedLead.convertedMemberId ? (
                <Button
                  loading={convert.isPending}
                  onClick={() => convert.mutate(selectedLead.id)}
                  variant="primary"
                >
                  Convert to member
                </Button>
              ) : (
                <Link
                  className="fitos-button fitos-button--secondary"
                  to={`/app/members/${selectedLead.convertedMemberId}`}
                >
                  Open member profile
                </Link>
              )}
            </Card>

            <section>
              <h3>Notes</h3>
              <div className="form-actions">
                <input
                  aria-label="Lead note"
                  className="fitos-control"
                  onChange={(event) => setNoteBody(event.target.value)}
                  placeholder="Add a follow-up note"
                  value={noteBody}
                />
                <Button
                  disabled={!noteBody.trim()}
                  loading={addNote.isPending}
                  onClick={() => addNote.mutate(noteBody.trim())}
                  size="small"
                >
                  Add note
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

            <section>
              <h3>Tasks</h3>
              <div className="form-actions">
                <input
                  aria-label="Lead task"
                  className="fitos-control"
                  onChange={(event) => setTaskBody(event.target.value)}
                  placeholder="Add a follow-up task"
                  value={taskBody}
                />
                <Button
                  disabled={!taskBody.trim()}
                  loading={addTask.isPending}
                  onClick={() => addTask.mutate(taskBody.trim())}
                  size="small"
                >
                  Add task
                </Button>
              </div>
              {tasks.data?.length ? (
                <ul className="timeline">
                  {tasks.data.map((task) => (
                    <li key={task.id}>
                      <span />
                      <div>
                        <strong>{task.body}</strong>
                        <p>{task.completedAt ? "Completed" : "Open"}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No tasks yet.</p>
              )}
            </section>
            <ErrorNotice error={notes.error ?? tasks.error ?? addNote.error ?? addTask.error} />
          </div>
        </Modal>
      ) : null}
    </>
  );
}
