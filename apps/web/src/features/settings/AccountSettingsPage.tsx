import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, FormField, PageHeader } from "@fitos/ui";
import { api } from "../../lib/api/client";
import { useAuth } from "../../app/auth";
import { ErrorNotice, useToast } from "../shared";

export function AccountSettingsPage() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const sessions = useQuery({ queryKey: ["auth-sessions"], queryFn: api.sessions });
  const preferences = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: api.notificationPreferences
  });
  const exportRequests = useQuery({
    queryKey: ["account-export-requests"],
    queryFn: api.accountExportRequests
  });
  const exportMutation = useMutation({
    mutationFn: api.requestAccountExport,
    onSuccess: () => {
      success("Export request submitted.");
      void queryClient.invalidateQueries({ queryKey: ["account-export-requests"] });
    },
    onError: (error) =>
      toastError(error instanceof Error ? error.message : "Unable to request export.")
  });
  const preferencesMutation = useMutation({
    mutationFn: (value: import("@fitos/contracts").NotificationPreferences) =>
      api.updateNotificationPreferences(value),
    onSuccess: () => {
      success("Notification preferences updated.");
      void queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
    onError: (error) =>
      toastError(error instanceof Error ? error.message : "Unable to update preferences.")
  });
  const [displayName, setDisplayName] = useState(auth?.user.displayName ?? "");
  const [phone, setPhone] = useState(auth?.user.phone ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const mutation = useMutation({
    mutationFn: () => api.updateUserProfile({ displayName, phone: phone || null }),
    onSuccess: () => {
      success("Profile updated.");
      void queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
    onError: (error) =>
      toastError(error instanceof Error ? error.message : "Unable to update profile.")
  });
  const passwordMutation = useMutation({
    mutationFn: () => api.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      success("Password updated.");
    },
    onError: (error) =>
      toastError(error instanceof Error ? error.message : "Unable to update password.")
  });
  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => api.revokeSession(sessionId),
    onSuccess: () => {
      success("Session revoked.");
      void queryClient.invalidateQueries({ queryKey: ["auth-sessions"] });
    },
    onError: (error) =>
      toastError(error instanceof Error ? error.message : "Unable to revoke session.")
  });
  return (
    <>
      <PageHeader
        title="Account profile"
        description="Manage the staff identity shown across FITOS."
      />
      <Card>
        <h3>Notification preferences</h3>
        <ErrorNotice error={preferences.error} onRetry={() => void preferences.refetch()} />
        {preferences.data ? (
          <div className="form-stack">
            {(Object.keys(preferences.data) as Array<keyof typeof preferences.data>).map((key) => (
              <label className="form-field__checkbox" key={key}>
                <input
                  checked={preferences.data[key]}
                  disabled={preferencesMutation.isPending}
                  onChange={(event) =>
                    preferencesMutation.mutate({
                      ...preferences.data,
                      [key]: event.target.checked
                    })
                  }
                  type="checkbox"
                />
                <span>
                  {key
                    .replace(/[A-Z]/g, (letter) => ` ${letter}`)
                    .replace(/^./, (letter) => letter.toUpperCase())}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="muted">Loading notification preferences…</p>
        )}
      </Card>
      <Card>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <FormField htmlFor="display-name" label="Display name">
            <input
              id="display-name"
              className="fitos-control"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              maxLength={160}
            />
          </FormField>
          <FormField htmlFor="profile-phone" label="Phone">
            <input
              id="profile-phone"
              className="fitos-control"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={40}
              placeholder="+254 7…"
            />
          </FormField>
          <p className="muted">Email: {auth?.user.email ?? "Not provided"}</p>
          <ErrorNotice error={mutation.error} />
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </Card>
      <Card>
        <h3>Active sessions</h3>
        <ErrorNotice error={sessions.error} onRetry={() => void sessions.refetch()} />
        {sessions.data?.length ? (
          sessions.data.map((session) => (
            <div key={session.id} className="fitos-mobile-data-card">
              <strong>
                {session.current ? "This device" : session.userAgentSummary || "Staff session"}
              </strong>
              <span className="fitos-mobile-data-card__meta">
                Expires {new Date(session.expiresAt).toLocaleString()}
              </span>
              {!session.current ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => revokeMutation.mutate(session.id)}
                >
                  Revoke
                </Button>
              ) : null}
            </div>
          ))
        ) : (
          <p className="muted">No other active sessions.</p>
        )}
      </Card>
      <Card>
        <h3>Data export</h3>
        <p className="muted">
          Request a copy of your organization data. FITOS will keep the request status here while it
          is prepared.
        </p>
        <Button
          disabled={exportMutation.isPending}
          onClick={() => exportMutation.mutate()}
          type="button"
        >
          {exportMutation.isPending ? "Submitting…" : "Request JSON export"}
        </Button>
        <ErrorNotice error={exportRequests.error} onRetry={() => void exportRequests.refetch()} />
        {exportRequests.data?.length ? (
          <div className="form-stack">
            {exportRequests.data.slice(0, 3).map((request) => (
              <span className="muted" key={request.id}>
                {request.status} · {new Date(request.createdAt).toLocaleString()}
              </span>
            ))}
          </div>
        ) : null}
      </Card>
      <Card>
        <h3>Password</h3>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            passwordMutation.mutate();
          }}
        >
          <FormField htmlFor="current-password" label="Current password">
            <input
              id="current-password"
              className="fitos-control"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </FormField>
          <FormField htmlFor="new-password" label="New password">
            <input
              id="new-password"
              className="fitos-control"
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </FormField>
          <ErrorNotice error={passwordMutation.error} />
          <Button type="submit" disabled={passwordMutation.isPending}>
            {passwordMutation.isPending ? "Saving…" : "Change password"}
          </Button>
        </form>
      </Card>
    </>
  );
}
