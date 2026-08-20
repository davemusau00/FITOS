import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Inject, Injectable, Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ScryptPasswordHasher } from "@fitos/auth";
import { ApiExceptionFilter } from "./common/errors/http-exception.filter.js";
import { PermissionGuard } from "./common/auth/permission.guard.js";
import { RateLimitService } from "./common/auth/rate-limit.service.js";
import { SessionGuard } from "./common/auth/session.guard.js";
import { AuthService } from "./common/auth/auth.service.js";
import { IdempotencyService } from "./common/idempotency/idempotency.service.js";
import { RequestLoggingInterceptor } from "./common/logging/request-logging.interceptor.js";
import { FitosRepositoryToken } from "./ports/tokens.js";
import type { FitosRepository } from "./ports/fitos-repository.js";
import { InMemoryFitosRepository } from "./repositories/in-memory-fitos.repository.js";
import { DrizzleFitosRepository } from "./repositories/drizzle-fitos.repository.js";
import { HealthController } from "./modules/health/health.controller.js";
import { AuthController } from "./modules/auth/auth.controller.js";
import { OrganizationsController } from "./modules/organizations/organizations.controller.js";
import { BranchesController } from "./modules/branches/branches.controller.js";
import { MembersController } from "./modules/members/members.controller.js";
import { UsersController } from "./modules/users/users.controller.js";
import { AuditController } from "./modules/audit/audit.controller.js";
import { LeadsController } from "./modules/leads/leads.controller.js";
import { CoreService } from "./modules/core/core.service.js";

class DevelopmentSeedService implements OnModuleInit {
  constructor(@Inject(FitosRepositoryToken) private readonly repository: FitosRepository) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === "production" || !this.repository.seedDevelopmentData) return;
    const hash = await new ScryptPasswordHasher().hash(
      process.env.FITOS_SEED_PASSWORD ?? "ChangeMe123!"
    );
    await this.repository.seedDevelopmentData(hash);
  }
}

@Injectable()
class DatabaseShutdownService implements OnModuleDestroy {
  constructor(@Inject(FitosRepositoryToken) private readonly repository: FitosRepository) {}

  async onModuleDestroy(): Promise<void> {
    if (this.repository instanceof DrizzleFitosRepository) await this.repository.close();
  }
}

const repositoryFactory = (): FitosRepository => {
  if (process.env.FITOS_REPOSITORY === "drizzle") return new DrizzleFitosRepository();
  return new InMemoryFitosRepository();
};

@Module({
  controllers: [
    HealthController,
    AuthController,
    OrganizationsController,
    BranchesController,
    MembersController,
    UsersController,
    AuditController,
    LeadsController
  ],
  providers: [
    { provide: FitosRepositoryToken, useFactory: repositoryFactory },
    DevelopmentSeedService,
    DatabaseShutdownService,
    AuthService,
    CoreService,
    IdempotencyService,
    RateLimitService,
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor }
  ]
})
export class AppModule {}
