import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
import { Button, FormField } from "@fitos/ui";
import { useAuth } from "../../app/auth";
import { ErrorNotice } from "../shared";

export function LoginPage() {
  const { auth, isLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<{ email: string; password: string }>({
    defaultValues: { email: "owner@gym.fitos.test", password: "ChangeMe123!" }
  });
  const [error, setError] = useState<unknown>(null);
  if (auth) return <Navigate replace to="/app/overview" />;
  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="fitos-logo fitos-logo--large">
          <span>F</span>
          <strong>FITOS</strong>
        </div>
        <p className="login-eyebrow">Fitness operating system</p>
        <h1>Run the floor with clarity.</h1>
        <p className="login-copy">
          Bookings, members, payments and growth in one focused workspace.
        </p>
        <form
          className="form-stack"
          onSubmit={handleSubmit(async (input) => {
            setError(null);
            try {
              await signIn(input);
              navigate("/app/overview", { replace: true });
            } catch (cause) {
              setError(cause);
            }
          })}
        >
          <FormField error={errors.email?.message} htmlFor="email" label="Email">
            <input
              autoComplete="email"
              className="fitos-control"
              id="email"
              {...register("email", { required: "Enter your email." })}
            />
          </FormField>
          <FormField error={errors.password?.message} htmlFor="password" label="Password">
            <input
              autoComplete="current-password"
              className="fitos-control"
              id="password"
              type="password"
              {...register("password", { required: "Enter your password." })}
            />
          </FormField>
          <ErrorNotice error={error} />
          <Button fullWidth loading={isSubmitting || isLoading} type="submit">
            Sign in
          </Button>
        </form>
        <p className="login-help">Demo: owner@gym.fitos.test / ChangeMe123!</p>
      </section>
      <aside className="login-art" aria-hidden="true">
        <div className="login-art__mark">F</div>
        <p>
          Bookings. Members. Payments. Growth.
          <br />
          <strong>One FITOS.</strong>
        </p>
      </aside>
    </main>
  );
}
