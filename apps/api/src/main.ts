import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { Express } from "express";
import { z } from "zod";
import { AppModule } from "./app.module.js";
import { requestIdMiddleware } from "./common/request-context/request-id.middleware.js";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_PUBLIC_URL: z.string().url().default("http://localhost:5173"),
  SESSION_SECRET: z.string().min(32).default("local-development-only-change-me"),
  CSRF_SECRET: z.string().min(32).default("local-development-only-change-me"),
  FITOS_REPOSITORY: z.enum(["memory", "drizzle"]).default("memory")
});

async function bootstrap(): Promise<void> {
  const config = environmentSchema.parse(process.env);
  if (config.NODE_ENV === "production" && config.FITOS_REPOSITORY !== "drizzle") {
    throw new Error("FITOS_REPOSITORY=drizzle is required in production.");
  }
  if (
    config.NODE_ENV === "production" &&
    (config.SESSION_SECRET === "local-development-only-change-me" ||
      config.CSRF_SECRET === "local-development-only-change-me")
  ) {
    throw new Error(
      "Production SESSION_SECRET and CSRF_SECRET must be unique values of at least 32 characters."
    );
  }
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const express = app.getHttpAdapter().getInstance() as Express;
  express.set("trust proxy", 1);
  app.use(requestIdMiddleware);
  app.useGlobalPipes(new ValidationPipe({ transform: false, whitelist: false }));
  app.enableCors({
    origin: config.WEB_PUBLIC_URL,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Idempotency-Key", "X-CSRF-Token", "X-Request-Id"]
  });
  app.setGlobalPrefix("api/v1");
  const swagger = new DocumentBuilder()
    .setTitle("FITOS API")
    .setDescription("Tenant-safe Fitness Operating System API")
    .setVersion("1.0")
    .addCookieAuth("fitos_session")
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swagger));
  await app.listen(config.API_PORT, "0.0.0.0");
  process.stdout.write(
    JSON.stringify({ event: "api.ready", port: config.API_PORT, environment: config.NODE_ENV }) +
      "\n"
  );
}

void bootstrap();
