import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
import { Button, FormField, Icon } from "@fitos/ui";
import { useAuth, workspacePath } from "../../app/auth";
import { FitosLogo, Brandmark } from "../../app/logo";
import { ErrorNotice } from "../shared";

export function LoginPage() {
  const { auth, isLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<{ email: string; password: string }>({
    defaultValues: { email: "owner@gym.fitos.test", password: "ChangeMe123!" }
  });

  const [error, setError] = useState<unknown>(null);

  if (auth) return <Navigate replace to={workspacePath(auth)} />;

  const fillDemo = (email: string) => {
    setValue("email", email);
    setValue("password", "ChangeMe123!");
  };

  return (
    <main className="login-screen">
      {/* ── Left Side: Auth Form ── */}
      <section className="login-panel">
        <div className="login-panel__inner">
          <div className="login-logo">
            <FitosLogo height={28} />
          </div>

          <div className="login-header">
            <span className="login-eyebrow">FITNESS OPERATING SYSTEM</span>
            <h1>Run your fitness business with clarity.</h1>
            <p className="login-copy">
              Sign in to manage classes, members, schedules, and daily operations in one focused
              workspace.
            </p>
          </div>

          <form
            className="login-form"
            onSubmit={handleSubmit(async (input) => {
              setError(null);
              try {
                const session = await signIn(input);
                navigate(workspacePath(session), { replace: true });
              } catch (cause) {
                setError(cause);
              }
            })}
          >
            <FormField error={errors.email?.message} htmlFor="email" label="Email Address">
              <input
                autoComplete="email"
                className="fitos-control"
                id="email"
                placeholder="name@business.com"
                {...register("email", { required: "Enter your email address." })}
              />
            </FormField>

            <FormField error={errors.password?.message} htmlFor="password" label="Password">
              <div className="password-input-wrap">
                <input
                  autoComplete="current-password"
                  className="fitos-control"
                  id="password"
                  placeholder="••••••••••••"
                  type={showPassword ? "text" : "password"}
                  {...register("password", { required: "Enter your password." })}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  type="button"
                >
                  <Icon name={showPassword ? "eye-off" : "eye"} size={16} />
                </button>
              </div>
            </FormField>

            <ErrorNotice error={error} />

            <Button
              className="login-submit-btn"
              fullWidth
              loading={isSubmitting || isLoading}
              type="submit"
            >
              Sign in to Dashboard
            </Button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="login-demo-box">
            <div className="login-demo-header">
              <Icon name="spark" size={14} style={{ color: "var(--fitos-energy)" }} />
              <span>Demo Accounts (Click to load):</span>
            </div>
            <div className="login-demo-pills">
              <button
                className="demo-pill"
                onClick={() => fillDemo("owner@gym.fitos.test")}
                type="button"
              >
                <strong>Owner</strong> (owner@gym.fitos.test)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Right Side: Brand Showcase Art ── */}
      <aside aria-hidden="true" className="login-art">
        <div className="login-art__glow" />
        <div className="login-art__watermark">
          <Brandmark size={380} />
        </div>

        <div className="login-art__content">
          <div className="login-art__badge">
            <Icon name="spark" size={14} />
            <span>OPERATING SYSTEM FOR FITNESS</span>
          </div>

          <h2>
            One OS. Every workout.
            <br />
            Every member. Every growth.
          </h2>

          <p>
            The all-in-one platform engineered specifically for modern gyms, boutique studios, and
            high-performance training centers.
          </p>

          <div className="login-art__features">
            <div className="feature-chip">
              <Icon name="calendar" size={14} />
              <span>Timetable & Scheduling</span>
            </div>
            <div className="feature-chip">
              <Icon name="users" size={14} />
              <span>Member CRM & Retention</span>
            </div>
            <div className="feature-chip">
              <Icon name="check" size={14} />
              <span>Front-Desk Check-ins</span>
            </div>
            <div className="feature-chip">
              <Icon name="shield" size={14} />
              <span>Multi-Branch Isolation</span>
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}
