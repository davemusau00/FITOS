import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Icon, StatusBadge } from "@fitos/ui";
import type { MemberListItem } from "@fitos/contracts";
import { useBranch } from "../../app/branch-context";
import { api } from "../../lib/api/client";
import { branchQueryKeys } from "../../lib/query-keys";
import { todayDate } from "../../lib/date-context";
import { ErrorNotice } from "../shared";

export function ReceptionPage() {
  const { activeBranchId } = useBranch();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedResult, setHighlightedResult] = useState(0);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const selectedMember = useQuery({
    queryKey: ["reception-member", selectedMemberId],
    queryFn: () => api.member(selectedMemberId!),
    enabled: Boolean(selectedMemberId)
  });
  const selectedMemberships = useQuery({
    queryKey: ["reception-member-memberships", selectedMemberId],
    queryFn: () => api.memberMemberships(selectedMemberId!),
    enabled: Boolean(selectedMemberId)
  });
  const selectedCredits = useQuery({
    queryKey: ["reception-member-credits", selectedMemberId],
    queryFn: () => api.creditBalance(selectedMemberId!),
    enabled: Boolean(selectedMemberId)
  });
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set());

  const members = useQuery({
    queryKey: branchQueryKeys.list("members", activeBranchId, `reception:${searchQuery}`),
    queryFn: () =>
      api.members(
        new URLSearchParams({ query: searchQuery, branchId: activeBranchId, limit: "8" })
      ),
    enabled: searchQuery.length >= 2 && Boolean(activeBranchId)
  });

  const occurrences = useQuery({
    queryKey: branchQueryKeys.list("schedule", activeBranchId, "today"),
    queryFn: () => {
      const today = todayDate();
      return api.scheduleOccurrences(
        new URLSearchParams({ from: today, to: today, branchId: activeBranchId, limit: "50" })
      );
    },
    enabled: Boolean(activeBranchId)
  });

  const services = useQuery({
    queryKey: branchQueryKeys.list("services", activeBranchId),
    queryFn: () => api.servicesByBranch(activeBranchId),
    enabled: Boolean(activeBranchId)
  });
  const sessionBookings = useQuery({
    queryKey: branchQueryKeys.list("bookings", activeBranchId, "reception"),
    queryFn: () => api.bookings(new URLSearchParams({ branchId: activeBranchId, limit: "100" })),
    enabled: Boolean(activeBranchId)
  });

  const checkInMutation = useMutation({
    mutationFn: (memberId: string) => {
      if (!activeBranchId) throw new Error("No branch selected.");
      return api.checkIn({ branchId: activeBranchId, memberId });
    },
    onSuccess: (_data, memberId) => {
      setCheckedIn((prev) => new Set([...prev, memberId]));
      setSearchQuery("");
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
    }
  });

  const todayOccurrences = occurrences.data?.data ?? [];
  const confirmedByOccurrence = new Map<string, number>();
  for (const booking of sessionBookings.data?.data ?? []) {
    if (booking.status === "confirmed")
      confirmedByOccurrence.set(
        booking.occurrenceId,
        (confirmedByOccurrence.get(booking.occurrenceId) ?? 0) + 1
      );
  }
  const now = new Date();
  const selectedTodayBookings = (sessionBookings.data?.data ?? []).filter(
    (booking) =>
      booking.memberId === selectedMemberId &&
      booking.status === "confirmed" &&
      todayOccurrences.some((occurrence) => occurrence.id === booking.occurrenceId)
  );

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key === "/" && document.activeElement !== inputRef.current) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <div className="reception-shell">
      {/* Header */}
      <div className="reception-header">
        <div className="reception-header__brand">
          <Icon name="spark" size={22} />
          <span>Front Desk</span>
        </div>
        <div className="reception-header__time">
          {now.toLocaleTimeString("en-KE", {
            hour: "2-digit",
            minute: "2-digit"
          })}
        </div>
      </div>

      {/* Giant Search */}
      <div className="reception-search-zone">
        <div className="reception-search-wrap">
          <Icon name="search" size={28} />
          <input
            autoFocus
            className="reception-search-input"
            id="reception-search"
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setHighlightedResult(0);
            }}
            placeholder="Search member name, phone or member number…"
            ref={inputRef}
            type="text"
            value={searchQuery}
            onKeyDown={(e) => {
              const results = members.data?.data ?? [];
              if (e.key === "ArrowDown" && results.length) {
                e.preventDefault();
                setHighlightedResult((index) => Math.min(index + 1, results.length - 1));
              } else if (e.key === "ArrowUp" && results.length) {
                e.preventDefault();
                setHighlightedResult((index) => Math.max(index - 1, 0));
              } else if (e.key === "Escape") {
                setSearchQuery("");
                setHighlightedResult(0);
              } else if (e.key === "Enter" && results.length) {
                e.preventDefault();
                const member = results[highlightedResult] ?? results[0];
                if (member) checkInMutation.mutate(member.id);
              }
            }}
          />
          {searchQuery && (
            <button
              className="reception-search-clear"
              onClick={() => {
                setSearchQuery("");
                inputRef.current?.focus();
              }}
              type="button"
            >
              ✕
            </button>
          )}
        </div>
        <p className="reception-search-hint">
          Press <kbd>Enter</kbd> to check in the top result instantly
        </p>
      </div>

      <ErrorNotice error={checkInMutation.error} />

      {/* Search Results */}
      {searchQuery.length >= 2 && (
        <div className="reception-results">
          {members.isLoading ? (
            <div className="reception-results__loading">Searching…</div>
          ) : members.data?.data.length ? (
            members.data.data.map((member: MemberListItem, index) => {
              const justCheckedIn = checkedIn.has(member.id);
              const displayName = `${member.firstName} ${member.lastName ?? ""}`.trim();
              const initials = `${member.firstName[0] ?? ""}${member.lastName?.[0] ?? ""}`;
              return (
                <div
                  aria-selected={index === highlightedResult}
                  className={`reception-member-card${justCheckedIn ? " reception-member-card--done" : ""}${index === highlightedResult ? " reception-member-card--highlighted" : ""}`}
                  onMouseEnter={() => setHighlightedResult(index)}
                  onClick={() => setSelectedMemberId(member.id)}
                  key={member.id}
                >
                  <div className="reception-member-card__avatar">{initials}</div>
                  <div className="reception-member-card__info">
                    <strong>{displayName}</strong>
                    <span>{member.phone ?? member.email ?? "—"}</span>
                    <span>#{member.memberNumber ?? "—"}</span>
                  </div>
                  <div className="reception-member-card__status">
                    <StatusBadge status={member.status} />
                  </div>
                  <div className="reception-member-card__action">
                    {justCheckedIn ? (
                      <div className="reception-checkin-success">
                        <Icon name="check" size={20} />
                        Checked In!
                      </div>
                    ) : (
                      <Button
                        loading={checkInMutation.isPending}
                        onClick={() => checkInMutation.mutate(member.id)}
                        variant="primary"
                      >
                        Check In
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="reception-results__empty">
              No members found for &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      )}

      {selectedMemberId ? (
        <aside aria-label="Member quick view" className="reception-member-drawer">
          <div className="reception-member-drawer__header">
            <h2>Member quick view</h2>
            <button
              aria-label="Close member quick view"
              className="reception-search-clear"
              onClick={() => setSelectedMemberId(null)}
              type="button"
            >
              ×
            </button>
          </div>
          {selectedMember.isLoading ? <p className="muted">Loading member…</p> : null}
          {selectedMember.error ? <ErrorNotice error={selectedMember.error} /> : null}
          {selectedMember.data ? (
            <div className="reception-member-drawer__body">
              <h3>
                {selectedMember.data.contact.firstName} {selectedMember.data.contact.lastName ?? ""}
              </h3>
              <StatusBadge status={selectedMember.data.status} />
              <p>
                {selectedMember.data.contact.phone ??
                  selectedMember.data.contact.email ??
                  "No contact recorded"}
              </p>
              <p>Member number: {selectedMember.data.memberNumber ?? "—"}</p>
              <p>
                Credits:{" "}
                {selectedCredits.isLoading ? "Loading…" : (selectedCredits.data?.balance ?? "—")}
              </p>
              <h4>Today&apos;s bookings</h4>
              {!selectedTodayBookings.length ? (
                <div>
                  <p className="muted">No confirmed booking found today.</p>
                  <Button
                    disabled={checkedIn.has(selectedMemberId)}
                    loading={checkInMutation.isPending}
                    onClick={() => checkInMutation.mutate(selectedMemberId)}
                    variant="secondary"
                  >
                    {checkedIn.has(selectedMemberId) ? "Checked In" : "Facility Check-In"}
                  </Button>
                </div>
              ) : (
                selectedTodayBookings.map((booking) => {
                  const occurrence = todayOccurrences.find(
                    (item) => item.id === booking.occurrenceId
                  );
                  const service = occurrence
                    ? services.data?.find((item) => item.id === occurrence.serviceId)
                    : undefined;
                  return (
                    <div className="reception-member-drawer__booking" key={booking.id}>
                      <strong>{service?.name ?? "Session"}</strong>
                      <span>
                        {occurrence
                          ? new Date(occurrence.startsAt).toLocaleTimeString("en-KE", {
                              hour: "2-digit",
                              minute: "2-digit"
                            })
                          : "Time unavailable"}
                      </span>
                      <Button
                        disabled={checkedIn.has(selectedMemberId)}
                        loading={checkInMutation.isPending}
                        onClick={() => checkInMutation.mutate(selectedMemberId)}
                        variant="primary"
                      >
                        {checkedIn.has(selectedMemberId) ? "Checked In" : "Check Into Session"}
                      </Button>
                    </div>
                  );
                })
              )}
              <h4>Memberships</h4>
              {selectedMemberships.isLoading ? <p className="muted">Loading memberships…</p> : null}
              {!selectedMemberships.isLoading && !selectedMemberships.data?.length ? (
                <p className="muted">No memberships recorded.</p>
              ) : null}
              {selectedMemberships.data?.map((membership) => (
                <p key={membership.id}>
                  {membership.status} · {membership.planSnapshot.name}
                </p>
              ))}
            </div>
          ) : null}
        </aside>
      ) : null}

      {/* Today's Sessions — Expected Arrivals */}
      {!searchQuery && (
        <div className="reception-sessions">
          <h2 className="reception-sessions__title">
            <Icon name="calendar" size={18} />
            Today&apos;s Sessions
          </h2>
          {occurrences.isLoading ? (
            <p className="muted">Loading sessions…</p>
          ) : todayOccurrences.length ? (
            <div className="reception-sessions-grid">
              {todayOccurrences.map((occ) => {
                const service = services.data?.find((s) => s.id === occ.serviceId);
                const start = new Date(occ.startsAt);
                const end = new Date(occ.endsAt);
                const isNow = start <= now && end >= now;
                const isUpcoming = start > now;
                const minutesUntilStart = Math.round((start.getTime() - now.getTime()) / 60000);
                return (
                  <Card
                    className={`reception-session-card${isNow ? " reception-session-card--live" : ""}`}
                    key={occ.id}
                  >
                    {isNow && (
                      <div className="reception-session-live-badge">
                        <span className="live-dot" />
                        LIVE NOW
                      </div>
                    )}
                    <div className="reception-session-card__name">{service?.name ?? "Class"}</div>
                    <div className="reception-session-card__time">
                      {start.toLocaleTimeString("en-KE", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}{" "}
                      –{" "}
                      {end.toLocaleTimeString("en-KE", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </div>
                    <div className="reception-session-capacity">
                      {(() => {
                        const booked = confirmedByOccurrence.get(occ.id) ?? 0;
                        const capacity = occ.effectiveCapacity ?? occ.capacity;
                        const percentage =
                          capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;
                        return (
                          <>
                            <div
                              className="reception-session-capacity__bar"
                              style={{ width: `${percentage}%` }}
                            />
                            <span>
                              {booked} / {capacity} booked
                            </span>
                          </>
                        );
                      })()}
                    </div>
                    {isUpcoming && minutesUntilStart > 0 && (
                      <div className="reception-session-card__upcoming">
                        Starts in {minutesUntilStart} min
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <p className="muted">No sessions scheduled for today.</p>
          )}
        </div>
      )}
    </div>
  );
}
