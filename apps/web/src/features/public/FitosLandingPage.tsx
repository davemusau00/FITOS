import { Link } from "react-router-dom";
import { FitosLogo } from "../../app/logo";

export function FitosLandingPage() {
  return <main className="public-page" style={{ minHeight: "100vh", padding: "2rem", maxWidth: "70rem", margin: "auto" }}>
    <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><FitosLogo height={28} /><Link to="/login">Sign in</Link></nav>
    <section style={{ padding: "7rem 0 4rem", maxWidth: "48rem" }}><p className="eyebrow">FITNESS OPERATING SYSTEM</p><h1 style={{ fontSize: "clamp(2.8rem,8vw,5.8rem)", lineHeight: .95 }}>Everything fitness. One OS.</h1><p style={{ fontSize: "1.2rem", lineHeight: 1.6 }}>Run members, bookings, schedules, attendance, performance, therapy, equipment, inventory, websites and growth from one operating system.</p><div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "2rem" }}><Link className="fitos-button fitos-button--primary" to="/configure">Configure FITOS for my business</Link><Link className="fitos-button fitos-button--secondary" to="/signup">Start FITOS</Link></div></section>
    <section><h2>Built around how you operate</h2><p>Gyms, studios, performance labs, rehab and wellness facilities can configure FITOS around their people, services, facilities and growth workflow.</p></section>
  </main>;
}
