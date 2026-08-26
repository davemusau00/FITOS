import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api/client";
import { FitosLogo } from "../../app/logo";

const STEPS = ["Gym Details", "Location", "Owner Account", "Review"];

const TIMEZONES = [
  "Africa/Nairobi", "Africa/Lagos", "Africa/Johannesburg", "Africa/Cairo",
  "Africa/Accra", "Europe/London", "Europe/Paris", "America/New_York", "Asia/Dubai"
];

const CURRENCIES = [
  { code: "KES", label: "KES – Kenyan Shilling" },
  { code: "NGN", label: "NGN – Nigerian Naira" },
  { code: "ZAR", label: "ZAR – South African Rand" },
  { code: "GHS", label: "GHS – Ghanaian Cedi" },
  { code: "USD", label: "USD – US Dollar" },
  { code: "EUR", label: "EUR – Euro" },
  { code: "GBP", label: "GBP – British Pound" }
];

const BUSINESS_TYPES = [
  "gym", "pilates_studio", "yoga_studio", "sports_club", "wellness_center",
  "physiotherapy_clinic", "crossfit_box", "martial_arts", "dance_studio", "spa"
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function TenantSignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    gymName: "",
    slug: "",
    businessType: "gym",
    country: "Kenya",
    timezone: "Africa/Nairobi",
    currency: "KES",
    branchName: "Main Branch",
    branchAddress: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    password: "",
    confirmPassword: ""
  });

  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "gymName" && !f.slug) next.slug = slugify(v);
      return next;
    });
  };

  const canGoNext = () => {
    if (step === 0) return form.gymName.length >= 2 && form.slug.length >= 2;
    if (step === 1) return form.country.length >= 1;
    if (step === 2) return form.ownerName.length >= 2 && form.ownerEmail.includes("@") && form.password.length >= 8 && form.password === form.confirmPassword;
    return true;
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.signupTenant({
        gymName: form.gymName,
        slug: form.slug,
        businessType: form.businessType,
        country: form.country,
        timezone: form.timezone,
        currency: form.currency,
        branchName: form.branchName,
        branchAddress: form.branchAddress || undefined,
        ownerName: form.ownerName,
        ownerEmail: form.ownerEmail,
        ownerPhone: form.ownerPhone || undefined,
        password: form.password
      });
      // Success – redirect to login with fresh tenant info
      navigate(`/login?tenant=${res.tenantSlug}&welcome=1`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Signup failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-bg" />
      <div className="signup-card">
        <div className="signup-brand">
          <FitosLogo height={28} />
        </div>
        <h1 className="signup-title">Start your free 14-day trial</h1>
        <p className="signup-subtitle">No credit card required. Full access to all features.</p>

        <div className="signup-steps">
          {STEPS.map((label, i) => (
            <div key={label} className={`signup-step ${i === step ? "active" : i < step ? "done" : ""}`}>
              <div className="signup-step-dot">{i < step ? "✓" : i + 1}</div>
              <span className="signup-step-label">{label}</span>
            </div>
          ))}
        </div>

        <div className="signup-form">
          {step === 0 && (
            <>
              <div className="form-group">
                <label htmlFor="gymName">Gym / Business Name</label>
                <input
                  id="gymName"
                  type="text"
                  placeholder="e.g. Iron Peak Performance"
                  value={form.gymName}
                  onChange={(e) => set("gymName", e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="slug">
                  URL Slug
                  <span className="form-hint">fitos.app/<strong>{form.slug || "your-gym"}</strong></span>
                </label>
                <input
                  id="slug"
                  type="text"
                  placeholder="iron-peak-performance"
                  value={form.slug}
                  onChange={(e) => set("slug", slugify(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="businessType">Business Type</label>
                <select id="businessType" value={form.businessType} onChange={(e) => set("businessType", e.target.value)}>
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="country">Country</label>
                  <input
                    id="country"
                    type="text"
                    placeholder="Kenya"
                    value={form.country}
                    onChange={(e) => set("country", e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="timezone">Time Zone</label>
                  <select id="timezone" value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
                    {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="currency">Currency</label>
                <select id="currency" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="branchName">First Branch Name</label>
                <input
                  id="branchName"
                  type="text"
                  placeholder="Main Branch"
                  value={form.branchName}
                  onChange={(e) => set("branchName", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="branchAddress">Branch Address (optional)</label>
                <input
                  id="branchAddress"
                  type="text"
                  placeholder="e.g. Ngong Road, Kilimani, Nairobi"
                  value={form.branchAddress}
                  onChange={(e) => set("branchAddress", e.target.value)}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="form-group">
                <label htmlFor="ownerName">Your Full Name</label>
                <input
                  id="ownerName"
                  type="text"
                  placeholder="e.g. Amina Otieno"
                  value={form.ownerName}
                  onChange={(e) => set("ownerName", e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="ownerEmail">Email Address</label>
                <input
                  id="ownerEmail"
                  type="email"
                  placeholder="amina@ironpeak.co.ke"
                  value={form.ownerEmail}
                  onChange={(e) => set("ownerEmail", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="ownerPhone">Phone Number (optional)</label>
                <input
                  id="ownerPhone"
                  type="tel"
                  placeholder="+254 712 345 678"
                  value={form.ownerPhone}
                  onChange={(e) => set("ownerPhone", e.target.value)}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    placeholder="Min 8 characters"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repeat password"
                    value={form.confirmPassword}
                    onChange={(e) => set("confirmPassword", e.target.value)}
                  />
                </div>
              </div>
              {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="form-error">Passwords do not match.</p>
              )}
            </>
          )}

          {step === 3 && (
            <div className="signup-review">
              <div className="review-section">
                <h3>Gym</h3>
                <div className="review-row"><span>Name</span><strong>{form.gymName}</strong></div>
                <div className="review-row"><span>URL</span><strong>fitos.app/{form.slug}</strong></div>
                <div className="review-row"><span>Type</span><strong>{form.businessType.replace(/_/g, " ")}</strong></div>
              </div>
              <div className="review-section">
                <h3>Location</h3>
                <div className="review-row"><span>Country</span><strong>{form.country}</strong></div>
                <div className="review-row"><span>Timezone</span><strong>{form.timezone}</strong></div>
                <div className="review-row"><span>Currency</span><strong>{form.currency}</strong></div>
                <div className="review-row"><span>Branch</span><strong>{form.branchName}</strong></div>
              </div>
              <div className="review-section">
                <h3>Owner Account</h3>
                <div className="review-row"><span>Name</span><strong>{form.ownerName}</strong></div>
                <div className="review-row"><span>Email</span><strong>{form.ownerEmail}</strong></div>
              </div>
              <div className="review-trial">
                <span className="trial-badge">14-Day Free Trial</span>
                <p>Full access to all FITOS Pro features. No credit card required.</p>
              </div>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="signup-actions">
            {step > 0 && (
              <button type="button" className="btn-outline" onClick={() => setStep((s) => s - 1)}>
                Back
              </button>
            )}
            {step < STEPS.length - 1 && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canGoNext()}
              >
                Continue →
              </button>
            )}
            {step === STEPS.length - 1 && (
              <button
                type="button"
                className="btn-primary btn-large"
                onClick={submit}
                disabled={loading}
              >
                {loading ? "Creating your account…" : "Start Free Trial"}
              </button>
            )}
          </div>
        </div>

        <p className="signup-login-link">
          Already have an account?{" "}
          <a href="/login">Sign in</a>
        </p>
      </div>

      <style>{`
        .signup-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          padding: 2rem 1rem;
          background: #07080a;
        }
        .signup-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.35) 0%, transparent 70%),
                      radial-gradient(ellipse 50% 40% at 90% 80%, rgba(139,92,246,0.2) 0%, transparent 60%);
        }
        .signup-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 520px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          padding: 2.5rem 2rem;
          backdrop-filter: blur(24px);
        }
        .signup-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 1.5rem; }
        .signup-logo {
          width: 40px; height: 40px; border-radius: 10px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.2rem; font-weight: 900; color: white;
        }
        .signup-brand-name { font-size: 1.3rem; font-weight: 800; color: white; letter-spacing: 2px; }
        .signup-title { font-size: 1.6rem; font-weight: 800; color: white; margin-bottom: .4rem; }
        .signup-subtitle { color: rgba(255,255,255,0.5); margin-bottom: 1.75rem; font-size: .9rem; }

        .signup-steps {
          display: flex;
          gap: .75rem;
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .signup-step { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
        .signup-step-dot {
          width: 28px; height: 28px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: .75rem; font-weight: 700;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.4);
          transition: all .25s;
        }
        .signup-step.active .signup-step-dot {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-color: transparent;
          color: white;
          box-shadow: 0 0 16px rgba(99,102,241,0.5);
        }
        .signup-step.done .signup-step-dot {
          background: rgba(34,197,94,0.2);
          border-color: rgba(34,197,94,0.5);
          color: #4ade80;
        }
        .signup-step-label { font-size: .65rem; color: rgba(255,255,255,0.35); text-align: center; }
        .signup-step.active .signup-step-label { color: rgba(255,255,255,0.75); }

        .signup-form { display: flex; flex-direction: column; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-row { display: flex; gap: 1rem; }
        .form-row .form-group { flex: 1; }
        .form-group label {
          font-size: .8rem; font-weight: 600;
          color: rgba(255,255,255,0.65);
          display: flex; align-items: center; justify-content: space-between;
        }
        .form-hint { font-weight: 400; color: rgba(255,255,255,0.35); font-size: .75rem; }
        .form-group input,
        .form-group select {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          padding: .6rem .85rem;
          color: white;
          font-size: .9rem;
          transition: border-color .2s, box-shadow .2s;
          outline: none;
        }
        .form-group input::placeholder { color: rgba(255,255,255,0.25); }
        .form-group input:focus,
        .form-group select:focus {
          border-color: rgba(99,102,241,0.6);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
        }
        .form-group select option { background: #1a1b2e; }
        .form-error { color: #f87171; font-size: .82rem; }

        .signup-review { display: flex; flex-direction: column; gap: 1rem; }
        .review-section {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 1rem;
        }
        .review-section h3 {
          font-size: .75rem; font-weight: 700; color: rgba(99,102,241,0.9);
          text-transform: uppercase; letter-spacing: 1px;
          margin-bottom: .75rem;
        }
        .review-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: .35rem 0;
          font-size: .85rem;
        }
        .review-row span { color: rgba(255,255,255,0.45); }
        .review-row strong { color: white; }
        .review-trial {
          display: flex; flex-direction: column; align-items: center; gap: .5rem;
          text-align: center; padding: 1.25rem;
          background: rgba(99,102,241,0.08);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 12px;
        }
        .trial-badge {
          display: inline-block;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white; font-size: .75rem; font-weight: 700;
          padding: .25rem .75rem; border-radius: 99px;
        }
        .review-trial p { color: rgba(255,255,255,0.5); font-size: .82rem; }

        .signup-actions {
          display: flex; gap: .75rem; justify-content: flex-end;
          margin-top: .5rem;
        }
        .btn-outline {
          padding: .6rem 1.25rem; border-radius: 10px; font-size: .9rem; font-weight: 600;
          background: transparent; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.7);
          cursor: pointer; transition: all .2s;
        }
        .btn-outline:hover { border-color: rgba(255,255,255,0.4); color: white; }
        .btn-primary {
          padding: .6rem 1.5rem; border-radius: 10px; font-size: .9rem; font-weight: 700;
          background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white;
          border: none; cursor: pointer; transition: all .2s;
        }
        .btn-primary:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
        .btn-large { padding: .75rem 2rem; font-size: 1rem; }
        .signup-login-link {
          text-align: center; margin-top: 1.5rem; color: rgba(255,255,255,0.4); font-size: .85rem;
        }
        .signup-login-link a { color: #818cf8; text-decoration: none; font-weight: 600; }
        .signup-login-link a:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
