import "dotenv/config";
import { eq } from "drizzle-orm";
import { ScryptPasswordHasher } from "@fitos/auth";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_KEYS, type RoleKey } from "@fitos/contracts";
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

const roleNames: Record<RoleKey, string> = {
  owner: "Owner",
  manager: "Manager",
  reception: "Reception",
  trainer: "Trainer",
  finance: "Finance"
};

async function ensureDemoTenant(input: {
  name: string;
  slug: string;
  branchName: string;
  branchSlug: string;
  email: string;
  displayName: string;
  passwordHash: string;
  staff?: Array<{
    email: string;
    displayName: string;
    roleKey: Exclude<RoleKey, "owner">;
  }>;
}) {
  const existing = await database.db.query.tenants.findFirst({
    where: eq(tenants.slug, input.slug)
  });
  if (existing) return;

  await database.db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({ name: input.name, slug: input.slug })
      .returning();
    if (!tenant) throw new Error("Unable to create demo tenant.");
    const [branch] = await tx
      .insert(branches)
      .values({
        tenantId: tenant.id,
        name: input.branchName,
        slug: input.branchSlug,
        city: "Nairobi"
      })
      .returning();
    if (!branch) throw new Error("Unable to create demo branch.");

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
      if (!role) throw new Error(`Unable to create ${roleKey} role.`);
      roleByKey.set(roleKey, role.id);
      await tx.insert(rolePermissions).values(
        DEFAULT_ROLE_PERMISSIONS[roleKey].map((permissionKey) => ({
          roleId: role.id,
          permissionKey
        }))
      );
    }

    const [user] = await tx
      .insert(users)
      .values({
        email: input.email,
        displayName: input.displayName,
        passwordHash: input.passwordHash
      })
      .returning();
    const ownerRoleId = roleByKey.get("owner");
    if (!user || !ownerRoleId) throw new Error("Unable to create demo owner.");
    const [tenantUser] = await tx
      .insert(tenantUsers)
      .values({ tenantId: tenant.id, userId: user.id, roleId: ownerRoleId })
      .returning();
    if (!tenantUser) throw new Error("Unable to create demo tenant user.");
    await tx.insert(userBranchAccess).values({ tenantUserId: tenantUser.id, branchId: branch.id });

    for (const staffInput of input.staff ?? []) {
      const roleId = roleByKey.get(staffInput.roleKey);
      if (!roleId) throw new Error(`Unable to find ${staffInput.roleKey} role.`);
      const [staffUser] = await tx
        .insert(users)
        .values({
          email: staffInput.email,
          displayName: staffInput.displayName,
          passwordHash: input.passwordHash
        })
        .returning();
      if (!staffUser) throw new Error(`Unable to create ${staffInput.roleKey} demo user.`);
      const [staffMembership] = await tx
        .insert(tenantUsers)
        .values({ tenantId: tenant.id, userId: staffUser.id, roleId })
        .returning();
      if (!staffMembership) throw new Error(`Unable to create ${staffInput.roleKey} membership.`);
      await tx
        .insert(userBranchAccess)
        .values({ tenantUserId: staffMembership.id, branchId: branch.id });
    }
  });
}

const database = createDatabase();
try {
  for (const key of PERMISSION_KEYS) {
    await database.db
      .insert(permissions)
      .values({ key, description: key.replace(":", " ") })
      .onConflictDoNothing({ target: permissions.key });
  }
  const passwordHash = await new ScryptPasswordHasher().hash(
    process.env.FITOS_SEED_PASSWORD ?? "ChangeMe123!"
  );
  await ensureDemoTenant({
    name: "FITOS Demo Gym",
    slug: "fitos-demo-gym",
    branchName: "Kilimani",
    branchSlug: "kilimani",
    email: "owner@gym.fitos.test",
    displayName: "Gym Owner",
    passwordHash,
    staff: [
      {
        email: "reception@gym.fitos.test",
        displayName: "Gym Reception",
        roleKey: "reception"
      },
      {
        email: "finance@gym.fitos.test",
        displayName: "Gym Finance",
        roleKey: "finance"
      },
      {
        email: "trainer@gym.fitos.test",
        displayName: "Gym Trainer",
        roleKey: "trainer"
      }
    ]
  });
  await ensureDemoTenant({
    name: "FITOS Demo Pilates",
    slug: "fitos-demo-pilates",
    branchName: "Westlands",
    branchSlug: "westlands",
    email: "owner@pilates.fitos.test",
    displayName: "Pilates Owner",
    passwordHash
  });
  process.stdout.write("FITOS development seed complete.\n");
} finally {
  await database.pool.end();
}
