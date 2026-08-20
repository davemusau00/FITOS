import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Checkbox,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FormField,
  Icon,
  Modal,
  PageHeader,
  StatusBadge
} from "@fitos/ui";
import type {
  BranchResponse,
  CreateRoomRequest,
  CreateServiceRequest,
  RoomResponse,
  ServiceResponse,
  ServiceType,
  UpdateServiceRequest
} from "@fitos/contracts";
import { can, useAuth } from "../../app/auth";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading, formatCurrency } from "../shared";

const serviceTypes: { label: string; value: ServiceType }[] = [
  { label: "Class", value: "class" },
  { label: "Appointment", value: "appointment" },
  { label: "Facility", value: "facility" },
  { label: "Access", value: "access" }
];

type ServiceFormValues = {
  name: string;
  slug: string;
  serviceType: ServiceType;
  durationMinutes: number;
  defaultCapacity: string;
  priceAmount: string;
  currency: string;
  branchId: string;
  publicVisible: boolean;
  isActive: boolean;
};

export function ServicesPage() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [editingService, setEditingService] = useState<ServiceResponse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isManagingRooms, setIsManagingRooms] = useState(false);

  const branches = useQuery({ queryKey: ["branches"], queryFn: api.branches });
  const services = useQuery({ queryKey: ["services"], queryFn: api.services });
  const rooms = useQuery({
    queryKey: ["rooms", selectedBranch],
    queryFn: () => api.rooms(selectedBranch || undefined)
  });

  const filteredServices = (services.data ?? []).filter((s) => {
    if (selectedBranch && s.branchId && s.branchId !== selectedBranch) return false;
    if (selectedType && s.serviceType !== selectedType) return false;
    return true;
  });

  const columns: DataTableColumn<ServiceResponse>[] = [
    {
      id: "service",
      header: "Service",
      cell: (service) => (
        <div>
          <strong className="fitos-data-table__primary">{service.name}</strong>
          <span className="fitos-data-table__muted">{service.slug}</span>
        </div>
      )
    },
    {
      id: "type",
      header: "Type",
      cell: (service) => <StatusBadge status={service.serviceType} />
    },
    {
      id: "duration",
      header: "Duration",
      cell: (service) => `${service.durationMinutes} min`
    },
    {
      id: "capacity",
      header: "Capacity",
      cell: (service) => (service.defaultCapacity ? `${service.defaultCapacity} spots` : "—")
    },
    {
      id: "price",
      header: "Price",
      cell: (service) =>
        service.price ? formatCurrency(service.price.amountMinor, service.price.currency) : "Free"
    },
    {
      id: "branch",
      header: "Branch",
      cell: (service) =>
        service.branchId
          ? (branches.data?.find((b) => b.id === service.branchId)?.name ?? "Assigned")
          : "All branches"
    },
    {
      id: "visibility",
      header: "Public",
      cell: (service) => (service.publicVisible ? "Yes" : "Internal only")
    },
    {
      id: "status",
      header: "Status",
      cell: (service) => <StatusBadge status={service.isActive ? "active" : "inactive"} />
    },
    {
      id: "actions",
      header: "",
      cell: (service) =>
        can(auth, "service:manage") ? (
          <Button onClick={() => setEditingService(service)} size="small" variant="ghost">
            Edit
          </Button>
        ) : null
    }
  ];

  if (services.isLoading || branches.isLoading) return <PageLoading />;

  return (
    <>
      <PageHeader
        eyebrow="Offerings"
        title="Services"
        description="Configure class types, private training, appointments, and studio rooms."
        actions={
          <>
            <Button icon="building" onClick={() => setIsManagingRooms(true)} variant="secondary">
              Rooms & Resources
            </Button>
            {can(auth, "service:manage") ? (
              <Button icon="plus" onClick={() => setIsCreating(true)}>
                Add service
              </Button>
            ) : null}
          </>
        }
      />

      <ErrorNotice error={services.error} />

      <section className="filter-row">
        <select
          aria-label="Filter by branch"
          className="fitos-control"
          onChange={(e) => setSelectedBranch(e.target.value)}
          value={selectedBranch}
        >
          <option value="">All branches</option>
          {branches.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by service type"
          className="fitos-control"
          onChange={(e) => setSelectedType(e.target.value)}
          value={selectedType}
        >
          <option value="">All types</option>
          {serviceTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </section>

      {!filteredServices.length ? (
        <EmptyState
          action={
            can(auth, "service:manage") ? (
              <Button icon="plus" onClick={() => setIsCreating(true)}>
                Create first service
              </Button>
            ) : undefined
          }
          description="Services define what can be scheduled and booked across your branches."
          title="No services found"
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredServices}
          label="Services"
          onRowClick={(s) => can(auth, "service:manage") && setEditingService(s)}
        />
      )}

      {/* Service Create/Edit Modal */}
      {isCreating || editingService ? (
        <ServiceEditorModal
          branches={branches.data ?? []}
          defaultCurrency={auth?.tenant.currency ?? "KES"}
          isOpen={true}
          onClose={() => {
            setIsCreating(false);
            setEditingService(null);
          }}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["services"] });
            setIsCreating(false);
            setEditingService(null);
          }}
          service={editingService}
        />
      ) : null}

      {/* Rooms & Resources Modal */}
      {isManagingRooms ? (
        <RoomsManagerModal
          branches={branches.data ?? []}
          isOpen={true}
          onClose={() => setIsManagingRooms(false)}
          rooms={rooms.data ?? []}
        />
      ) : null}
    </>
  );
}

