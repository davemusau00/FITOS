import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Card, Icon, Modal } from "@fitos/ui";
import { api } from "../../lib/api/client";
import type { CreatePublicReservationRequest, PublicReservationResponse } from "@fitos/contracts";
import { FitosLogo } from "../../app/logo";
import { ErrorNotice } from "../shared";

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

function weekdayInTimezone(value: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(value);
  return WEEKDAY_INDEX[weekday] ?? 0;
}

export function TenantPublicPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [trialModalOpen, setTrialModalOpen] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string | null>(null);
  const [reservationResult, setReservationResult] = useState<PublicReservationResponse | null>(
    null
  );
  const [leadForm, setLeadForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    interest: ""
  });
  const slug = tenantSlug ?? "";

  const tenantInfo = useQuery({
    queryKey: ["public", slug, "info"],
    queryFn: () => api.publicTenantInfo(slug)
  });

  const services = useQuery({
    queryKey: ["public", slug, "services"],
    queryFn: () => api.publicServices(slug)
  });

  const coaches = useQuery({
    queryKey: ["public", slug, "coaches"],
    queryFn: () => api.publicCoaches(slug)
  });

  const schedule = useQuery({
    queryKey: ["public", slug, "schedule"],
    queryFn: () => api.publicSchedule(slug, 14)
  });

  const publishedSite = useQuery({
    queryKey: ["public", slug, "site", "home"],
    queryFn: () => api.publicSitePage(slug, "home")
  });

  const leadMutation = useMutation({
    mutationFn: (data: typeof leadForm) => {
      return api.publicCreateLead(slug, {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim() || undefined,
        phone: data.phone.trim() || undefined,
        email: data.email.trim() || undefined,
        interest: data.interest || undefined
      });
    },
    onSuccess: () => {
      setLeadSubmitted(true);
    }
  });

  const reservationMutation = useMutation({
    mutationFn: (data: CreatePublicReservationRequest) => api.publicCreateReservation(slug, data),
    onSuccess: (result) => {
      setReservationResult(result);
      setLeadSubmitted(true);
    }
  });

  const publicServices = services.data ?? [];
  const scheduleItems = schedule.data ?? [];
  const tenantTimeZone = tenantInfo.data?.timezone ?? "Africa/Nairobi";
  const visibleSchedule = scheduleItems.filter(
    (occ) => weekdayInTimezone(new Date(occ.startsAt), tenantTimeZone) === selectedDay
  );
  const activeCoaches = coaches.data ?? [];

  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const gymName =
    tenantInfo.data?.name ??
    (tenantSlug
      ? tenantSlug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
      : "FITOS facility");

  useEffect(() => {
    setSelectedDay(weekdayInTimezone(new Date(), tenantTimeZone));
  }, [tenantTimeZone]);

  if (publishedSite.data) {
    return (
      <PublishedSitePage site={publishedSite.data} gymName={tenantInfo.data?.name ?? gymName} />
    );
  }

  const handleOpenTrial = (serviceName?: string) => {
    setLeadForm((prev) => ({ ...prev, interest: serviceName ?? "General Membership" }));
    setLeadSubmitted(false);
    setReservationResult(null);
    setTrialModalOpen(true);
  };

  return (
    <div className="public-portal">
      {/* ── Public Top Navigation ── */}
      <header className="public-nav">
        <div className="public-nav__inner">
          <div className="public-nav__brand">
            <FitosLogo height={24} />
            <span className="public-nav__tenant-badge">{gymName}</span>
          </div>
          <nav className="public-nav__links">
            <a href="#classes">Classes</a>
            <a href="#timetable">Timetable</a>
            <a href="#coaches">Coaches</a>
            <a href="#locations">Location</a>
          </nav>
          <div className="public-nav__actions">
            <Link
              className="fitos-button fitos-button--ghost fitos-button--small"
              to={`/member?tenant=${encodeURIComponent(slug)}`}
            >
              Member Sign In
            </Link>
            <button
              className="fitos-button fitos-button--primary fitos-button--small"
              onClick={() => handleOpenTrial()}
              type="button"
            >
              Book Free Trial
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="public-hero">
        <div className="public-hero__glow" />
        <div className="public-hero__content">
          <div className="public-hero__tag">
            <span className="live-dot" /> High-Performance Training
          </div>
          <h1 className="public-hero__title">
            Welcome to <span>{gymName}</span>
          </h1>
          <p className="public-hero__subtitle">
            Explore the services, timetable, and contact details this facility has published.
          </p>
          <div className="public-hero__cta">
            <button
              className="fitos-button fitos-button--primary fitos-button--large"
              onClick={() => handleOpenTrial()}
              type="button"
            >
              Claim Your Free Trial Pass
            </button>
            <a
              className="fitos-button fitos-button--secondary fitos-button--large"
              href="#timetable"
            >
              Explore Timetable →
            </a>
          </div>
          <div className="public-hero__stats">
            <div className="public-hero__stat">
              <strong>Published</strong>
              <span>Classes Weekly</span>
            </div>
            <div className="public-hero__stat">
              <strong>Configured</strong>
              <span>Trainers Listed</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Classes & Services Grid ── */}
      <section className="public-section" id="classes">
        <div className="public-section__header">
          <span className="public-section__eyebrow">PROGRAMS &amp; SERVICES</span>
          <h2 className="public-section__title">Signature Training Classes</h2>
          <p className="public-section__desc">
            From high-intensity conditioning to functional mobility, find your rhythm.
          </p>
        </div>

        <div className="public-classes-grid">
          {publicServices.map((svc) => (
            <Card className="public-class-card" key={svc.id}>
              <div className="public-class-card__badge">
                <Icon name="spark" size={14} />
                {svc.durationMinutes} min
              </div>
              <h3 className="public-class-card__name">{svc.name}</h3>
              <p className="public-class-card__meta">
                <span>{svc.serviceType.toUpperCase()}</span> ·{" "}
                <span>
                  {svc.creditsRequired} Credit{svc.creditsRequired > 1 ? "s" : ""}
                </span>
              </p>
              <div className="public-class-card__footer">
                <button
                  className="fitos-button fitos-button--primary fitos-button--small"
                  onClick={() => handleOpenTrial(svc.name)}
                  type="button"
                >
                  Book Class Trial
                </button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Timetable Section ── */}
      <section className="public-section public-section--dark" id="timetable">
        <div className="public-section__header">
          <span className="public-section__eyebrow">LIVE SCHEDULE</span>
          <h2 className="public-section__title">Weekly Class Timetable</h2>
          <p className="public-section__desc">Reserve your spot in advance with instant booking.</p>
        </div>

        {/* Day selector pills */}
        <div className="public-day-pills">
          {daysOfWeek.map((d, index) => (
            <button
              className={`public-day-pill${selectedDay === index ? " public-day-pill--active" : ""}`}
              key={d}
              onClick={() => setSelectedDay(index)}
              type="button"
            >
              {d.slice(0, 3)}
            </button>
          ))}
        </div>

        {/* Schedule List */}
        <div className="public-timetable">
          {visibleSchedule.length ? (
            visibleSchedule.map((occ) => {
              const svc = services.data?.find((s) => s.id === occ.serviceId);
              const start = new Date(occ.startsAt);
              const end = new Date(occ.endsAt);
              return (
                <div className="public-timetable-item" key={occ.id}>
                  <div className="public-timetable-item__time">
                    <strong>
                      {start.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                    </strong>
                    <span>
                      {end.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="public-timetable-item__details">
                    <h4>{svc?.name ?? occ.serviceName ?? "Session"}</h4>
                    <p>
                      Coach: {occ.trainerName ?? "Coach not assigned"}
                      {svc?.durationMinutes ? ` · ${svc.durationMinutes} mins` : ""}·{" "}
                      {occ.availableSpots > 0
                        ? `${occ.availableSpots} spots left`
                        : "Full · waitlist available"}
                    </p>
                  </div>
                  <div className="public-timetable-item__action">
                    <button
                      className="fitos-button fitos-button--primary fitos-button--small"
                      onClick={() => {
                        setSelectedOccurrenceId(occ.id);
                        handleOpenTrial(svc?.name);
                      }}
                      type="button"
                    >
                      {occ.availableSpots > 0 ? "Reserve Spot" : "Join Waitlist"}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="public-empty-notice">
              <p>No classes scheduled for this day. Check back soon!</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Coaches Section ── */}
      <section className="public-section" id="coaches">
        <div className="public-section__header">
          <span className="public-section__eyebrow">EXPERT TEAM</span>
          <h2 className="public-section__title">Meet Your Instructors</h2>
          <p className="public-section__desc">
            Meet the trainers and practitioners this facility has published.
          </p>
        </div>

        <div className="public-coaches-grid">
          {activeCoaches.map((coach) => (
            <Card className="public-coach-card" key={coach.id}>
              <div className="public-coach-avatar">{coach.displayName[0]}</div>
              <h3>{coach.displayName}</h3>
              <span className="public-coach-role">{coach.roleName}</span>
              <p className="muted" style={{ fontSize: "0.82rem", marginTop: "0.5rem" }}>
                {coach.bio}
              </p>
            </Card>
          ))}
          {activeCoaches.length === 0 && (
            <p className="muted">Instructor profiles have not been published.</p>
          )}
        </div>
      </section>

      {/* ── Location / Facility ── */}
      <section className="public-section public-section--dark" id="locations">
        <div className="public-section__header">
          <span className="public-section__eyebrow">VISIT US</span>
          <h2 className="public-section__title">Facility &amp; Location</h2>
        </div>

        <div className="public-location-cards">
          {(tenantInfo.data?.branches ?? []).map((branch) => (
            <Card className="public-location-card" key={branch.id}>
              <div className="public-location-card__icon">
                <Icon name="building" size={24} />
              </div>
              <h3>{branch.name}</h3>
              {(branch.addressLine1 || branch.city) && (
                <p>
                  {[branch.addressLine1, branch.city].filter(Boolean).join(", ")} ·{" "}
                  {tenantInfo.data?.timezone}
                </p>
              )}
              {branch.phone && <p>{branch.phone}</p>}
              {branch.email && <p>{branch.email}</p>}
              <button
                className="fitos-button fitos-button--secondary fitos-button--small"
                onClick={() => handleOpenTrial()}
                style={{ marginTop: "1rem" }}
                type="button"
              >
                Schedule Facility Tour
              </button>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="public-footer">
        <div className="public-footer__inner">
          <div className="public-footer__brand">
            <FitosLogo height={22} />
            <p>
              © {new Date().getFullYear()} {gymName}. Powered by FITOS OS.
            </p>
          </div>
          <div className="public-footer__links">
            <Link to="/login">Staff Login</Link>
            <Link to="/member">Member Portal</Link>
          </div>
        </div>
      </footer>

      {/* ── Trial / Reservation Modal ── */}
      {trialModalOpen && (
        <Modal
          description={`Sign up for a free session at ${gymName}. Our team will confirm your spot within minutes.`}
          isOpen={true}
          onClose={() => setTrialModalOpen(false)}
          title="Book Your Free Trial Pass"
        >
          {leadSubmitted ? (
            <div className="public-success-card">
              <div className="public-success-icon">
                <Icon name="check" size={36} />
              </div>
              <h3>
                {reservationResult?.status === "waitlisted"
                  ? "You’re on the waitlist"
                  : reservationResult?.status === "confirmed"
                    ? "Your spot is confirmed"
                    : "You’re All Set!"}
              </h3>
              {reservationResult ? (
                <p>
                  {reservationResult.status === "waitlisted"
                    ? "We’ll let you know if a place opens."
                    : "Your reservation has been recorded."}
                  <br />
                  Reference: <strong>{reservationResult.id.slice(0, 8).toUpperCase()}</strong>
                </p>
              ) : (
                <p>
                  We received your request for{" "}
                  <strong>{leadForm.interest || "General Trial"}</strong>. Our team will contact you
                  shortly.
                </p>
              )}
              <Button onClick={() => setTrialModalOpen(false)} variant="primary">
                Close
              </Button>
            </div>
          ) : (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                if (selectedOccurrenceId) {
                  const occurrence = scheduleItems.find((item) => item.id === selectedOccurrenceId);
                  reservationMutation.mutate({
                    occurrenceId: selectedOccurrenceId,
                    serviceId: occurrence?.serviceId,
                    reservationType: "class",
                    firstName: leadForm.firstName.trim(),
                    lastName: leadForm.lastName.trim() || undefined,
                    phone: leadForm.phone.trim() || undefined,
                    email: leadForm.email.trim() || undefined
                  });
                } else leadMutation.mutate(leadForm);
              }}
            >
              <div className="form-grid">
                <div>
                  <label className="form-field__label">First Name *</label>
                  <input
                    className="fitos-control"
                    onChange={(e) => setLeadForm({ ...leadForm, firstName: e.target.value })}
                    placeholder="Jane"
                    required
                    value={leadForm.firstName}
                  />
                </div>
                <div>
                  <label className="form-field__label">Last Name</label>
                  <input
                    className="fitos-control"
                    onChange={(e) => setLeadForm({ ...leadForm, lastName: e.target.value })}
                    placeholder="Doe"
                    value={leadForm.lastName}
                  />
                </div>
              </div>

              <div className="form-grid">
                <div>
                  <label className="form-field__label">Phone Number *</label>
                  <input
                    className="fitos-control"
                    onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                    placeholder="+254 700 000 000"
                    required
                    value={leadForm.phone}
                  />
                </div>
                <div>
                  <label className="form-field__label">Email Address</label>
                  <input
                    className="fitos-control"
                    onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                    placeholder="jane@example.com"
                    type="email"
                    value={leadForm.email}
                  />
                </div>
              </div>

              <div>
                <label className="form-field__label">Class / Program Interest</label>
                <select
                  className="fitos-control"
                  onChange={(e) => setLeadForm({ ...leadForm, interest: e.target.value })}
                  value={leadForm.interest}
                >
                  <option value="General Membership">General Membership</option>
                  {publicServices.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.durationMinutes} min)
                    </option>
                  ))}
                </select>
              </div>

              <ErrorNotice error={reservationMutation.error ?? leadMutation.error} />

              <div className="form-actions">
                <Button onClick={() => setTrialModalOpen(false)} variant="ghost">
                  Cancel
                </Button>
                <Button
                  disabled={!leadForm.firstName.trim() || !leadForm.phone.trim()}
                  loading={reservationMutation.isPending || leadMutation.isPending}
                  type="submit"
                  variant="primary"
                >
                  {selectedOccurrenceId ? "Confirm Reservation" : "Confirm Free Pass"}
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

function PublishedSitePage({
  site,
  gymName
}: {
  site: import("@fitos/contracts").SitePageResponse;
  gymName: string;
}) {
  return (
    <div className="public-portal">
      <header className="public-nav">
        <div className="public-nav__inner">
          <div className="public-nav__brand">
            <FitosLogo height={24} />
            <span className="public-nav__tenant-badge">{gymName}</span>
          </div>
          <Link className="fitos-button fitos-button--primary fitos-button--small" to="/member">
            Member Sign In
          </Link>
        </div>
      </header>
      {site.sections.map((section, index) => {
        const heading = typeof section.heading === "string" ? section.heading : "";
        const body = typeof section.body === "string" ? section.body : "";
        const label = typeof section.label === "string" ? section.label : "Learn more";
        return (
          <section
            className={section.type === "hero" ? "public-hero" : "public-section"}
            key={`${section.type}-${index}`}
          >
            <div className="public-section__header">
              <span className="public-section__eyebrow">
                {section.type.replace(/_/g, " ").toUpperCase()}
              </span>
              <h1 className="public-section__title">{heading || site.title}</h1>
              {body && <p className="public-section__desc">{body}</p>}
              {section.type === "cta" && (
                <Link className="fitos-button fitos-button--primary" to="/member">
                  {label}
                </Link>
              )}
            </div>
          </section>
        );
      })}
      <footer className="public-footer">
        <div className="public-footer__inner">
          <p>
            © {new Date().getFullYear()} {gymName}. Powered by FITOS OS.
          </p>
        </div>
      </footer>
    </div>
  );
}
