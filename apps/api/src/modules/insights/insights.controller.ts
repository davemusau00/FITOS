import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { CoachAggregateResponse, OpsAggregateResponse, RequestActor } from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { Actor } from "../../common/request-context/actor.decorator.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";

const querySchema = z.object({ branchId: z.string().uuid().optional() }).passthrough();

@ApiTags("insights")
@Controller("insights")
export class InsightsController {
  constructor(@Inject(FitosRepositoryToken) private readonly repository: FitosRepository) {}

  @Get("overview")
  @RequirePermission("attendance:read")
  overview(@Actor() actor: RequestActor, @Query() query: unknown) {
    const { branchId } = querySchema.parse(query);
    const scope = {
      tenantId: actor.tenantId,
      tenantUserId: actor.tenantUserId,
      userId: actor.userId,
      branchIds: actor.branchIds
    };
    return this.repository.getInsightsOverview(scope, branchId);
  }

  @Get("/today")
  @RequirePermission("tenant:read")
  today(@Actor() actor: RequestActor, @Query() query: unknown) {
    const { branchId } = querySchema.extend({ branchId: z.string().uuid() }).parse(query);
    return this.repository.getTodayOverview(
      {
        tenantId: actor.tenantId,
        tenantUserId: actor.tenantUserId,
        userId: actor.userId,
        branchIds: actor.branchIds
      },
      branchId
    );
  }

  @Get("/ops/aggregate")
  @RequirePermission("tenant:read")
  async opsAggregate(
    @Actor() actor: RequestActor,
    @Query() query: unknown
  ): Promise<OpsAggregateResponse> {
    const { branchId } = querySchema.extend({ branchId: z.string().uuid() }).parse(query);
    const scope = {
      tenantId: actor.tenantId,
      tenantUserId: actor.tenantUserId,
      userId: actor.userId,
      branchIds: actor.branchIds
    };
    const [overview, sessions] = await Promise.all([
      this.repository.getTodayOverview(scope, branchId),
      this.repository.listScheduleOccurrences(scope, {
        branchId,
        startsAfter: new Date().toISOString(),
        endsBefore: new Date(Date.now() + 6 * 60 * 60 * 1_000).toISOString(),
        limit: 100
      })
    ]);
    const upcoming = sessions.data;
    const unassignedSessions = upcoming.filter((session) => !session.trainerUserId).length;
    const constrainedSessions = upcoming.filter(
      (session) => (session.effectiveCapacity ?? session.capacity) < session.capacity
    ).length;
    const alertedSessions = upcoming.filter((session) => Boolean(session.capacityAlert)).length;
    const resourceConflicts = upcoming.filter(
      (session) => (session.resourceWarnings?.length ?? 0) > 0
    ).length;
    const actionQueue: OpsAggregateResponse["signals"]["actionQueue"] = [
      ...(overview.attendance.noShows > 0
        ? [
            {
              id: "no-shows",
              type: "no_show" as const,
              label: "No-shows need follow-up",
              count: overview.attendance.noShows,
              href: "/app/attendance"
            }
          ]
        : []),
      ...(overview.bookings.waitlisted > 0
        ? [
            {
              id: "waitlist",
              type: "waitlist" as const,
              label: "Waitlisted bookings",
              count: overview.bookings.waitlisted,
              href: "/app/bookings"
            }
          ]
        : []),
      ...(overview.leads.followUpsDue > 0
        ? [
            {
              id: "follow-ups",
              type: "follow_up" as const,
              label: "Lead follow-ups due",
              count: overview.leads.followUpsDue,
              href: "/app/leads"
            }
          ]
        : []),
      ...(unassignedSessions > 0
        ? [
            {
              id: "unassigned-staff",
              type: "unassigned_staff" as const,
              label: "Sessions without staff coverage",
              count: unassignedSessions,
              href: "/app/schedule"
            }
          ]
        : []),
      ...(resourceConflicts > 0
        ? [
            {
              id: "resource-conflicts",
              type: "resource_conflict" as const,
              label: "Resource conflicts to resolve",
              count: resourceConflicts,
              href: "/app/schedule"
            }
          ]
        : []),
      ...(alertedSessions > 0
        ? [
            {
              id: "capacity-alerts",
              type: "capacity_alert" as const,
              label: "Capacity alerts",
              count: alertedSessions,
              href: "/app/schedule"
            }
          ]
        : [])
    ];
    return {
      overview,
      sessions: upcoming,
      signals: {
        staffCoverage: {
          assignedSessions: upcoming.length - unassignedSessions,
          unassignedSessions
        },
        capacityPressure: { constrainedSessions, alertedSessions },
        resourceConflicts,
        actionQueue
      }
    };
  }

  @Get("/coach/aggregate")
  @RequirePermission("schedule:read")
  async coachAggregate(
    @Actor() actor: RequestActor,
    @Query() query: unknown
  ): Promise<CoachAggregateResponse> {
    const { branchId } = querySchema.extend({ branchId: z.string().uuid() }).parse(query);
    const scope = {
      tenantId: actor.tenantId,
      tenantUserId: actor.tenantUserId,
      userId: actor.userId,
      branchIds: actor.branchIds
    };
    const [overview, sessions] = await Promise.all([
      this.repository.getTodayOverview(scope, branchId),
      this.repository.listScheduleOccurrences(scope, {
        branchId,
        trainerUserId: actor.userId,
        startsAfter: new Date().toISOString(),
        endsBefore: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(),
        limit: 100
      })
    ]);
    const rosterSignals = await Promise.all(
      sessions.data.map(async (session) => {
        const [bookings, attendance] = await Promise.all([
          this.repository.listBookings(scope, { occurrenceId: session.id, limit: 100 }),
          this.repository.listAttendanceRecords(scope, { occurrenceId: session.id, limit: 100 })
        ]);
        const confirmedBookings = bookings.data.filter((booking) => booking.status === "confirmed");
        const waitlistedBookings = bookings.data.filter(
          (booking) => booking.status === "waitlisted"
        );
        const completedAttendance = attendance.data.filter((record) =>
          ["checked_in", "attended", "no_show", "late_cancel"].includes(record.status)
        ).length;
        return {
          confirmedBookings: confirmedBookings.length,
          waitlistedBookings: waitlistedBookings.length,
          checkedIn: attendance.data.filter((record) => record.status === "checked_in").length,
          attended: attendance.data.filter((record) => record.status === "attended").length,
          pendingAttendance: Math.max(0, confirmedBookings.length - completedAttendance)
        };
      })
    );
    return {
      overview,
      sessions: sessions.data,
      signals: rosterSignals.reduce(
        (totals, current) => ({
          confirmedBookings: totals.confirmedBookings + current.confirmedBookings,
          waitlistedBookings: totals.waitlistedBookings + current.waitlistedBookings,
          checkedIn: totals.checkedIn + current.checkedIn,
          attended: totals.attended + current.attended,
          pendingAttendance: totals.pendingAttendance + current.pendingAttendance
        }),
        {
          confirmedBookings: 0,
          waitlistedBookings: 0,
          checkedIn: 0,
          attended: 0,
          pendingAttendance: 0
        }
      )
    };
  }
}