function ServiceEditorModal({
  isOpen,
  onClose,
  service,
  branches,
  defaultCurrency,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  service: ServiceResponse | null;
  branches: BranchResponse[];
  defaultCurrency: string;
  onSuccess: () => void;
}) {
  const isEditing = Boolean(service);
  const [error, setError] = useState<unknown>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ServiceFormValues>({
    defaultValues: {
      name: service?.name ?? "",
      slug: service?.slug ?? "",
      serviceType: service?.serviceType ?? "class",
      durationMinutes: service?.durationMinutes ?? 60,
      defaultCapacity: service?.defaultCapacity ? String(service.defaultCapacity) : "15",
      priceAmount: service?.price ? String(parseInt(service.price.amountMinor, 10) / 100) : "",
      currency: service?.price?.currency ?? defaultCurrency,
      branchId: service?.branchId ?? "",
      publicVisible: service?.publicVisible ?? true,
      isActive: service?.isActive ?? true
    }
  });

  const onSubmit = async (values: ServiceFormValues) => {
    setError(null);
    try {
      const price = values.priceAmount.trim()
        ? {
            amountMinor: String(Math.round(parseFloat(values.priceAmount) * 100)),
            currency: values.currency.trim().toUpperCase()
          }
        : null;

      if (isEditing && service) {
        const updatePayload: UpdateServiceRequest = {
          name: values.name.trim(),
          durationMinutes: Number(values.durationMinutes),
          defaultCapacity: values.defaultCapacity ? Number(values.defaultCapacity) : null,
          price,
          publicVisible: values.publicVisible,
          isActive: values.isActive
        };
        await api.updateService(service.id, updatePayload);
      } else {
        const createPayload: CreateServiceRequest = {
          name: values.name.trim(),
          slug: values.slug.trim() || undefined,
          serviceType: values.serviceType,
          durationMinutes: Number(values.durationMinutes),
          defaultCapacity: values.defaultCapacity ? Number(values.defaultCapacity) : null,
          price,
          branchId: values.branchId || null,
          publicVisible: values.publicVisible
        };
        await api.createService(createPayload);
      }
      onSuccess();
    } catch (cause) {
      setError(cause);
    }
  };

  return (
    <Modal
      description={
        isEditing
          ? "Update details, duration, capacity, or visibility."
          : "Define a bookable offering with standard duration and capacity."
      }
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit ${service?.name}` : "Add service"}
    >
      <form className="form-stack" onSubmit={handleSubmit(onSubmit)}>
        <div className="form-grid">
          <FormField error={errors.name?.message} htmlFor="serviceName" label="Service name">
            <input
              className="fitos-control"
              id="serviceName"
              placeholder="e.g. Reformer Pilates"
              {...register("name", { required: "Name is required" })}
            />
          </FormField>

          {!isEditing ? (
            <FormField htmlFor="serviceSlug" label="URL Slug" optional>
              <input
                className="fitos-control"
                id="serviceSlug"
                placeholder="e.g. reformer-pilates"
                {...register("slug")}
              />
            </FormField>
          ) : null}

          <FormField htmlFor="serviceType" label="Service type">
            <select
              className="fitos-control"
              id="serviceType"
              disabled={isEditing}
              {...register("serviceType")}
            >
              {serviceTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            error={errors.durationMinutes?.message}
            htmlFor="durationMinutes"
            label="Duration (minutes)"
          >
            <input
              className="fitos-control"
              id="durationMinutes"
              min={1}
              type="number"
              {...register("durationMinutes", {
                required: "Duration is required",
                min: { value: 1, message: "Must be at least 1 min" }
              })}
            />
          </FormField>

          <FormField htmlFor="defaultCapacity" label="Default capacity" optional>
            <input
              className="fitos-control"
              id="defaultCapacity"
              min={1}
              placeholder="e.g. 12"
              type="number"
              {...register("defaultCapacity")}
            />
          </FormField>

          <FormField htmlFor="serviceBranch" label="Branch limitation" optional>
            <select className="fitos-control" id="serviceBranch" {...register("branchId")}>
              <option value="">Organization-wide (All branches)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField htmlFor="priceAmount" label="Price (KES/amount)" optional>
            <input
              className="fitos-control"
              id="priceAmount"
              placeholder="e.g. 1500 (leave blank if included/free)"
              step="0.01"
              type="number"
              {...register("priceAmount")}
            />
          </FormField>
        </div>

        <div className="checkbox-stack">
          <label className="fitos-checkbox-row">
            <Checkbox {...register("publicVisible")} />
            <span>Visible on public booking timetable</span>
          </label>
          {isEditing ? (
            <label className="fitos-checkbox-row">
              <Checkbox {...register("isActive")} />
              <span>Active (available for scheduling)</span>
            </label>
          ) : null}
        </div>

        <ErrorNotice error={error} />

        <div className="form-actions">
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
          <Button loading={isSubmitting} type="submit">
            {isEditing ? "Save changes" : "Create service"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RoomsManagerModal({
  isOpen,
  onClose,
  branches,
  rooms
}: {
  isOpen: boolean;
  onClose: () => void;
  branches: BranchResponse[];
  rooms: RoomResponse[];
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting }
  } = useForm<CreateRoomRequest>({
    defaultValues: {
      branchId: branches[0]?.id ?? "",
      name: "",
      capacity: undefined
    }
  });

  const onSubmit = async (values: CreateRoomRequest) => {
    setError(null);
    try {
      await api.createRoom({
        branchId: values.branchId,
        name: values.name.trim(),
        capacity: values.capacity ? Number(values.capacity) : null
      });
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
      reset();
    } catch (cause) {
      setError(cause);
    }
  };

  return (
    <Modal
      description="Rooms and resource areas prevent double-booking across concurrent occurrences."
      isOpen={isOpen}
      onClose={onClose}
      title="Rooms & Resources"
    >
      <div className="form-stack">
        <h3>Existing rooms</h3>
        {rooms.length ? (
          <ul className="activity-list">
            {rooms.map((room) => {
              const branch = branches.find((b) => b.id === room.branchId);
              return (
                <li key={room.id}>
                  <div>
                    <strong>{room.name}</strong>
                    <span className="fitos-data-table__muted">
                      {branch?.name ?? "Branch"} {room.capacity ? `· Max ${room.capacity}` : ""}
                    </span>
                  </div>
                  <StatusBadge status={room.isActive ? "active" : "inactive"} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">No rooms created yet.</p>
        )}

        <hr className="divider" />

        <h3>Add new room</h3>
        <form className="form-stack" onSubmit={handleSubmit(onSubmit)}>
          <div className="form-grid">
            <FormField htmlFor="roomBranch" label="Branch">
              <select
                className="fitos-control"
                id="roomBranch"
                {...register("branchId", { required: true })}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField htmlFor="roomName" label="Room name">
              <input
                className="fitos-control"
                id="roomName"
                placeholder="e.g. Studio A, Reformer Room"
                {...register("name", { required: true })}
              />
            </FormField>
            <FormField htmlFor="roomCapacity" label="Capacity limit" optional>
              <input
                className="fitos-control"
                id="roomCapacity"
                placeholder="e.g. 20"
                type="number"
                {...register("capacity")}
              />
            </FormField>
          </div>

          <ErrorNotice error={error} />

          <div className="form-actions">
            <Button loading={isSubmitting} type="submit">
              Add room
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
