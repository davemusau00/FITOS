import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import {
  Button,
  Card,
  DataTable,
  type DataTableColumn,
  FormField,
  Modal,
  PageHeader,
  StatusBadge
} from "@fitos/ui";
import type {
  BookingResponse,
  BranchResponse,
  CreateScheduleOccurrenceRequest,
  CreateScheduleTemplateRequest,
  RoomResponse,
  ScheduleOccurrenceResponse,
  ScheduleTemplateResponse,
  ServiceResponse,
  StaffUserResponse
} from "@fitos/contracts";
import { can, useAuth } from "../../app/auth";
import { useBranch } from "../../app/branch-context";
import { api } from "../../lib/api/client";
import { branchQueryKeys } from "../../lib/query-keys";
import { todayDate } from "../../lib/date-context";
import { ErrorNotice, PageLoading, formatDateTime } from "../shared";

type OccurrenceFormValues = {
  scheduleType: "once" | "weekly";
  branchId: string;
  serviceId: string;
  trainerUserId: string;
  roomId: string;
  startDate: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  daysOfWeek: string[];
  effectiveEndDate: string;
  materializeThroughDate: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function addLocalDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const calendarPlugins = [
  dayGridPlugin,
  timeGridPlugin,
  listPlugin,
  interactionPlugin
] as unknown as ComponentProps<typeof FullCalendar>["plugins"];

export function SchedulePage() {
  const { auth } = useAuth();
  const { activeBranchId, setActiveBranch } = useBranch();
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState(activeBranchId);
  const [selectedTrainer, setSelectedTrainer] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string | null>(null);

  useEffect(() => {
    if (activeBranchId && activeBranchId !== selectedBranch) setSelectedBranch(activeBranchId);
  }, [activeBranchId, selectedBranch]);

  const branches = useQuery({ queryKey: ["branches"], queryFn: api.branches });
  const services = useQuery({ queryKey: ["services"], queryFn: api.services });
  const staff = useQuery({ queryKey: ["staff"], queryFn: api.staff });
  const rooms = useQuery({
    queryKey: branchQueryKeys.list("rooms", selectedBranch || "all"),
    queryFn: () => api.rooms(selectedBranch || undefined)
  });
  const templatesQuery = useQuery({
    queryKey: branchQueryKeys.list("schedule-templates", selectedBranch || "all"),
    queryFn: () => api.scheduleTemplates(selectedBranch || undefined)
  });

  const occurrencesQuery = useQuery({
    queryKey: [
      ...branchQueryKeys.list("schedule", selectedBranch || "all", todayDate()),
      selectedTrainer,
      selectedService
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedBranch) params.set("branchId", selectedBranch);
      if (selectedTrainer) params.set("trainerUserId", selectedTrainer);
      if (selectedService) params.set("serviceId", selectedService);
      // Keep the calendar useful across the current week and near-term bookings.
      // The API otherwise defaults to today's local date, which hides sessions
      // created for tomorrow or later in the current calendar view.
      params.set("startsAfter", new Date(Date.now() - 7 * 86_400_000).toISOString());
      params.set("endsBefore", new Date(Date.now() + 90 * 86_400_000).toISOString());
      params.set("limit", "100");
      return api.scheduleOccurrences(params);
    }
  });

  const calendarEvents = useMemo(() => {
    const occurrences = occurrencesQuery.data?.data ?? [];
    return occurrences.map((occ) => {
      const service = services.data?.find((s) => s.id === occ.serviceId);
      const trainer = staff.data?.find((u) => u.user.id === occ.trainerUserId);
      const room = rooms.data?.find((r) => r.id === occ.roomId);

      const isCancelled = occ.status === "cancelled";
      return {
        id: occ.id,
        title: service?.name ?? "Class",
        start: occ.startsAt,
        end: occ.endsAt,
        backgroundColor: isCancelled ? "rgba(58, 29, 29, 0.95)" : "rgba(25, 28, 32, 0.95)",
        borderColor: isCancelled ? "#ff6464" : "rgba(198, 255, 0, 0.4)",
        textColor: isCancelled ? "#ff6464" : "#ffffff",
        extendedProps: {
          occurrence: occ,
          service,
          trainer,
          room,
          isCancelled
        }
      };
    });
  }, [occurrencesQuery.data?.data, services.data, staff.data, rooms.data]);

  const extendTemplate = useMutation({
    mutationFn: (template: ScheduleTemplateResponse) => {
      const startingPoint = template.materializedThrough ?? template.effectiveStartDate;
      const requested = addLocalDays(startingPoint, 84);
      const throughDate =
        template.effectiveEndDate && template.effectiveEndDate < requested
          ? template.effectiveEndDate
          : requested;
      return api.materializeScheduleTemplate(template.id, throughDate);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: branchQueryKeys.all("schedule") });
      void queryClient.invalidateQueries({ queryKey: branchQueryKeys.all("schedule-templates") });
    }
  });

  const templateColumns: DataTableColumn<ScheduleTemplateResponse>[] = [
    {
      id: "service",
      header: "Recurring service",
      cell: (template) => (
        <div>
          <strong className="fitos-data-table__primary">
            {services.data?.find((service) => service.id === template.serviceId)?.name ?? "Service"}
          </strong>
          <span className="fitos-data-table__muted">
            {template.daysOfWeek.map((day) => WEEKDAYS[day]).join(" / ")} at{" "}
            {template.localStartTime}
          </span>
        </div>
      )
    },
    {
      id: "window",
      header: "Materialized",
      cell: (template) => (
        <span>
          Through {template.materializedThrough ?? "not yet"}
          {template.effectiveEndDate ? ` · ends ${template.effectiveEndDate}` : ""}
        </span>
      )
    },
    {
      id: "status",
      header: "Status",
      cell: (template) => <StatusBadge status={template.isActive ? "active" : "inactive"} />
    },
    {
      id: "actions",
      header: "",
      cell: (template) =>
        template.isActive &&
        (!template.effectiveEndDate ||
          template.materializedThrough !== template.effectiveEndDate) &&
        can(auth, "schedule:manage") ? (
          <Button
            loading={extendTemplate.isPending && extendTemplate.variables?.id === template.id}
            onClick={() => extendTemplate.mutate(template)}
            size="small"
            variant="secondary"
          >
            Extend 12 weeks
          </Button>
        ) : null
    }
  ];

  if (branches.isLoading || services.isLoading) return <PageLoading />;

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Schedule"
        description="Master timetable across branches, instructors, and studio rooms."
        actions={
          can(auth, "schedule:manage") ? (
            <Button icon="plus" onClick={() => setIsCreating(true)}>
              Schedule session
            </Button>
          ) : null
        }
      />

      <ErrorNotice error={occurrencesQuery.error} onRetry={() => void occurrencesQuery.refetch()} />

      <section className="filter-row">
        <select
          aria-label="Filter by branch"
          className="fitos-control"
          onChange={(e) => {
            setSelectedBranch(e.target.value);
            if (e.target.value) setActiveBranch(e.target.value);
          }}
          value={selectedBranch}
        >
          <option value="">All accessible branches</option>
          {branches.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by service"
          className="fitos-control"
          onChange={(e) => setSelectedService(e.target.value)}
          value={selectedService}
        >
          <option value="">All services</option>
          {services.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by trainer"
          className="fitos-control"
          onChange={(e) => setSelectedTrainer(e.target.value)}
          value={selectedTrainer}
        >
          <option value="">All trainers</option>
          {staff.data?.map((st) => (
            <option key={st.user.id} value={st.user.id}>
              {st.user.displayName} ({st.role.name})
            </option>
          ))}
        </select>
      </section>

      <Card className="calendar-card">
        <div className="fitos-calendar-wrapper">
          <FullCalendar
            allDaySlot={false}
            aspectRatio={1.75}
            eventClick={(info) => {
              if (info.event.id) setSelectedOccurrenceId(info.event.id);
            }}
            eventContent={(eventInfo) => {
              const { service, trainer, room, isCancelled } = eventInfo.event.extendedProps as {
                service?: ServiceResponse;
                trainer?: StaffUserResponse;
                room?: RoomResponse;
                isCancelled?: boolean;
              };
              return (
                <div
                  className={`fitos-cal-event ${isCancelled ? "fitos-cal-event--cancelled" : ""}`}
                >
                  <div className="fitos-cal-event__time">{eventInfo.timeText}</div>
                  <div className="fitos-cal-event__title">
                    {service?.name ?? eventInfo.event.title}
                  </div>
                  <div className="fitos-cal-event__meta">
                    {trainer ? <span>{trainer.user.displayName}</span> : null}
                    {room ? <span>{room.name}</span> : null}
                  </div>
                </div>
              );
            }}
            eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            events={calendarEvents}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "timeGridWeek,timeGridDay,listWeek"
            }}
            initialView="timeGridWeek"
            nowIndicator={true}
            plugins={calendarPlugins}
            slotMaxTime="22:00:00"
            slotMinTime="05:30:00"
          />
        </div>
      </Card>

      <Card>
        <div className="section-header-row">
          <div>
            <h2>Recurring schedule</h2>
            <p className="muted">Weekly intent is kept separate from generated class sessions.</p>
          </div>
        </div>
        <ErrorNotice
          error={templatesQuery.error ?? extendTemplate.error}
          onRetry={() => void templatesQuery.refetch()}
        />
        {templatesQuery.isLoading ? (
          <PageLoading />
        ) : templatesQuery.data?.length ? (
          <DataTable
            columns={templateColumns}
            data={templatesQuery.data}
            label="Recurring schedules"
            mobileRenderer={(template) => (
              <Card className="fitos-mobile-data-card">
                <div>
                  <strong className="fitos-data-table__primary">
                    {services.data?.find((service) => service.id === template.serviceId)?.name ??
                      "Service"}
                  </strong>
                  <span className="fitos-data-table__muted">
                    {template.daysOfWeek.map((day) => WEEKDAYS[day]).join(" / ")} at{" "}
                    {template.localStartTime}
                  </span>
                </div>
                <div className="fitos-mobile-data-card__meta">
                  <StatusBadge status={template.isActive ? "active" : "inactive"} />
                  <span>Through {template.materializedThrough ?? "not yet"}</span>
                </div>
                {template.effectiveEndDate ? (
                  <span className="fitos-data-table__muted">Ends {template.effectiveEndDate}</span>
                ) : null}
                {template.isActive &&
                (!template.effectiveEndDate ||
                  template.materializedThrough !== template.effectiveEndDate) &&
                can(auth, "schedule:manage") ? (
                  <Button
                    loading={
                      extendTemplate.isPending && extendTemplate.variables?.id === template.id
                    }
                    onClick={() => extendTemplate.mutate(template)}
                    size="small"
                    variant="secondary"
                  >
                    Extend 12 weeks
                  </Button>
                ) : null}
              </Card>
            )}
          />
        ) : (
          <p className="muted">No recurring schedules have been created.</p>
        )}
      </Card>

      {/* Schedule Occurrence Modal */}
      {isCreating ? (
        <CreateOccurrenceModal
          branches={branches.data ?? []}
          isOpen={true}
          onClose={() => setIsCreating(false)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: branchQueryKeys.all("schedule") });
            void queryClient.invalidateQueries({
              queryKey: branchQueryKeys.all("schedule-templates")
            });
            setIsCreating(false);
          }}
          rooms={rooms.data ?? []}
          services={services.data ?? []}
          staff={staff.data ?? []}
          tenantTimezone={auth?.tenant.timezone ?? "Africa/Nairobi"}
        />
      ) : null}

      {/* Occurrence Detail & Bookings Modal */}
      {selectedOccurrenceId ? (
        <OccurrenceDetailModal
          branches={branches.data ?? []}
          isOpen={true}
          occurrenceId={selectedOccurrenceId}
          onClose={() => setSelectedOccurrenceId(null)}
          rooms={rooms.data ?? []}
          services={services.data ?? []}
          staff={staff.data ?? []}
        />
      ) : null}
    </>
  );
}

