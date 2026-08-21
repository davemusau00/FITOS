import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Card, Icon, Modal } from "@fitos/ui";
import { api } from "../../lib/api/client";
import { FitosLogo } from "../../app/logo";
import { ErrorNotice } from "../shared";

export function TenantPublicPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [trialModalOpen, setTrialModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    interest: ""
  });
  const [leadSubmitted, setLeadSubmitted] = useState(false);

  const services = useQuery({ queryKey: ["services", "public"], queryFn: api.services });
  const branches = useQuery({ queryKey: ["branches", "public"], queryFn: api.branches });
  const staff = useQuery({ queryKey: ["staff", "public"], queryFn: api.staff });
  const occurrences = useQuery({
    queryKey: ["schedule", "public"],
    queryFn: () => {
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      return api.scheduleOccurrences(
        new URLSearchParams({
          from: today.toISOString().split("T")[0]!,
          to: nextWeek.toISOString().split("T")[0]!,
          limit: "100"
        })
      );
    }
  });

  const leadMutation = useMutation({
    mutationFn: (data: typeof leadForm) => {
      const branchId = branches.data?.[0]?.id ?? "";
      return api.createLead({
        contact: {
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim() || undefined,
          phone: data.phone.trim() || undefined,
          email: data.email.trim() || undefined
        },
        source: "website",
        interest: data.interest || undefined,
        branchId
      });
    },
    onSuccess: () => {
      setLeadSubmitted(true);
    }
  });

  const publicServices = services.data?.filter((s) => s.isActive && s.publicVisible) ?? services.data ?? [];
  const scheduleItems = occurrences.data?.data ?? [];
  const activeStaff = staff.data ?? [];

  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const gymName = tenantSlug ? tenantSlug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "Apex Fitness Club";

  const handleOpenTrial = (serviceName?: string) => {
    setLeadForm((prev) => ({ ...prev, interest: serviceName ?? "General Membership" }));
    setLeadSubmitted(false);
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
            <Link className="fitos-button fitos-button--ghost fitos-button--small" to="/login">
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
            Transform Your Strength at <span>{gymName}</span>
          </h1>
          <p className="public-hero__subtitle">
            World-class coaches, dynamic classes, and state-of-the-art facilities designed to push your limits.
          </p>
          <div className="public-hero__cta">
            <button
              className="fitos-button fitos-button--primary fitos-button--large"
              onClick={() => handleOpenTrial()}
              type="button"
            >
              Claim Your Free Trial Pass
            </button>
            <a className="fitos-button fitos-button--secondary fitos-button--large" href="#timetable">
              Explore Timetable →
            </a>
          </div>
          <div className="public-hero__stats">
            <div className="public-hero__stat">
              <strong>15+</strong>
              <span>Classes Weekly</span>
            </div>
            <div className="public-hero__stat">
              <strong>100%</strong>
              <span>Certified Trainers</span>
            </div>
            <div className="public-hero__stat">
              <strong>5★</strong>
              <span>Member Experience</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Classes & Services Grid ── */}
      <section className="public-section" id="classes">
        <div className="public-section__header">
          <span className="public-section__eyebrow">PROGRAMS &amp; SERVICES</span>
          <h2 className="public-section__title">Signature Training Classes</h2>
          <p className="public-section__desc">From high-intensity conditioning to functional mobility, find your rhythm.</p>
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
                <span>{svc.defaultCapacity ? `Up to ${svc.defaultCapacity} spots` : "Open capacity"}</span>
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
          {scheduleItems.length ? (
            scheduleItems.map((occ) => {
              const svc = services.data?.find((s) => s.id === occ.serviceId);
              const trainer = staff.data?.find((u) => u.user.id === occ.trainerUserId);
              const start = new Date(occ.startsAt);
              const end = new Date(occ.endsAt);
              return (
                <div className="public-timetable-item" key={occ.id}>
                  <div className="public-timetable-item__time">
                    <strong>{start.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</strong>
                    <span>{end.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="public-timetable-item__details">
                    <h4>{svc?.name ?? "Class Session"}</h4>
                    <p>
                      Coach: {trainer?.user.displayName ?? "Head Coach"} · {svc?.durationMinutes ?? 45} mins
                    </p>
                  </div>
                  <div className="public-timetable-item__action">
                    <button
                      className="fitos-button fitos-button--primary fitos-button--small"
                      onClick={() => handleOpenTrial(svc?.name)}
                      type="button"
                    >
                      Reserve Spot
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
          <p className="public-section__desc">Certified performance coaches dedicated to your progress.</p>
        </div>

        <div className="public-coaches-grid">
          {activeStaff.map((staffItem) => (
            <Card className="public-coach-card" key={staffItem.user.id}>
              <div className="public-coach-avatar">
                {staffItem.user.displayName[0]}
              </div>
              <h3>{staffItem.user.displayName}</h3>
              <span className="public-coach-role">{staffItem.role.name}</span>
              <p className="muted" style={{ fontSize: "0.82rem", marginTop: "0.5rem" }}>
                Specializes in functional movement, metabolic conditioning, and athletic development.
              </p>
            </Card>
          ))}
          {activeStaff.length === 0 && (
            <Card className="public-coach-card">
              <div className="public-coach-avatar">M</div>
              <h3>Coach Marcus</h3>
              <span className="public-coach-role">Head Trainer</span>
              <p className="muted" style={{ fontSize: "0.82rem", marginTop: "0.5rem" }}>
                Specializes in functional movement, metabolic conditioning, and athletic development.
              </p>
            </Card>
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
          {(branches.data?.length ? branches.data : [{ id: "b1", name: "Main Facility", timezone: "Africa/Nairobi" }]).map((branch) => (
            <Card className="public-location-card" key={branch.id}>
              <div className="public-location-card__icon">
                <Icon name="building" size={24} />
              </div>
              <h3>{branch.name}</h3>
              <p>Central Facility, Main Avenue · {branch.timezone ?? "EAT"}</p>
              <div className="public-location-hours">
                <div>
                  <span>Mon – Fri:</span>
                  <strong>05:30 AM – 09:30 PM</strong>
                </div>
                <div>
                  <span>Sat – Sun:</span>
                  <strong>07:00 AM – 07:00 PM</strong>
                </div>
              </div>
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
            <p>© {new Date().getFullYear()} {gymName}. Powered by FITOS OS.</p>
          </div>
          <div className="public-footer__links">
            <Link to="/login">Staff Login</Link>
            <Link to="/login">Member Portal</Link>
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
              <h3>You're All Set!</h3>
              <p>We received your request for <strong>{leadForm.interest || "General Trial"}</strong>. Our team will contact you shortly with your confirmation.</p>
              <Button onClick={() => setTrialModalOpen(false)} variant="primary">
                Close
              </Button>
            </div>
          ) : (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                leadMutation.mutate(leadForm);
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

              <ErrorNotice error={leadMutation.error} />

              <div className="form-actions">
                <Button onClick={() => setTrialModalOpen(false)} variant="ghost">
                  Cancel
                </Button>
                <Button
                  disabled={!leadForm.firstName.trim() || !leadForm.phone.trim()}
                  loading={leadMutation.isPending}
                  type="submit"
                  variant="primary"
                >
                  Confirm Free Pass
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
