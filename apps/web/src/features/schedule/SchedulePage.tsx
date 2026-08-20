import { useMemo, useState, type ComponentProps } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
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
  RoomResponse,
  ServiceResponse,
  StaffUserResponse
} from "@fitos/contracts";
import { can, useAuth } from "../../app/auth";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading, formatDateTime } from "../shared";

type OccurrenceFormValues = {
  branchId: string;
  serviceId: string;
  trainerUserId: string;
  roomId: string;
  startDate: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
};

const calendarPlugins = [
  dayGridPlugin,
  timeGridPlugin,
  listPlugin,
  interactionPlugin
] as unknown as ComponentProps<typeof FullCalendar>["plugins"];

export function SchedulePage() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState(auth?.branches[0]?.id ?? "");
  const [selectedTrainer, setSelectedTrainer] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string | null>(null);

  const branches = useQuery({ queryKey: ["branches"], queryFn: api.branches });
  const services = useQuery({ queryKey: ["services"], queryFn: api.services });
  const staff = useQuery({ queryKey: ["staff"], queryFn: api.staff });
  const rooms = useQuery({
    queryKey: ["rooms", selectedBranch],
    queryFn: () => api.rooms(selectedBranch || undefined)
  });

  const occurrencesQuery = useQuery({
    queryKey: ["schedule", selectedBranch, selectedTrainer, selectedService],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedBranch) params.set("branchId", selectedBranch);
      if (selectedTrainer) params.set("trainerUserId", selectedTrainer);
      if (selectedService) params.set("serviceId", selectedService);
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
        title: `${service?.name ?? "Class"}${trainer ? ` · ${trainer.user.displayName}` : ""}${room ? ` (${room.name})` : ""}`,
        start: occ.startsAt,
        end: occ.endsAt,
        backgroundColor: isCancelled ? "#3a1d1d" : "#191c20",
        borderColor: isCancelled ? "#ff6464" : "#c6ff00",
        textColor: isCancelled ? "#ff6464" : "#ffffff",
        extendedProps: {
          occurrence: occ,
          service,
          trainer,
          room
        }
      };
    });
  }, [occurrencesQuery.data?.data, services.data, staff.data, rooms.data]);

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

      <ErrorNotice error={occurrencesQuery.error} />

      <section className="filter-row">
        <select
          aria-label="Filter by branch"
          className="fitos-control"
          onChange={(e) => setSelectedBranch(e.target.value)}
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

      {/* Schedule Occurrence Modal */}
      {isCreating ? (
        <CreateOccurrenceModal
          branches={branches.data ?? []}
          isOpen={true}
          onClose={() => setIsCreating(false)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["schedule"] });
            setIsCreating(false);
          }}
          rooms={rooms.data ?? []}
          services={services.data ?? []}
          staff={staff.data ?? []}
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
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  branches: BranchResponse[];
  services: ServiceResponse[];
  staff: StaffUserResponse[];
  rooms: RoomResponse[];
  onSuccess: () => void;
}) {
  const [error, setError] = useState<unknown>(null);
  const now = new Date();
  const defaultDate = now.toISOString().split("T")[0] ?? "";
  const defaultTime = `${String(now.getHours() + 1).padStart(2, "0")}:00`;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<OccurrenceFormValues>({
    defaultValues: {
      branchId: branches[0]?.id ?? "",
      serviceId: services[0]?.id ?? "",
      trainerUserId: "",
      roomId: "",
      startDate: defaultDate,
      startTime: defaultTime,
      durationMinutes: services[0]?.durationMinutes ?? 60,
      capacity: services[0]?.defaultCapacity ?? 15
    }
  });

  const selectedBranchId = watch("branchId");

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
      description="Schedule a class or appointment slot on the master timetable."
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule session"
    >
      <form className="form-stack" onSubmit={handleSubmit(onSubmit)}>
        <div className="form-grid">
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

          <FormField error={errors.startDate?.message} htmlFor="occStartDate" label="Date">
            <input
              className="fitos-control"
              id="occStartDate"
              type="date"
              {...register("startDate", { required: "Date is required" })}
            />
          </FormField>

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
            Schedule session
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
      void queryClient.invalidateQueries({ queryKey: ["schedule"] });
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
          <div>
            <strong className="fitos-data-table__primary">
              {member ? `${member.firstName} ${member.lastName}` : b.memberId.slice(0, 8)}
            </strong>
            <span className="fitos-data-table__muted">{member?.phone ?? "No phone"}</span>
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

  return (
    <Modal
      description={`${formatDateTime(occurrence.startsAt)} – ${formatDateTime(occurrence.endsAt)}`}
      isOpen={isOpen}
      onClose={onClose}
      title={service?.name ?? "Class session"}
    >
      <div className="form-stack">
        <section className="kpi-grid">
          <Card className="kpi">
            <span>Roster</span>
            <strong>
              {activeBookings.length} / {occurrence.capacity}
            </strong>
          </Card>
          <Card className="kpi">
            <span>Location</span>
            <strong style={{ fontSize: "1rem" }}>
              {branch?.name ?? "Branch"} {room ? `· ${room.name}` : ""}
            </strong>
          </Card>
          <Card className="kpi">
            <span>Instructor</span>
            <strong style={{ fontSize: "1rem" }}>{trainer?.user.displayName ?? "None"}</strong>
          </Card>
          <Card className="kpi">
            <span>Status</span>
            <StatusBadge status={occurrence.status} />
          </Card>
        </section>

        <div className="section-header-row">
          <h3>Attending members ({activeBookings.length})</h3>
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

        {bookings.length ? (
          <DataTable columns={bookingColumns} data={bookings} label="Roster" />
        ) : (
          <p className="muted">No members booked into this session yet.</p>
        )}

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