function CreateOccurrenceModal({
  isOpen,
  onClose,
  branches,
  services,
  staff,
  rooms,
  onSuccess,
  tenantTimezone
}: {
  isOpen: boolean;
  onClose: () => void;
  branches: BranchResponse[];
  services: ServiceResponse[];
  staff: StaffUserResponse[];
  rooms: RoomResponse[];
  onSuccess: () => void;
  tenantTimezone: string;
}) {
  const [error, setError] = useState<unknown>(null);
  const now = new Date();
  const defaultDate = todayDate();
  const defaultTime = `${String(now.getHours() + 1).padStart(2, "0")}:00`;
  const defaultThroughDate = addLocalDays(defaultDate, 83);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<OccurrenceFormValues>({
    defaultValues: {
      scheduleType: "once",
      branchId: branches[0]?.id ?? "",
      serviceId: services[0]?.id ?? "",
      trainerUserId: "",
      roomId: "",
      startDate: defaultDate,
      startTime: defaultTime,
      durationMinutes: services[0]?.durationMinutes ?? 60,
      capacity: services[0]?.defaultCapacity ?? 15,
      daysOfWeek: [String(new Date(`${defaultDate}T00:00:00`).getDay())],
      effectiveEndDate: "",
      materializeThroughDate: defaultThroughDate
    }
  });

  const selectedBranchId = watch("branchId");
  const scheduleType = watch("scheduleType");

  const branchRooms = useMemo(() => {
    return rooms.filter((r) => !r.branchId || r.branchId === selectedBranchId);
  }, [rooms, selectedBranchId]);

  const onServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value;
    const s = services.find((srv) => srv.id === sId);
    if (s) {
      setValue("durationMinutes", s.durationMinutes);
      setValue("capacity", s.defaultCapacity ?? 15);
      if (s.branchId) setValue("branchId", s.branchId);
    }
  };

  const onSubmit = async (values: OccurrenceFormValues) => {
    setError(null);
    try {
      if (values.scheduleType === "weekly") {
        const branch = branches.find((candidate) => candidate.id === values.branchId);
        const payload: CreateScheduleTemplateRequest = {
          branchId: values.branchId,
          serviceId: values.serviceId,
          trainerUserId: values.trainerUserId || null,
          roomId: values.roomId || null,
          timezone: branch?.timezone ?? tenantTimezone,
          daysOfWeek: values.daysOfWeek.map(Number),
          localStartTime: values.startTime,
          durationMinutes: Number(values.durationMinutes),
          capacity: Number(values.capacity),
          effectiveStartDate: values.startDate,
          effectiveEndDate: values.effectiveEndDate || null,
          materializeThroughDate: values.materializeThroughDate
        };
        await api.createScheduleTemplate(payload);
        onSuccess();
        return;
      }

      const startsAtDate = new Date(`${values.startDate}T${values.startTime}:00`);
      const endsAtDate = new Date(startsAtDate.getTime() + values.durationMinutes * 60000);

      const payload: CreateScheduleOccurrenceRequest = {
        branchId: values.branchId,
        serviceId: values.serviceId,
        trainerUserId: values.trainerUserId || null,
        roomId: values.roomId || null,
        startsAt: startsAtDate.toISOString(),
        endsAt: endsAtDate.toISOString(),
        capacity: Number(values.capacity)
      };

      await api.createScheduleOccurrence(payload);
      onSuccess();
    } catch (cause) {
      setError(cause);
    }
  };

  return (
    <Modal
      description="Create one class session or materialize a bounded weekly series."
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule session"
    >
      <form className="form-stack" onSubmit={handleSubmit(onSubmit)}>
        <div className="form-grid">
          <FormField htmlFor="occScheduleType" label="Schedule type">
            <select className="fitos-control" id="occScheduleType" {...register("scheduleType")}>
              <option value="once">One-off session</option>
              <option value="weekly">Weekly recurring series</option>
            </select>
          </FormField>

          <FormField error={errors.serviceId?.message} htmlFor="occService" label="Service / Class">
            <select
              className="fitos-control"
              id="occService"
              {...register("serviceId", { required: "Select a service" })}
              onChange={(e) => {
                register("serviceId").onChange(e);
                onServiceChange(e);
              }}
            >
              <option value="">Select service...</option>
              {services
                .filter((s) => s.isActive)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.durationMinutes} min)
                  </option>
                ))}
            </select>
          </FormField>

          <FormField error={errors.branchId?.message} htmlFor="occBranch" label="Branch">
            <select
              className="fitos-control"
              id="occBranch"
              {...register("branchId", { required: "Select a branch" })}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            error={errors.startDate?.message}
            htmlFor="occStartDate"
            label={scheduleType === "weekly" ? "Effective start" : "Date"}
          >
            <input
              className="fitos-control"
              id="occStartDate"
              type="date"
              {...register("startDate", { required: "Date is required" })}
            />
          </FormField>

          {scheduleType === "weekly" ? (
            <>
              <FormField error={errors.daysOfWeek?.message} htmlFor="occWeekday0" label="Repeat on">
                <div className="filter-row" role="group" aria-label="Recurring weekdays">
                  {WEEKDAYS.map((label, day) => (
                    <label className="fitos-checkbox" key={label}>
                      <input
                        id={`occWeekday${day}`}
                        type="checkbox"
                        value={day}
                        {...register("daysOfWeek", {
                          validate: (value) =>
                            scheduleType !== "weekly" || value.length > 0 || "Select a weekday"
                        })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </FormField>

              <FormField htmlFor="occEffectiveEnd" label="Effective end" optional>
                <input
                  className="fitos-control"
                  id="occEffectiveEnd"
                  min={defaultDate}
                  type="date"
                  {...register("effectiveEndDate")}
                />
              </FormField>

              <FormField
                error={errors.materializeThroughDate?.message}
                htmlFor="occMaterializeThrough"
                label="Generate sessions through"
              >
                <input
                  className="fitos-control"
                  id="occMaterializeThrough"
                  min={defaultDate}
                  type="date"
                  {...register("materializeThroughDate", {
                    required: "A bounded generation date is required"
                  })}
                />
              </FormField>
            </>
          ) : null}

          <FormField error={errors.startTime?.message} htmlFor="occStartTime" label="Start time">
            <input
              className="fitos-control"
              id="occStartTime"
              type="time"
              {...register("startTime", { required: "Time is required" })}
            />
          </FormField>

          <FormField
            error={errors.durationMinutes?.message}
            htmlFor="occDuration"
            label="Duration (minutes)"
          >
            <input
              className="fitos-control"
              id="occDuration"
              min={1}
              type="number"
              {...register("durationMinutes", {
                required: "Duration is required",
                min: { value: 1, message: "Min 1 minute" }
              })}
            />
          </FormField>

          <FormField error={errors.capacity?.message} htmlFor="occCapacity" label="Capacity limit">
            <input
              className="fitos-control"
              id="occCapacity"
              min={1}
              type="number"
              {...register("capacity", {
                required: "Capacity is required",
                min: { value: 1, message: "Min 1 spot" }
              })}
            />
          </FormField>

          <FormField htmlFor="occTrainer" label="Instructor / Trainer" optional>
            <select className="fitos-control" id="occTrainer" {...register("trainerUserId")}>
              <option value="">No instructor assigned</option>
              {staff.map((st) => (
                <option key={st.user.id} value={st.user.id}>
                  {st.user.displayName} ({st.role.name})
                </option>
              ))}
            </select>
          </FormField>

          <FormField htmlFor="occRoom" label="Room / Studio area" optional>
            <select className="fitos-control" id="occRoom" {...register("roomId")}>
              <option value="">No room specified</option>
              {branchRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.capacity ? `(max ${r.capacity})` : ""}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <ErrorNotice error={error} />

        <div className="form-actions">
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
          <Button loading={isSubmitting} type="submit">
            {scheduleType === "weekly" ? "Create recurring series" : "Schedule session"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function OccurrenceDetailModal({
  isOpen,
  onClose,
  occurrenceId,
  branches,
  services,
  staff,
  rooms
}: {
  isOpen: boolean;
  onClose: () => void;
  occurrenceId: string;
  branches: BranchResponse[];
  services: ServiceResponse[];
  staff: StaffUserResponse[];
  rooms: RoomResponse[];
}) {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cancelReason, setCancelReason] = useState("");
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [isOverriding, setIsOverriding] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const occQuery = useQuery({
    queryKey: ["schedule", occurrenceId],
    queryFn: () => api.scheduleOccurrence(occurrenceId)
  });

  const bookingsQuery = useQuery({
    queryKey: ["bookings", { occurrenceId }],
    queryFn: () => {
      const p = new URLSearchParams();
      p.set("occurrenceId", occurrenceId);
      return api.bookings(p);
    }
  });

  const membersQuery = useQuery({
    queryKey: ["members", "all"],
    queryFn: () => api.members(new URLSearchParams({ limit: "100" }))
  });

  const occurrence = occQuery.data;
  const bookings = bookingsQuery.data?.data ?? [];
  const activeBookings = bookings.filter((b) => b.status === "confirmed");

  const service = services.find((s) => s.id === occurrence?.serviceId);
  const branch = branches.find((b) => b.id === occurrence?.branchId);
  const trainer = staff.find((st) => st.user.id === occurrence?.trainerUserId);
  const room = rooms.find((r) => r.id === occurrence?.roomId);

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => api.cancelScheduleOccurrence(occurrenceId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: branchQueryKeys.all("schedule") });
      onClose();
    },
    onError: (err) => setError(err)
  });

  const bookingColumns: DataTableColumn<BookingResponse>[] = [
    {
      id: "member",
      header: "Booked member",
      cell: (b) => {
        const member = membersQuery.data?.data.find((m) => m.id === b.memberId);
        return (
          <div className="table-member-cell">
            <div
              className="table-member-avatar"
              style={{ width: "1.875rem", height: "1.875rem", fontSize: "0.75rem" }}
            >
              {member ? `${member.firstName[0]}${member.lastName?.[0] ?? ""}` : "M"}
            </div>
            <div>
              <strong className="fitos-data-table__primary">
                {member
                  ? `${member.firstName} ${member.lastName ?? ""}`.trim()
                  : b.memberId.slice(0, 8)}
              </strong>
              <span className="fitos-data-table__muted">{member?.phone ?? "No phone"}</span>
            </div>
          </div>
        );
      }
    },
    {
      id: "source",
      header: "Source",
      cell: (b) => <StatusBadge status={b.source} />
    },
    {
      id: "status",
      header: "Status",
      cell: (b) => <StatusBadge status={b.status} />
    },
    {
      id: "bookedAt",
      header: "Booked",
      cell: (b) => formatDateTime(b.bookedAt)
    }
  ];

  if (occQuery.isLoading) return <PageLoading />;
  if (!occurrence) return null;

  const fillPercent = Math.min(
    100,
    Math.round((activeBookings.length / (occurrence.capacity || 1)) * 100)
  );
  const spotsLeft = Math.max(0, occurrence.capacity - activeBookings.length);

  return (
    <Modal
      description={`${formatDateTime(occurrence.startsAt)} – ${formatDateTime(occurrence.endsAt)}`}
      isOpen={isOpen}
      onClose={onClose}
      title={service?.name ?? "Class session"}
    >
      <div className="form-stack">
        <div className="session-detail-grid">
          <div className="session-detail-stat-card">
            <span className="session-detail-stat-card__label">ROSTER &amp; CAPACITY</span>
            <div className="session-detail-stat-card__value">
              <strong>{activeBookings.length}</strong>
              <span className="muted">/ {occurrence.capacity} booked</span>
            </div>
            <div className="session-cap-bar">
              <div
                className="session-cap-bar__fill"
                style={{
                  width: `${fillPercent}%`,
                  background: fillPercent >= 100 ? "var(--danger)" : "var(--fitos-energy)"
                }}
              />
            </div>
            <span className="session-detail-stat-card__sub">
              {spotsLeft === 0 ? "Session full" : `${spotsLeft} spots available`}
            </span>
          </div>

          <div className="session-detail-stat-card">
            <span className="session-detail-stat-card__label">LOCATION</span>
            <div className="session-detail-stat-card__value">
              <strong>{room?.name ?? "Location not configured"}</strong>
            </div>
            <span className="session-detail-stat-card__sub">
              {branch?.name ?? "Branch not available"}
            </span>
          </div>

          <div className="session-detail-stat-card">
            <span className="session-detail-stat-card__label">INSTRUCTOR</span>
            <div className="session-detail-stat-card__value">
              <strong>{trainer?.user.displayName ?? "No instructor"}</strong>
            </div>
            <span className="session-detail-stat-card__sub">
              {trainer ? `${trainer.role.name} Coach` : "Staff unassigned"}
            </span>
          </div>

          <div className="session-detail-stat-card">
            <span className="session-detail-stat-card__label">SESSION STATUS</span>
            <div style={{ marginTop: "0.25rem" }}>
              <StatusBadge status={occurrence.status} />
            </div>
            <span className="session-detail-stat-card__sub" style={{ marginTop: "0.4rem" }}>
              {occurrence.templateId ? "Weekly recurring series" : "One-off session"}
            </span>
          </div>
        </div>

        <div className="section-header-row">
          <h3>Attending members ({activeBookings.length})</h3>
          <div className="form-actions">
            {can(auth, "attendance:read") ? (
              <Link
                className="fitos-button fitos-button--secondary fitos-button--small"
                to={`/app/attendance/roster/${occurrence.id}`}
              >
                Open class roster
              </Link>
            ) : null}
            {occurrence.status === "scheduled" &&
            activeBookings.length < occurrence.capacity &&
            can(auth, "booking:create") ? (
              <Button
                icon="plus"
                onClick={() => {
                  onClose();
                  navigate(`/app/bookings/new?occurrenceId=${occurrence.id}`);
                }}
                size="small"
              >
                Book member
              </Button>
            ) : null}
          </div>
        </div>

        {bookings.length ? (
          <DataTable columns={bookingColumns} data={bookings} label="Roster" />
        ) : (
          <p className="muted">No members booked into this session yet.</p>
        )}

        {occurrence.templateId &&
        occurrence.status === "scheduled" &&
        can(auth, "schedule:manage") ? (
          isOverriding ? (
            <OverrideOccurrenceForm
              activeBookingCount={activeBookings.length}
              occurrence={occurrence}
              onCancel={() => setIsOverriding(false)}
              onSuccess={() => {
                void queryClient.invalidateQueries({ queryKey: branchQueryKeys.all("schedule") });
                onClose();
              }}
              rooms={rooms.filter((candidate) => candidate.branchId === occurrence.branchId)}
              staff={staff.filter((candidate) =>
                candidate.branches.some(
                  (candidateBranch) => candidateBranch.id === occurrence.branchId
                )
              )}
            />
          ) : (
            <div className="form-actions">
              <Button onClick={() => setIsOverriding(true)} variant="secondary">
                Override this session
              </Button>
            </div>
          )
        ) : null}

        <hr className="divider" />

        {occurrence.status === "scheduled" && can(auth, "schedule:manage") ? (
          <div className="danger-zone">
            {!isConfirmingCancel ? (
              <Button icon="warning" onClick={() => setIsConfirmingCancel(true)} variant="danger">
                Cancel this session
              </Button>
            ) : (
              <div className="form-stack">
                <FormField
                  error={!cancelReason.trim() ? "Reason is required" : undefined}
                  htmlFor="cancelReason"
                  label="Reason for cancellation"
                >
                  <input
                    className="fitos-control"
                    id="cancelReason"
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="e.g. Instructor illness, studio maintenance"
                    value={cancelReason}
                  />
                </FormField>
                <ErrorNotice error={error} />
                <div className="form-actions">
                  <Button onClick={() => setIsConfirmingCancel(false)} variant="ghost">
                    Back
                  </Button>
                  <Button
                    disabled={!cancelReason.trim()}
                    loading={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(cancelReason.trim())}
                    variant="danger"
                  >
                    Confirm cancellation
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

type OverrideFormValues = {
  trainerUserId: string;
  roomId: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  reason: string;
};

function localDateTimeInput(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function OverrideOccurrenceForm({
  occurrence,
  activeBookingCount,
  rooms,
  staff,
  onCancel,
  onSuccess
}: {
  occurrence: ScheduleOccurrenceResponse;
  activeBookingCount: number;
  rooms: RoomResponse[];
  staff: StaffUserResponse[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [error, setError] = useState<unknown>(null);
  const durationMinutes = Math.round(
    (new Date(occurrence.endsAt).getTime() - new Date(occurrence.startsAt).getTime()) / 60_000
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<OverrideFormValues>({
    defaultValues: {
      trainerUserId: occurrence.trainerUserId ?? "",
      roomId: occurrence.roomId ?? "",
      startsAt: localDateTimeInput(occurrence.startsAt),
      durationMinutes,
      capacity: occurrence.capacity,
      reason: ""
    }
  });

  const onSubmit = async (values: OverrideFormValues) => {
    setError(null);
    try {
      const startsAt = new Date(values.startsAt);
      await api.overrideScheduleOccurrence(occurrence.id, {
        trainerUserId: values.trainerUserId || null,
        roomId: values.roomId || null,
        startsAt: startsAt.toISOString(),
        endsAt: new Date(
          startsAt.getTime() + Number(values.durationMinutes) * 60_000
        ).toISOString(),
        capacity: Number(values.capacity),
        reason: values.reason.trim()
      });
      onSuccess();
    } catch (cause) {
      setError(cause);
    }
  };

  return (
    <form className="form-stack" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <h3>One-off override</h3>
        <p className="muted">The recurring template remains unchanged.</p>
      </div>
      <div className="form-grid">
        <FormField error={errors.startsAt?.message} htmlFor="overrideStartsAt" label="Starts at">
          <input
            className="fitos-control"
            id="overrideStartsAt"
            type="datetime-local"
            {...register("startsAt", { required: "Start date and time are required" })}
          />
        </FormField>
        <FormField
          error={errors.durationMinutes?.message}
          htmlFor="overrideDuration"
          label="Duration (minutes)"
        >
          <input
            className="fitos-control"
            id="overrideDuration"
            min={1}
            type="number"
            {...register("durationMinutes", { required: true, min: 1 })}
          />
        </FormField>
        <FormField error={errors.capacity?.message} htmlFor="overrideCapacity" label="Capacity">
          <input
            className="fitos-control"
            id="overrideCapacity"
            min={Math.max(1, activeBookingCount)}
            type="number"
            {...register("capacity", {
              required: true,
              min: {
                value: Math.max(1, activeBookingCount),
                message: "Capacity cannot be below confirmed bookings"
              }
            })}
          />
        </FormField>
        <FormField htmlFor="overrideTrainer" label="Instructor" optional>
          <select className="fitos-control" id="overrideTrainer" {...register("trainerUserId")}>
            <option value="">No instructor assigned</option>
            {staff.map((candidate) => (
              <option key={candidate.user.id} value={candidate.user.id}>
                {candidate.user.displayName}
              </option>
            ))}
          </select>
        </FormField>
        <FormField htmlFor="overrideRoom" label="Room" optional>
          <select className="fitos-control" id="overrideRoom" {...register("roomId")}>
            <option value="">No room assigned</option>
            {rooms.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField error={errors.reason?.message} htmlFor="overrideReason" label="Reason">
          <input
            className="fitos-control"
            id="overrideReason"
            {...register("reason", { required: "An audit reason is required" })}
          />
        </FormField>
      </div>
      <ErrorNotice error={error} />
      <div className="form-actions">
        <Button onClick={onCancel} variant="ghost">
          Back
        </Button>
        <Button loading={isSubmitting} type="submit">
          Save one-off override
        </Button>
      </div>
    </form>
  );
}
