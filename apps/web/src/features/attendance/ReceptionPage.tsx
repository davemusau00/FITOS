import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Icon, StatusBadge } from "@fitos/ui";
import type { MemberListItem } from "@fitos/contracts";
import { useAuth } from "../../app/auth";
import { api } from "../../lib/api/client";
import { ErrorNotice } from "../shared";

export function ReceptionPage() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set());

  const branches = useQuery({ queryKey: ["branches"], queryFn: api.branches });
  const activeBranchId = auth?.selectedBranchId ?? auth?.branches[0]?.id ?? branches.data?.[0]?.id ?? "";

  const members = useQuery({
    queryKey: ["members", "reception", searchQuery],
    queryFn: () =>
      api.members(new URLSearchParams({ query: searchQuery, limit: "8" })),
    enabled: searchQuery.length >= 2
  });

  const occurrences = useQuery({
    queryKey: ["schedule", "today"],
    queryFn: () => {
      const today = new Date().toISOString().split("T")[0]!;
      return api.scheduleOccurrences(
        new URLSearchParams({ from: today, to: today, limit: "50" })
      );
    }
  });

  const services = useQuery({ queryKey: ["services"], queryFn: api.services });

  const checkInMutation = useMutation({
    mutationFn: (memberId: string) => {
      const branchId = activeBranchId || branches.data?.[0]?.id;
      if (!branchId) throw new Error("No branch selected.");
      return api.checkIn({ branchId, memberId });
    },
    onSuccess: (_data, memberId) => {
      setCheckedIn((prev) => new Set([...prev, memberId]));
      setSearchQuery("");
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
    }
  });

  const todayOccurrences = occurrences.data?.data ?? [];
  const now = new Date();

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
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search member name, phone or member number…"
            ref={inputRef}
            type="text"
            value={searchQuery}
            onKeyDown={(e) => {
              if (e.key === "Enter" && members.data?.data.length === 1) {
                const member = members.data.data[0];
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
            members.data.data.map((member: MemberListItem) => {
              const justCheckedIn = checkedIn.has(member.id);
              const displayName = `${member.firstName} ${member.lastName ?? ""}`.trim();
              const initials = `${member.firstName[0] ?? ""}${member.lastName?.[0] ?? ""}`;
              return (
                <div
                  className={`reception-member-card${justCheckedIn ? " reception-member-card--done" : ""}`}
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
                const minutesUntilStart = Math.round(
                  (start.getTime() - now.getTime()) / 60000
                );
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
                    <div className="reception-session-card__name">
                      {service?.name ?? "Class"}
                    </div>
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
                      <div
                        className="reception-session-capacity__bar"
                        style={{ width: "40%" }}
                      />
                      <span>Capacity: {occ.capacity}</span>
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
