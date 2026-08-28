import { useState } from "react";
import { Link } from "react-router-dom";
import { FitosLogo } from "../../app/logo";

export function FitosLandingPage({ showChrome = true }: { showChrome?: boolean }) {
  const [activeSolution, setActiveSolution] = useState<"gym" | "studio" | "lab" | "therapy">("gym");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const solutions = {
    gym: {
      title: "Commercial Health Clubs & Multi-Branch Gyms",
      tagline:
        "Member CRM, attendance, scheduling, and multi-location operations in one workspace.",
      features: [
        "Multi-branch access governance & unified member roving",
        "Membership entitlements, expiry queues, and retention workflows",
        "Real-time turnstile and QR biometric check-in engine",
        "Automated retention workflows for inactive & churn-risk members"
      ],
      metrics: "500–10,000+ members/branch • 99.9% uptime • Multi-branch roving"
    },
    studio: {
      title: "Boutique Fitness, Pilates & Reformer Studios",
      tagline:
        "Resource-constrained capacity, equipment pool allocation, waitlists, and pack credits.",
      features: [
        "Hard equipment-aware booking capacity (Reformer, Megaformer, Bike pools)",
        "Automated waitlist promotion and late-cancellation credit rules",
        "Instructor payout calculations and session utilization heatmaps",
        "Mobile-first member booking portal"
      ],
      metrics: "Zero equipment overbooking • 94% average class occupancy"
    },
    lab: {
      title: "High-Performance Sports Science & Diagnostic Labs",
      tagline: "InBody, VALD ForceDecks, COSMED VO2 Max spirometry, and athlete metric trends.",
      features: [
        "Reviewed file imports with versioned vendor mappings and provenance",
        "Athlete neuromuscular asymmetry & reactive strength index (RSI)",
        "VO2 Max, aerobic threshold (VT1) and anaerobic threshold (VT2) spirometry",
        "Clinical longitudinal progress tracking and athlete export dossiers"
      ],
      metrics: "Sub-millisecond force plate analytics • Standardized metric provenance"
    },
    therapy: {
      title: "Physical Therapy, Rehab & Recovery Facilities",
      tagline:
        "NEUBIE direct current stim, AlterG anti-gravity, Normatec compression protocols, and clinical notes.",
      features: [
        "Modality safety checklists & contraindication screening before sessions",
        "Pre- and post-session numeric pain rating scales (NPRS)",
        "Dosage logging (frequency, intensity, electrode placement parameters)",
        "Consumable BOM tracking (electrodes, conductive gel, therapy bands)"
      ],
      metrics: "Clinical audit trail • Zero adverse-reaction governance"
    }
  };

  const faqs = [
    {
      q: "How does FITOS prevent equipment overbooking in boutique studios?",
      a: "FITOS enforces resource-aware capacity at the database level. If a class has a nominal capacity of 20 but the linked equipment pool (e.g. Reformers) only has 12 available assets at that hour, FITOS strictly limits bookings to 12. If equipment is damaged or in maintenance, the effective capacity automatically adjusts."
    },
    {
      q: "Can I connect my InBody or VALD ForceDecks hardware to FITOS?",
      a: "FITOS supports reviewed CSV and JSON imports with provenance for assessment data. Live InBody, VALD, COSMED, or PNOE APIs are added only when approved vendor access and documentation are available."
    },
    {
      q: "What is the difference between Self-Service Signup and Configure FITOS?",
      a: "Self-Service Signup (/signup) immediately provisions a live tenant with standard templates and starts a 14-day trial. Configure FITOS (/configure) is an adaptive 18-step discovery brief where you describe your multi-branch topology, custom services, equipment pools, and migration data for our team to assemble a customized launch manifest."
    },
    {
      q: "Does FITOS provide a public website builder for our gym?",
      a: "FITOS Sites currently provides controlled tenant pages and publishing. The broader block library, version history, media, SEO, and domain workflows are being completed progressively and are labelled by maturity."
    }
  ];

  return (
    <div className="saas-public-page saas-landing-page">
      {/* ── Top Navigation ── */}
      {showChrome ? (
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            backdropFilter: "blur(16px)",
            backgroundColor: "rgba(9, 13, 22, 0.85)",
            borderBottom: "1px solid rgba(255,255,255,0.08)"
          }}
        >
          <div
            style={{
              maxWidth: "80rem",
              margin: "0 auto",
              padding: "1rem 2rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "2.5rem" }}>
              <Link
                to="/"
                style={{ display: "flex", alignItems: "center", textDecoration: "none" }}
              >
                <FitosLogo height={28} />
              </Link>
              <nav style={{ display: "flex", gap: "1.75rem", fontSize: "0.9rem", fontWeight: 500 }}>
                <a
                  href="#features"
                  style={{ color: "#94a3b8", textDecoration: "none", transition: "color 0.2s" }}
                >
                  Capabilities
                </a>
                <a
                  href="#solutions"
                  style={{ color: "#94a3b8", textDecoration: "none", transition: "color 0.2s" }}
                >
                  Solutions
                </a>
                <a
                  href="#performance"
                  style={{ color: "#94a3b8", textDecoration: "none", transition: "color 0.2s" }}
                >
                  Performance Lab
                </a>
                <a
                  href="#pricing"
                  style={{ color: "#94a3b8", textDecoration: "none", transition: "color 0.2s" }}
                >
                  Pricing
                </a>
                <a
                  href="#faq"
                  style={{ color: "#94a3b8", textDecoration: "none", transition: "color 0.2s" }}
                >
                  FAQ
                </a>
              </nav>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <Link
                to="/login"
                style={{
                  color: "#e2e8f0",
                  textDecoration: "none",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  padding: "0.5rem 1rem"
                }}
              >
                Sign In
              </Link>
              <Link
                to="/configure"
                className="fitos-button fitos-button--secondary"
                style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}
              >
                Configure FITOS
              </Link>
              <Link
                to="/signup"
                className="fitos-button fitos-button--primary"
                style={{
                  fontSize: "0.85rem",
                  padding: "0.5rem 1.25rem",
                  background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
                }}
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </header>
      ) : null}

      {/* ── Hero Section ── */}
      <section
        style={{
          padding: "6rem 2rem 4rem",
          maxWidth: "80rem",
          margin: "0 auto",
          textAlign: "center"
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.35rem 1rem",
            borderRadius: "9999px",
            background: "rgba(59, 130, 246, 0.12)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            color: "#60a5fa",
            fontSize: "0.82rem",
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginBottom: "1.5rem"
          }}
        >
          <span>✨</span> The Fitness Operating System • Version 2026.1
        </div>
        <h1
          style={{
            fontSize: "clamp(2.75rem, 6vw, 4.75rem)",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            maxWidth: "62rem",
            margin: "0 auto 1.5rem"
          }}
        >
          Everything fitness.{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #93c5fd 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent"
            }}
          >
            One unified OS.
          </span>
        </h1>
        <p
          style={{
            fontSize: "1.25rem",
            lineHeight: 1.6,
            color: "#94a3b8",
            maxWidth: "46rem",
            margin: "0 auto 2.5rem"
          }}
        >
          Run multi-branch memberships, resource-aware class scheduling, diagnostic sports science
          biometrics, recovery therapy, inventory consumables, and custom websites on one PostgreSQL
          engine.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "4rem"
          }}
        >
          <Link
            to="/configure"
            className="fitos-button fitos-button--primary"
            style={{
              padding: "0.9rem 2rem",
              fontSize: "1.05rem",
              fontWeight: 600,
              borderRadius: "0.5rem",
              boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.4)"
            }}
          >
            Configure FITOS for my business →
          </Link>
          <Link
            to="/signup"
            className="fitos-button fitos-button--secondary"
            style={{
              padding: "0.9rem 2rem",
              fontSize: "1.05rem",
              fontWeight: 600,
              borderRadius: "0.5rem"
            }}
          >
            Start 14-Day Free Trial
          </Link>
        </div>

        {/* Hero Interactive Dashboard Visual */}
        <div
          style={{
            borderRadius: "1rem",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(15, 23, 42, 0.75)",
            padding: "1.5rem",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            overflow: "hidden",
            textAlign: "left"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              paddingBottom: "1rem",
              marginBottom: "1.5rem"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "#ef4444"
                }}
              />
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "#f59e0b"
                }}
              />
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "#10b981"
                }}
              />
              <span style={{ fontSize: "0.85rem", color: "#64748b", marginLeft: "0.5rem" }}>
                FITOS Operations Hub • Unified workspace
              </span>
            </div>
            <div
              style={{
                display: "flex",
                gap: "1rem",
                fontSize: "0.8rem",
                color: "#10b981",
                fontWeight: 600
              }}
            >
              <span>● Secure by design</span>
              <span>Branch-aware workflows</span>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              marginBottom: "1.5rem"
            }}
          >
            {[
              {
                label: "Member operations",
                value: "Connected",
                change: "Profiles, memberships and attendance",
                color: "#60a5fa"
              },
              {
                label: "Scheduling",
                value: "Controlled",
                change: "Capacity and resource rules",
                color: "#34d399"
              },
              {
                label: "Performance",
                value: "Structured",
                change: "Assessments and practitioner records",
                color: "#a78bfa"
              },
              {
                label: "Workspaces",
                value: "Purpose-built",
                change: "Command, Ops, Coach and Front Desk",
                color: "#f472b6"
              }
            ].map((card, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(30, 41, 59, 0.6)",
                  padding: "1.25rem",
                  borderRadius: "0.75rem",
                  border: "1px solid rgba(255,255,255,0.06)"
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                  {card.label}
                </div>
                <div
                  style={{
                    fontSize: "1.75rem",
                    fontWeight: 700,
                    color: card.color,
                    marginBottom: "0.25rem"
                  }}
                >
                  {card.value}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{card.change}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6 Core Pillars ── */}
      <section id="features" style={{ padding: "5rem 2rem", maxWidth: "80rem", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <p
            style={{
              color: "#60a5fa",
              fontWeight: 600,
              fontSize: "0.85rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase"
            }}
          >
            Core Architecture
          </p>
          <h2 style={{ fontSize: "2.5rem", fontWeight: 700 }}>6 Engines. One Native Schema.</h2>
          <p style={{ color: "#94a3b8", maxWidth: "38rem", margin: "0.75rem auto 0" }}>
            No brittle plugins, no sync delays. Every domain event coordinates across inventory,
            bookings, and athlete profiles.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "1.5rem"
          }}
        >
          {[
            {
              icon: "👥",
              title: "Member & Access CRM",
              desc: "Multi-branch member pass, QR biometrics, credit ledgers, automated churn intervention, and lead pipelines with SLA follow-up triggers."
            },
            {
              icon: "📅",
              title: "Resource-Aware Timetable",
              desc: "Hard equipment pool capacity bounds. If you have 12 Reformers, max bookings is 12 — preventing studio overbooking before it occurs."
            },
            {
              icon: "🔬",
              title: "Performance Diagnostic Lab",
              desc: "Native ingestion for InBody, VALD ForceDecks, and COSMED K5. Normalized metric definitions with provenance and versioned schema."
            },
            {
              icon: "⚡",
              title: "Therapy & Recovery Suite",
              desc: "Protocol governance for NEUBIE direct current, AlterG anti-gravity, and Normatec compression with pain scale scores and dosage records."
            },
            {
              icon: "📦",
              title: "Inventory Lots & Stocktakes",
              desc: "Lot expiry tracking, purchase orders, variance stocktakes with adjustment movements, and automatic session consumable BOM deduction."
            },
            {
              icon: "🌐",
              title: "FITOS Sites & Member Portal",
              desc: "Built-in modular block CMS for fast public gym websites, plus a member self-service portal for class bookings and biometric histories."
            }
          ].map((feat, i) => (
            <div
              key={i}
              style={{
                padding: "2rem",
                borderRadius: "1rem",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(255,255,255,0.08)",
                transition: "transform 0.2s, border-color 0.2s"
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>{feat.icon}</div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>
                {feat.title}
              </h3>
              <p style={{ color: "#94a3b8", fontSize: "0.95rem", lineHeight: 1.6 }}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Solutions by Business Model ── */}
      <section
        id="solutions"
        style={{
          padding: "5rem 2rem",
          background: "rgba(15, 23, 42, 0.4)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.06)"
        }}
      >
        <div style={{ maxWidth: "80rem", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <p
              style={{
                color: "#60a5fa",
                fontWeight: 600,
                fontSize: "0.85rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase"
              }}
            >
              Tailored Operations
            </p>
            <h2 style={{ fontSize: "2.5rem", fontWeight: 700 }}>Engineered for How You Operate</h2>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
              marginBottom: "2.5rem"
            }}
          >
            {[
              { key: "gym", label: "Commercial Gyms" },
              { key: "studio", label: "Boutique & Reformer Studios" },
              { key: "lab", label: "Sports Performance Labs" },
              { key: "therapy", label: "Physical Therapy & Rehab" }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSolution(tab.key as "gym" | "studio" | "lab" | "therapy")}
                style={{
                  padding: "0.75rem 1.5rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border:
                    activeSolution === tab.key
                      ? "1px solid #3b82f6"
                      : "1px solid rgba(255,255,255,0.1)",
                  background:
                    activeSolution === tab.key
                      ? "rgba(59, 130, 246, 0.2)"
                      : "rgba(30, 41, 59, 0.5)",
                  color: activeSolution === tab.key ? "#60a5fa" : "#94a3b8"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "1rem",
              padding: "2.5rem",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "3rem",
              alignItems: "center"
            }}
          >
            <div>
              <h3 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.75rem" }}>
                {solutions[activeSolution].title}
              </h3>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "1.05rem",
                  lineHeight: 1.6,
                  marginBottom: "1.5rem"
                }}
              >
                {solutions[activeSolution].tagline}
              </p>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0 0 2rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem"
                }}
              >
                {solutions[activeSolution].features.map((f, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      color: "#e2e8f0",
                      fontSize: "0.95rem"
                    }}
                  >
                    <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link to="/configure" className="fitos-button fitos-button--primary">
                Configure for this model →
              </Link>
            </div>
            <div
              style={{
                background: "rgba(30, 41, 59, 0.6)",
                borderRadius: "0.75rem",
                padding: "2rem",
                border: "1px solid rgba(255,255,255,0.06)"
              }}
            >
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.5rem"
                }}
              >
                Operational Metric Highlight
              </div>
              <div
                style={{ fontSize: "1.1rem", fontWeight: 600, color: "#34d399", lineHeight: 1.5 }}
              >
                {solutions[activeSolution].metrics}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing Section ── */}
      <section id="pricing" style={{ padding: "5rem 2rem", maxWidth: "80rem", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <p
            style={{
              color: "#60a5fa",
              fontWeight: 600,
              fontSize: "0.85rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase"
            }}
          >
            Capability-based plans
          </p>
          <h2 style={{ fontSize: "2.5rem", fontWeight: 700 }}>
            Built for Operators, Scaled for Growth
          </h2>
          <p style={{ color: "#94a3b8", marginTop: "1rem" }}>
            Compare operational scope and usage limits. Payment collection is not part of this
            release.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "2rem"
          }}
        >
          {[
            {
              plan: "Starter",
              scope: "Core operations",
              desc: "For single-location studios and boutique gyms launching self-service operations.",
              features: [
                "Usage limits shown in plan comparison",
                "Member and staff quota visibility",
                "Class booking & waitlists",
                "Membership entitlement tracking",
                "Mobile-first Member Portal",
                "Capability availability shown after workspace setup"
              ]
            },
            {
              plan: "Pro",
              scope: "Advanced operations",
              popular: true,
              desc: "For growing gyms, reformer studios, and recovery centers requiring full hardware and therapy.",
              features: [
                "Higher member and branch quotas",
                "Usage pressure visibility",
                "Capability review for advanced workflows",
                "Higher operational limits",
                "Assisted implementation guidance"
              ]
            },
            {
              plan: "Business",
              scope: "Multi-location scale",
              desc: "For multi-chain enterprise operators, franchise brands, and high-performance institutes.",
              features: [
                "Higher branch and member limits",
                "Multi-branch operating workspaces",
                "Cross-branch access and reporting",
                "Capability review for multi-location workflows",
                "Assisted implementation guidance",
                "Plan changes handled without checkout"
              ]
            }
          ].map((tier, i) => (
            <div
              key={i}
              style={{
                padding: "2.5rem",
                borderRadius: "1rem",
                background: tier.popular ? "rgba(30, 41, 59, 0.9)" : "rgba(15, 23, 42, 0.6)",
                border: tier.popular ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.08)",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}
            >
              {tier.popular && (
                <div
                  style={{
                    position: "absolute",
                    top: "-12px",
                    right: "20px",
                    background: "#3b82f6",
                    color: "#fff",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "0.2rem 0.75rem",
                    borderRadius: "9999px"
                  }}
                >
                  MOST POPULAR
                </div>
              )}
              <div>
                <h3 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                  {tier.plan}
                </h3>
                <p
                  style={{
                    color: "#94a3b8",
                    fontSize: "0.9rem",
                    minHeight: "2.8rem",
                    marginBottom: "1.5rem"
                  }}
                >
                  {tier.desc}
                </p>
                <div style={{ fontSize: "2.75rem", fontWeight: 800, marginBottom: "1.5rem" }}>
                  {tier.scope}
                </div>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "0 0 2rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem"
                  }}
                >
                  {tier.features.map((f, j) => (
                    <li
                      key={j}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.6rem",
                        fontSize: "0.9rem",
                        color: "#cbd5e1"
                      }}
                    >
                      <span style={{ color: "#3b82f6" }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                to="/signup"
                className={`fitos-button ${tier.popular ? "fitos-button--primary" : "fitos-button--secondary"}`}
                style={{ width: "100%", textAlign: "center" }}
              >
                Start FITOS trial
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ Section ── */}
      <section id="faq" style={{ padding: "5rem 2rem", maxWidth: "56rem", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <h2 style={{ fontSize: "2.25rem", fontWeight: 700 }}>Frequently Asked Questions</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {faqs.map((faq, i) => (
            <div
              key={i}
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "0.75rem",
                background: "rgba(15, 23, 42, 0.6)",
                overflow: "hidden"
              }}
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                style={{
                  width: "100%",
                  padding: "1.25rem 1.5rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "none",
                  border: "none",
                  color: "#f8fafc",
                  fontSize: "1.05rem",
                  fontWeight: 600,
                  textAlign: "left",
                  cursor: "pointer"
                }}
              >
                <span>{faq.q}</span>
                <span
                  style={{
                    fontSize: "1.25rem",
                    transform: expandedFaq === i ? "rotate(45deg)" : "rotate(0)",
                    transition: "transform 0.2s"
                  }}
                >
                  +
                </span>
              </button>
              {expandedFaq === i && (
                <div
                  style={{
                    padding: "0 1.5rem 1.5rem",
                    color: "#94a3b8",
                    fontSize: "0.95rem",
                    lineHeight: 1.6
                  }}
                >
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Implementation Brief Banner ── */}
      <section style={{ padding: "4rem 2rem", maxWidth: "80rem", margin: "0 auto 4rem" }}>
        <div
          style={{
            borderRadius: "1.25rem",
            background:
              "linear-gradient(135deg, rgba(30, 58, 138, 0.6) 0%, rgba(15, 23, 42, 0.9) 100%)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            padding: "3.5rem 2.5rem",
            textAlign: "center"
          }}
        >
          <h2 style={{ fontSize: "2.25rem", fontWeight: 700, marginBottom: "1rem" }}>
            Need a Custom Multi-Location Deployment?
          </h2>
          <p
            style={{
              color: "#cbd5e1",
              maxWidth: "40rem",
              margin: "0 auto 2rem",
              fontSize: "1.1rem",
              lineHeight: 1.6
            }}
          >
            Submit an 18-step configuration brief. Our engineers generate a complete seed manifest
            with your timetable, team rosters, and equipment allocations.
          </p>
          <Link
            to="/configure"
            className="fitos-button fitos-button--primary"
            style={{ padding: "0.85rem 2rem", fontSize: "1rem", fontWeight: 600 }}
          >
            Open Configuration Discovery Wizard →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      {showChrome ? (
        <footer
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            padding: "3rem 2rem",
            color: "#64748b",
            fontSize: "0.85rem"
          }}
        >
          <div
            style={{
              maxWidth: "80rem",
              margin: "0 auto",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
              <FitosLogo height={22} />
              <span>© 2026 FITOS Operating System. All rights reserved.</span>
            </div>
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <Link to="/login" style={{ color: "#94a3b8", textDecoration: "none" }}>
                Staff Sign In
              </Link>
              <Link to="/configure" style={{ color: "#94a3b8", textDecoration: "none" }}>
                Configure FITOS
              </Link>
              <Link to="/signup" style={{ color: "#94a3b8", textDecoration: "none" }}>
                SaaS Trial
              </Link>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
