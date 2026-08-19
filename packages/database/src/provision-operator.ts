import "dotenv/config";
import { ScryptPasswordHasher } from "@fitos/auth";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_KEYS, type RoleKey } from "@fitos/contracts";
import { eq } from "drizzle-orm";
import { createDatabase } from "./client.js";
import {
  branches,
  permissions,
  rolePermissions,
  roles,
  tenantUsers,
  tenants,
  userBranchAccess,
  users
} from "./schema.js";

const [tenantName, tenantSlug, ownerEmail, ownerName, branchName = "Main", branchSlug = "main"] =
  process.argv.slice(2);
if (!tenantName || !tenantSlug || !ownerEmail || !ownerName) {
  throw new Error(
    "Usage: npm run provision:operator --workspace=@fitos/database -- <tenant-name> <tenant-slug> <owner-email> <owner-name> [branch-name] [branch-slug]"
  );
}

const roleNames: Record<RoleKey, string> = {
  owner: "Owner",
  manager: "Manager",
  reception: "Reception",
  trainer: "Trainer",
  finance: "Finance"
};
const database = createDatabase();
try {
  const existing = await database.db.query.tenants.findFirst({
    where: eq(tenants.slug, tenantSlug)
  });
  if (existing) throw new Error(`Tenant slug '${tenantSlug}' already exists.`);
  const password = process.env.FITOS_INITIAL_OWNER_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("Set FITOS_INITIAL_OWNER_PASSWORD to a 12+ character one-time password.");
  }
  const passwordHash = await new ScryptPasswordHasher().hash(password);
  await database.db.transaction(async (tx) => {
    for (const key of PERMISSION_KEYS) {
      await tx
        .insert(permissions)
        .values({ key, description: key.replace(":", " ") })
        .onConflictDoNothing({ target: permissions.key });
    }
    const [tenant] = await tx
      .insert(tenants)
      .values({ name: tenantName, slug: tenantSlug })
      .returning();
    if (!tenant) throw new Error("Tenant creation failed.");
    const [branch] = await tx
      .insert(branches)
      .values({ tenantId: tenant.id, name: branchName, slug: branchSlug })
      .returning();
    if (!branch) throw new Error("Branch creation failed.");
    const roleByKey = new Map<RoleKey, string>();
    for (const roleKey of Object.keys(roleNames) as RoleKey[]) {
      const [role] = await tx
        .insert(roles)
        .values({
          tenantId: tenant.id,
          name: roleNames[roleKey],
          systemKey: roleKey,
          isSystem: true
        })
        .returning();
      if (!role) throw new Error(`Role creation failed for ${roleKey}.`);
      roleByKey.set(roleKey, role.id);
      await tx
        .insert(rolePermissions)
        .values(
          DEFAULT_ROLE_PERMISSIONS[roleKey].map((permissionKey) => ({
            roleId: role.id,
            permissionKey
          }))
        );
    }
    const [user] = await tx
      .insert(users)
      .values({ email: ownerEmail.toLowerCase(), displayName: ownerName, passwordHash })
      .returning();
    const ownerRoleId = roleByKey.get("owner");
    if (!user || !ownerRoleId) throw new Error("Owner creation failed.");
    const [tenantUser] = await tx
      .insert(tenantUsers)
      .values({ tenantId: tenant.id, userId: user.id, roleId: ownerRoleId })
      .returning();
    if (!tenantUser) throw new Error("Tenant membership creation failed.");
    await tx.insert(userBranchAccess).values({ tenantUserId: tenantUser.id, branchId: branch.id });
  });
  process.stdout.write(`Provisioned ${tenantSlug}; require a password reset on first sign-in.\n`);
} finally {
  await database.pool.end();
}
