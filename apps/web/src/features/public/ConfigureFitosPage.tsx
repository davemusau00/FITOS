import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api/client";
import { FitosLogo } from "../../app/logo";

interface WizardPayload {
  // Step 1: Business Basics
  gymName: string;
  businessType: string;
  country: string;
  currency: string;
  timezone: string;
  // Step 2: Contact
  contactName: string;
  email: string;
  phone: string;
  roleTitle: string;
  // Step 3: Branches
  branchCount: number;
  branchNames: string;
  primaryAddress: string;
  // Step 4: Services
  serviceTypes: string[];
  classTypes: string;
  // Step 5: Timetable
  peakHours: string;
  weeklyClassVolume: string;
  defaultClassCapacity: number;
  // Step 6: Memberships
  membershipTiers: string;
  pricingBands: string;
  // Step 7: Team
  trainerCount: number;
  staffCount: number;
  // Step 8: Equipment
  equipmentPools: string;
  hasReformers: boolean;
  // Step 9: Assessments
  hasAssessments: boolean;
  assessmentVendors: string[];
  // Step 10: Therapy
  hasTherapy: boolean;
  therapyModalities: string[];
  // Step 11: Inventory
  hasInventory: boolean;
  inventoryCategories: string;
  // Step 12: CRM
  leadSources: string;
  marketingChannels: string[];
  // Step 13: Sites
  needsWebsite: boolean;
  customDomain: string;
  brandColors: string;
  // Step 14: Integrations
  hardwareIntegrations: string;
  // Step 15: Migration
  migratingFrom: string;
  approximateMembers: number;
  // Step 16: Launch Priorities
  targetGoLiveDate: string;
  topPriorities: string;
  // Step 17: Governance
  cancellationCutoffHours: number;
  waitlistAutoPromote: boolean;
  // Step 18: Final Notes
  specialRequirements: string;
}

const initialPayload: WizardPayload = {
  gymName: "",
  businessType: "Commercial Gym",
  country: "Kenya",
  currency: "KES",
  timezone: "Africa/Nairobi",
  contactName: "",
  email: "",
  phone: "",
  roleTitle: "Owner / Director",
  branchCount: 1,
  branchNames: "Main Branch",
  primaryAddress: "",
  serviceTypes: ["Classes", "Personal Training"],
  classTypes: "HIIT, Strength, Yoga, Reformer Pilates",
  peakHours: "06:00 - 09:00, 17:00 - 20:00",
  weeklyClassVolume: "25-50 classes/week",
  defaultClassCapacity: 16,
  membershipTiers: "Monthly Unlimited, 10-Class Pack, Day Pass",
  pricingBands: "KES 6,000 - 15,000 / month",
  trainerCount: 6,
  staffCount: 10,
  equipmentPools: "12 Reformers, 4 Power Racks, Dumbbell Sets",
  hasReformers: true,
  hasAssessments: true,
  assessmentVendors: ["InBody 970", "VALD ForceDecks"],
  hasTherapy: false,
  therapyModalities: ["NEUBIE Stim", "Normatec Compression"],
  hasInventory: true,
  inventoryCategories: "Supplements, Water, Branded Apparel",
  leadSources: "Instagram, Walk-ins, Website, Referrals",
  marketingChannels: ["WhatsApp", "Email", "SMS"],
  needsWebsite: true,
  customDomain: "mygym.fit",
  brandColors: "Midnight Blue & Amber",
  hardwareIntegrations: "M-Pesa Daraja, QR Turnstiles",
  migratingFrom: "Mindbody / Spreadsheets",
  approximateMembers: 450,
  targetGoLiveDate: "Within 30 days",
  topPriorities: "Stop reformer overbooking, automate recurring billing, member app",
  cancellationCutoffHours: 2,
  waitlistAutoPromote: true,
  specialRequirements: ""
};

