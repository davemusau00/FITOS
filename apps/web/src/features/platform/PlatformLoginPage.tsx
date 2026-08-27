import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, FormField } from "@fitos/ui";
import { FitosLogo } from "../../app/logo";
import { api } from "../../lib/api/client";
import { ErrorNotice } from "../shared";

export function PlatformLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@fitos.test");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="login-panel__inner">
          <FitosLogo height={28} />
          <div className="login-header">
            <span className="login-eyebrow">FITOS PLATFORM</span>
            <h1>Authorized personnel only.</h1>
            <p className="login-copy">
              Operate tenants, implementation, and SaaS health from the platform control plane.
            </p>
          </div>
          <form
            className="login-form"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitting(true);
              setError(null);
              void api
                .platformLogin({ email, password })
                .then((session) => {
                  window.localStorage.setItem("fitos_platform_token", session.token);
                  navigate("/platform", { replace: true });
                })
                .catch(setError)
                .finally(() => setSubmitting(false));
            }}
          >
            <FormField htmlFor="platform-email" label="Email">
              <input
                id="platform-email"
                className="fitos-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>
            <FormField htmlFor="platform-password" label="Password">
              <input
                id="platform-password"
                type="password"
                className="fitos-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>
            <ErrorNotice error={error} />
            <Button type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Continue"}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