const STEPS = [
  { id: 1, title: "Business Basics", desc: "Your facility type and location" },
  { id: 2, title: "Contact Details", desc: "Primary operator identity" },
  { id: 3, title: "Branches & Topology", desc: "Locations and roving" },
  { id: 4, title: "Services Catalog", desc: "Class and appointment types" },
  { id: 5, title: "Timetable & Capacity", desc: "Scheduling rules and bounds" },
  { id: 6, title: "Memberships & Pricing", desc: "Recurring plans and credit packs" },
  { id: 7, title: "Team & Staffing", desc: "Instructors and operators" },
  { id: 8, title: "Equipment Pools", desc: "Resource allocation bounds" },
  { id: 9, title: "Assessments & Lab", desc: "InBody, VALD & spirometry" },
  { id: 10, title: "Therapy & Recovery", desc: "Clinical modalities & protocols" },
  { id: 11, title: "Inventory & BOM", desc: "Stock, lots and consumables" },
  { id: 12, title: "CRM & Growth", desc: "Lead pipelines and triggers" },
  { id: 13, title: "FITOS Sites & CMS", desc: "Public website and branding" },
  { id: 14, title: "Hardware Integrations", desc: "Turnstiles and diagnostics" },
  { id: 15, title: "Data Migration", desc: "Existing members and history" },
  { id: 16, title: "Launch Milestones", desc: "Target go-live priorities" },
  { id: 17, title: "Governance & Policies", desc: "Late-cancel and waitlists" },
  { id: 18, title: "Review & Submit", desc: "Generate configuration manifest" }
];

export function ConfigureFitosPage() {
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [draftId, setDraftId] = useState<string | undefined>(() => localStorage.getItem("fitos_draft_id") || undefined);
  const [resumeToken, setResumeToken] = useState<string | undefined>(() => searchParams.get("token") || localStorage.getItem("fitos_resume_token") || undefined);
  const [form, setForm] = useState<WizardPayload>(initialPayload);
  const [submitted, setSubmitted] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailSuccessMessage, setEmailSuccessMessage] = useState<string | null>(null);

  // Resume Draft query if token in URL or storage
  const resumeQuery = useQuery({
    queryKey: ["resumeInquiry", draftId, resumeToken],
    queryFn: () => draftId && resumeToken ? api.resumeImplementationInquiry(draftId, resumeToken) : null,
    enabled: Boolean(draftId && resumeToken),
    staleTime: 60_000
  });

  useEffect(() => {
    if (resumeQuery.data?.payload) {
      setForm((prev) => ({ ...prev, ...(resumeQuery.data.payload as Partial<WizardPayload>) }));
      if (resumeQuery.data.contactName) setForm((prev) => ({ ...prev, contactName: resumeQuery.data.contactName! }));
      if (resumeQuery.data.businessName) setForm((prev) => ({ ...prev, gymName: resumeQuery.data.businessName! }));
      if (resumeQuery.data.email) setForm((prev) => ({ ...prev, email: resumeQuery.data.email! }));
    }
  }, [resumeQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (submit: boolean) =>
      (submit ? api.submitImplementationInquiry : api.saveImplementationInquiryDraft)({
        id: draftId,
        contactName: form.contactName,
        businessName: form.gymName,
        email: form.email,
        phone: form.phone,
        country: form.country,
        businessType: form.businessType,
        payload: form as unknown as Record<string, unknown>
      }),
    onSuccess: (result) => {
      setDraftId(result.id);
      localStorage.setItem("fitos_draft_id", result.id);
      if (result.resumeToken) {
        setResumeToken(result.resumeToken);
        localStorage.setItem("fitos_resume_token", result.resumeToken);
      }
      setAutosaveStatus("saved");
      if (result.status === "submitted") setSubmitted(true);
    }
  });

  const emailLinkMutation = useMutation({
    mutationFn: () => draftId ? api.emailInquiryResumeLink(draftId, emailInput || form.email) : Promise.reject(new Error("No draft")),
    onSuccess: (res) => {
      setEmailSuccessMessage(res.message);
      setTimeout(() => {
        setEmailModalOpen(false);
        setEmailSuccessMessage(null);
      }, 2500);
    }
  });

  const handleFieldChange = (key: keyof WizardPayload, val: any) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleBlurAutosave = useCallback(() => {
    if (!form.gymName && !form.contactName) return;
    setAutosaveStatus("saving");
    saveMutation.mutate(false);
  }, [form, saveMutation]);

  const handleNext = () => {
    handleBlurAutosave();
    if (currentStep < 18) setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  if (submitted) {
    return (
      <main style={{ minHeight: "100vh", backgroundColor: "#090d16", color: "#f8fafc", padding: "5rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: "42rem", background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(59, 130, 246, 0.4)", borderRadius: "1.25rem", padding: "3.5rem 2.5rem", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.8)" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🚀</div>
          <h1 style={{ fontSize: "2.25rem", fontWeight: 800, marginBottom: "1rem" }}>FITOS Configuration Brief Received</h1>
          <p style={{ color: "#94a3b8", fontSize: "1.1rem", lineHeight: 1.6, marginBottom: "2rem" }}>
            Thank you, <strong style={{ color: "#fff" }}>{form.contactName || "Operator"}</strong>. Our implementation engineering team is now compiling your customized tenant launch manifest for <strong style={{ color: "#60a5fa" }}>{form.gymName}</strong>.
          </p>
          <div style={{ background: "rgba(30, 41, 59, 0.6)", padding: "1.25rem", borderRadius: "0.75rem", textAlign: "left", marginBottom: "2rem", fontSize: "0.9rem", color: "#cbd5e1" }}>
            <div><strong>Inquiry ID:</strong> {draftId}</div>
            <div><strong>Locations:</strong> {form.branchCount} ({form.branchNames})</div>
            <div><strong>Services:</strong> {form.serviceTypes.join(", ")}</div>
            <div><strong>Equipment Pools:</strong> {form.equipmentPools}</div>
          </div>
          <Link to="/" className="fitos-button fitos-button--primary" style={{ padding: "0.85rem 2rem", fontWeight: 600 }}>
            Return to FITOS Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#090d16", color: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* ── Top Bar ── */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(15, 23, 42, 0.85)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: "76rem", margin: "0 auto", padding: "1rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <Link to="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
              <FitosLogo height={24} />
            </Link>
            <span style={{ color: "#64748b" }}>|</span>
            <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#94a3b8" }}>Configuration Discovery Wizard</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.85rem" }}>
            <span style={{ color: autosaveStatus === "saving" ? "#f59e0b" : autosaveStatus === "saved" ? "#10b981" : "#64748b" }}>
              {autosaveStatus === "saving" ? "● Autosaving draft…" : autosaveStatus === "saved" ? "✓ Draft saved" : "Autosave enabled on blur"}
            </span>
            <button
              onClick={() => { setEmailInput(form.email); setEmailModalOpen(true); }}
              style={{ background: "rgba(59, 130, 246, 0.15)", border: "1px solid rgba(59, 130, 246, 0.3)", color: "#60a5fa", padding: "0.4rem 0.8rem", borderRadius: "0.4rem", cursor: "pointer", fontWeight: 600 }}
            >
              Email Me Resume Link
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ width: "100%", height: "4px", background: "rgba(255,255,255,0.06)" }}>
          <div style={{ width: `${(currentStep / 18) * 100}%`, height: "100%", background: "linear-gradient(90deg, #3b82f6, #60a5fa)", transition: "width 0.3s ease" }} />
        </div>
      </header>

      {/* ── Main Container ── */}
      <main style={{ maxWidth: "60rem", margin: "0 auto", padding: "3rem 1.5rem 6rem" }}>
        <div style={{ marginBottom: "2.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
            <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Step {currentStep} of 18
            </span>
            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
              {Math.round((currentStep / 18) * 100)}% Complete
            </span>
          </div>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: "0 0 0.5rem" }}>{STEPS[currentStep - 1].title}</h1>
          <p style={{ color: "#94a3b8", fontSize: "1rem", margin: 0 }}>{STEPS[currentStep - 1].desc}</p>
        </div>

        {/* Form Body with 18 steps */}
        <form onSubmit={(e) => { e.preventDefault(); if (currentStep === 18) saveMutation.mutate(true); else handleNext(); }} style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "1rem", padding: "2.5rem", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
          {currentStep === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <label>Business / Gym Name
                <input required autoFocus value={form.gymName} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("gymName", e.target.value)} placeholder="e.g. Apex Performance Club" />
              </label>
              <label>Facility Model
                <select value={form.businessType} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("businessType", e.target.value)}>
                  <option value="Commercial Gym">Commercial Gym & Health Club</option>
                  <option value="Reformer Studio">Boutique & Reformer Pilates Studio</option>
                  <option value="Performance Lab">Sports Science & Performance Lab</option>
                  <option value="Physical Therapy">Physical Therapy & Recovery Clinic</option>
                  <option value="CrossFit / Functional">CrossFit & Functional Box</option>
                </select>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                <label>Country
                  <input value={form.country} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("country", e.target.value)} />
                </label>
                <label>Currency
                  <input value={form.currency} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("currency", e.target.value)} />
                </label>
                <label>Timezone
                  <input value={form.timezone} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("timezone", e.target.value)} />
                </label>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <label>Primary Contact Name
                <input required autoFocus value={form.contactName} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("contactName", e.target.value)} placeholder="Full Name" />
              </label>
              <label>Work Email Address
                <input required type="email" value={form.email} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("email", e.target.value)} placeholder="name@facility.com" />
              </label>
              <label>Phone / WhatsApp Number
                <input value={form.phone} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("phone", e.target.value)} placeholder="+254 700 000 000" />
              </label>
              <label>Your Role in the Organization
                <input value={form.roleTitle} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("roleTitle", e.target.value)} />
              </label>
            </div>
          )}

          {currentStep === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <label>Number of Branch Locations
                <input type="number" min={1} max={50} value={form.branchCount} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("branchCount", parseInt(e.target.value, 10))} />
              </label>
              <label>Branch Names
                <input value={form.branchNames} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("branchNames", e.target.value)} placeholder="e.g. Westlands Main, Karen Hub" />
              </label>
              <label>Primary Location Address
                <input value={form.primaryAddress} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("primaryAddress", e.target.value)} placeholder="Street, Building, City" />
              </label>
            </div>
          )}

          {currentStep === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <label>Class & Service Descriptions
                <textarea rows={3} value={form.classTypes} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("classTypes", e.target.value)} placeholder="List group classes, 1:1 sessions, drop-in passes" />
              </label>
            </div>
          )}

          {currentStep === 5 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <label>Peak Timetable Hours
                <input value={form.peakHours} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("peakHours", e.target.value)} />
              </label>
              <label>Weekly Class Volume
                <input value={form.weeklyClassVolume} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("weeklyClassVolume", e.target.value)} />
              </label>
              <label>Default Studio Room Capacity
                <input type="number" value={form.defaultClassCapacity} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("defaultClassCapacity", parseInt(e.target.value, 10))} />
              </label>
            </div>
          )}

          {currentStep === 6 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <label>Membership Plan Types
                <input value={form.membershipTiers} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("membershipTiers", e.target.value)} />
              </label>
              <label>Price Range / Bands
                <input value={form.pricingBands} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("pricingBands", e.target.value)} />
              </label>
            </div>
          )}

          {currentStep === 7 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <label>Approximate Number of Coaches / Trainers
                <input type="number" value={form.trainerCount} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("trainerCount", parseInt(e.target.value, 10))} />
              </label>
              <label>Total Staff (Operations, Reception, Management)
                <input type="number" value={form.staffCount} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("staffCount", parseInt(e.target.value, 10))} />
              </label>
            </div>
          )}

          {currentStep === 8 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <label>Equipment Pools & Assets (for resource-aware capacity)
                <textarea rows={3} value={form.equipmentPools} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("equipmentPools", e.target.value)} placeholder="e.g. 12 Reformers, 6 Assault Bikes, 8 Squat Racks" />
              </label>
            </div>
          )}

          {currentStep === 9 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input type="checkbox" checked={form.hasAssessments} onChange={(e) => handleFieldChange("hasAssessments", e.target.checked)} />
                Facility operates diagnostic performance assessments (InBody, VALD, VO2, etc.)
              </label>
              {form.hasAssessments && (
                <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "1rem", borderRadius: "0.5rem" }}>
                  <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", color: "#cbd5e1" }}>Configured hardware adapters: LookinBody InBody 970/770, VALD ForceDecks, COSMED K5, PNOE</p>
                </div>
              )}
            </div>
          )}

          {currentStep === 10 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input type="checkbox" checked={form.hasTherapy} onChange={(e) => handleFieldChange("hasTherapy", e.target.checked)} />
                Facility offers therapy, rehab, or recovery protocols
              </label>
              {form.hasTherapy && (
                <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "1rem", borderRadius: "0.5rem" }}>
                  <p style={{ margin: 0, fontSize: "0.9rem", color: "#cbd5e1" }}>Supported protocols: NEUBIE Direct Current Stim, AlterG Anti-Gravity Treadmill, Normatec Compression</p>
                </div>
              )}
            </div>
          )}

          {currentStep === 11 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <label>Inventory Categories & Retail Products
                <input value={form.inventoryCategories} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("inventoryCategories", e.target.value)} />
              </label>
            </div>
          )}

          {currentStep === 12 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <label>Lead Sources & Acquisition Channels
                <input value={form.leadSources} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("leadSources", e.target.value)} />
              </label>
            </div>
          )}

          {currentStep === 13 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <label>Desired Custom Domain
                <input value={form.customDomain} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("customDomain", e.target.value)} placeholder="gymname.com" />
              </label>
              <label>Brand Theme & Colors
                <input value={form.brandColors} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("brandColors", e.target.value)} />
              </label>
            </div>
          )}

          {currentStep === 14 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <label>Hardware & Payment Gateways
                <input value={form.hardwareIntegrations} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("hardwareIntegrations", e.target.value)} />
              </label>
            </div>
          )}

          {currentStep === 15 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <label>Currently Migrating From
                <input value={form.migratingFrom} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("migratingFrom", e.target.value)} />
              </label>
              <label>Approximate Active Member Database Count
                <input type="number" value={form.approximateMembers} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("approximateMembers", parseInt(e.target.value, 10))} />
              </label>
            </div>
          )}

          {currentStep === 16 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <label>Target Go-Live Timeline
                <input value={form.targetGoLiveDate} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("targetGoLiveDate", e.target.value)} />
              </label>
              <label>Top 3 Operational Priorities
                <textarea rows={3} value={form.topPriorities} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("topPriorities", e.target.value)} />
              </label>
            </div>
          )}

          {currentStep === 17 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <label>Late-Cancellation Cutoff Window (Hours)
                <input type="number" value={form.cancellationCutoffHours} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("cancellationCutoffHours", parseInt(e.target.value, 10))} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input type="checkbox" checked={form.waitlistAutoPromote} onChange={(e) => handleFieldChange("waitlistAutoPromote", e.target.checked)} />
                Automatically promote waitlisted members when a spot opens
              </label>
            </div>
          )}

          {currentStep === 18 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ background: "rgba(30, 41, 59, 0.6)", padding: "1.5rem", borderRadius: "0.75rem", border: "1px solid rgba(255,255,255,0.08)" }}>
                <h3 style={{ margin: "0 0 1rem", fontSize: "1.1rem", color: "#60a5fa" }}>Configuration Brief Summary</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.9rem", color: "#cbd5e1" }}>
                  <div><strong>Facility:</strong> {form.gymName} ({form.businessType})</div>
                  <div><strong>Contact:</strong> {form.contactName} ({form.email})</div>
                  <div><strong>Locations:</strong> {form.branchCount} branches</div>
                  <div><strong>Timetable:</strong> {form.weeklyClassVolume}</div>
                  <div><strong>Equipment:</strong> {form.equipmentPools}</div>
                  <div><strong>Diagnostics:</strong> {form.hasAssessments ? "Enabled (InBody/VALD)" : "Disabled"}</div>
                </div>
              </div>
              <label>Any Additional Special Requirements or Custom Workflows?
                <textarea rows={3} value={form.specialRequirements} onBlur={handleBlurAutosave} onChange={(e) => handleFieldChange("specialRequirements", e.target.value)} placeholder="Describe any unique studio or clinic rules..." />
              </label>
            </div>
          )}

          {/* Navigation Controls */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2.5rem", paddingTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <button type="button" onClick={handlePrev} disabled={currentStep === 1} style={{ padding: "0.65rem 1.25rem", borderRadius: "0.4rem", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", cursor: currentStep === 1 ? "not-allowed" : "pointer", opacity: currentStep === 1 ? 0.4 : 1 }}>
              ← Previous Step
            </button>

            {currentStep < 18 ? (
              <button type="button" onClick={handleNext} className="fitos-button fitos-button--primary" style={{ padding: "0.75rem 1.75rem", fontWeight: 600 }}>
                Next Step →
              </button>
            ) : (
              <button type="submit" disabled={saveMutation.isPending} className="fitos-button fitos-button--primary" style={{ padding: "0.85rem 2.25rem", fontWeight: 700, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}>
                {saveMutation.isPending ? "Submitting Brief…" : "Submit Final Configuration Brief 🚀"}
              </button>
            )}
          </div>
        </form>
      </main>

      {/* Email Resume Link Modal */}
      {emailModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: "1rem", padding: "2rem", maxWidth: "28rem", width: "100%" }}>
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem" }}>Save & Email Resume Link</h3>
            <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.5, marginBottom: "1.25rem" }}>
              We'll send you a secure link containing your unique challenge token so you can resume this 18-step brief at any time.
            </p>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="operator@gym.com"
              style={{ width: "100%", marginBottom: "1rem" }}
            />
            {emailSuccessMessage && <div style={{ color: "#10b981", fontSize: "0.9rem", marginBottom: "1rem" }}>✓ {emailSuccessMessage}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button type="button" onClick={() => setEmailModalOpen(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}>Cancel</button>
              <button type="button" onClick={() => emailLinkMutation.mutate()} disabled={emailLinkMutation.isPending} className="fitos-button fitos-button--primary">
                {emailLinkMutation.isPending ? "Sending…" : "Send Resume Link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
