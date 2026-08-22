import "dotenv/config";
import { eq } from "drizzle-orm";
import { ScryptPasswordHasher } from "@fitos/auth";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_KEYS, type RoleKey } from "@fitos/contracts";
import { createDatabase } from "./client.js";
import {
  attendanceRecords,
  bookings,
  branches,
  contacts,
  creditLedger,
  leads,
  memberMemberships,
  members,
  membershipPlans,
  paymentTransactions,
  permissions,
  rolePermissions,
  roles,
  rooms,
  scheduleOccurrences,
  services,
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
  seedRichData?: boolean;
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

    let trainerUserId: string | null = null;
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
      if (staffInput.roleKey === "trainer") trainerUserId = staffUser.id;
    }

    if (!input.seedRichData) return;

    // ── Rooms ──
    const [roomMain] = await tx.insert(rooms).values({
      tenantId: tenant.id, branchId: branch.id,
      name: "Main Studio", capacity: 20, isActive: true
    }).returning();
    const [roomSpin] = await tx.insert(rooms).values({
      tenantId: tenant.id, branchId: branch.id,
      name: "Spin Studio", capacity: 15, isActive: true
    }).returning();

    // ── Services ──
    const serviceRecords = await tx.insert(services).values([
      { tenantId: tenant.id, name: "HIIT Bootcamp", slug: "hiit-bootcamp", serviceType: "class", durationMinutes: 45, defaultCapacity: 20, creditsRequired: 1, cancellationCutoffMinutes: 60, restoreCreditOnLateCancel: false, amountMinor: "80000", currency: "KES", publicVisible: true, isActive: true },
      { tenantId: tenant.id, name: "Morning Yoga Flow", slug: "morning-yoga", serviceType: "class", durationMinutes: 60, defaultCapacity: 20, creditsRequired: 1, cancellationCutoffMinutes: 60, restoreCreditOnLateCancel: false, amountMinor: "60000", currency: "KES", publicVisible: true, isActive: true },
      { tenantId: tenant.id, name: "Indoor Cycling", slug: "indoor-cycling", serviceType: "class", durationMinutes: 45, defaultCapacity: 15, creditsRequired: 1, cancellationCutoffMinutes: 60, restoreCreditOnLateCancel: false, amountMinor: "70000", currency: "KES", publicVisible: true, isActive: true },
      { tenantId: tenant.id, name: "Personal Training", slug: "personal-training", serviceType: "appointment", durationMinutes: 60, defaultCapacity: 1, creditsRequired: 2, cancellationCutoffMinutes: 120, restoreCreditOnLateCancel: false, amountMinor: "350000", currency: "KES", publicVisible: false, isActive: true },
      { tenantId: tenant.id, name: "Strength & Conditioning", slug: "strength-conditioning", serviceType: "class", durationMinutes: 60, defaultCapacity: 20, creditsRequired: 1, cancellationCutoffMinutes: 60, restoreCreditOnLateCancel: false, amountMinor: "75000", currency: "KES", publicVisible: true, isActive: true },
      { tenantId: tenant.id, name: "Pilates Mat", slug: "pilates-mat", serviceType: "class", durationMinutes: 50, defaultCapacity: 15, creditsRequired: 1, cancellationCutoffMinutes: 60, restoreCreditOnLateCancel: false, amountMinor: "65000", currency: "KES", publicVisible: true, isActive: true }
    ]).returning();

    // ── Membership Plans ──
    const [planMonthly, planPunch10, planPunch5, planTrial] = await tx.insert(membershipPlans).values([
      { tenantId: tenant.id, name: "Monthly Unlimited", slug: "monthly-unlimited", amountMinor: "500000", currency: "KES", durationDays: 30, includedCredits: 30, publicVisible: true, isActive: true },
      { tenantId: tenant.id, name: "10-Class Punch Pass", slug: "punch-10", amountMinor: "600000", currency: "KES", durationDays: 60, includedCredits: 10, publicVisible: true, isActive: true },
      { tenantId: tenant.id, name: "5-Class Starter Pack", slug: "starter-5", amountMinor: "280000", currency: "KES", durationDays: 30, includedCredits: 5, publicVisible: true, isActive: true },
      { tenantId: tenant.id, name: "Free Trial Pass", slug: "free-trial", amountMinor: "0", currency: "KES", durationDays: 7, includedCredits: 2, publicVisible: false, isActive: true }
    ]).returning();

    // ── Members ──
    const memberData = [
      { firstName: "Amina", lastName: "Otieno", phone: "+254712345678", email: "amina.otieno@gmail.com", status: "active", plan: planMonthly, memberNumber: "GYM-0001" },
      { firstName: "Brian", lastName: "Kamau", phone: "+254723456789", email: "bkamau@outlook.com", status: "active", plan: planPunch10, memberNumber: "GYM-0002" },
      { firstName: "Christine", lastName: "Wanjiku", phone: "+254734567890", email: "christine.w@gmail.com", status: "active", plan: planMonthly, memberNumber: "GYM-0003" },
      { firstName: "David", lastName: "Muthoni", phone: "+254745678901", email: null, status: "active", plan: planPunch10, memberNumber: "GYM-0004" },
      { firstName: "Esther", lastName: "Njoroge", phone: "+254756789012", email: "esther.njoroge@gmail.com", status: "active", plan: planMonthly, memberNumber: "GYM-0005" },
      { firstName: "Felix", lastName: "Ochieng", phone: "+254767890123", email: null, status: "active", plan: planPunch5, memberNumber: "GYM-0006" },
      { firstName: "Grace", lastName: "Achieng", phone: "+254778901234", email: "grace.a@yahoo.com", status: "active", plan: planMonthly, memberNumber: "GYM-0007" },
      { firstName: "Hassan", lastName: "Omar", phone: "+254789012345", email: null, status: "active", plan: planTrial, memberNumber: "GYM-0008" },
      { firstName: "Irene", lastName: "Mwangi", phone: "+254790123456", email: "irene.mwangi@gmail.com", status: "active", plan: planPunch10, memberNumber: "GYM-0009" },
      { firstName: "James", lastName: "Kariuki", phone: "+254701234567", email: "jkariuki@company.co.ke", status: "active", plan: planMonthly, memberNumber: "GYM-0010" },
      { firstName: "Karen", lastName: "Waweru", phone: "+254711111111", email: null, status: "active", plan: planPunch5, memberNumber: "GYM-0011" },
      { firstName: "Liam", lastName: "Gitau", phone: "+254722222222", email: "liam.g@gmail.com", status: "active", plan: planMonthly, memberNumber: "GYM-0012" },
      { firstName: "Mary", lastName: "Nyambura", phone: "+254733333333", email: null, status: "active", plan: planPunch10, memberNumber: "GYM-0013" },
      { firstName: "Nathan", lastName: "Ouma", phone: "+254744444444", email: "nouma@gmail.com", status: "active", plan: planTrial, memberNumber: "GYM-0014" },
      { firstName: "Olivia", lastName: "Wangari", phone: "+254755555555", email: null, status: "active", plan: planMonthly, memberNumber: "GYM-0015" },
      { firstName: "Peter", lastName: "Kimani", phone: "+254766666666", email: "peter.kimani@gmail.com", status: "inactive", plan: planPunch10, memberNumber: "GYM-0016" },
      { firstName: "Queen", lastName: "Adhiambo", phone: "+254777777777", email: null, status: "inactive", plan: planMonthly, memberNumber: "GYM-0017" },
      { firstName: "Robert", lastName: "Kiprotich", phone: "+254788888888", email: "r.kiprotich@gmail.com", status: "inactive", plan: planPunch10, memberNumber: "GYM-0018" },
      { firstName: "Sharon", lastName: "Mutua", phone: "+254799999999", email: null, status: "inactive", plan: planMonthly, memberNumber: "GYM-0019" },
      { firstName: "Thomas", lastName: "Ndirangu", phone: "+254700000001", email: "t.ndirangu@gmail.com", status: "active", plan: planPunch5, memberNumber: "GYM-0020" }
    ];

    for (const m of memberData) {
      const [contact] = await tx.insert(contacts).values({
        tenantId: tenant.id,
        firstName: m.firstName,
        lastName: m.lastName,
        phoneE164: m.phone,
        email: m.email
      }).returning();
      if (!contact) continue;

      const [member] = await tx.insert(members).values({
        tenantId: tenant.id,
        contactId: contact.id,
        homeBranchId: branch.id,
        memberNumber: m.memberNumber,
        status: m.status
      }).returning();
      if (!member || !m.plan) continue;

      const [membership] = await tx.insert(memberMemberships).values({
        tenantId: tenant.id,
        memberId: member.id,
        planId: m.plan.id,
        planSnapshot: m.plan,
        status: m.status === "active" ? "active" : "cancelled",
        startsAt: new Date()
      }).returning();
      if (!membership) continue;

      await tx.insert(creditLedger).values({
        tenantId: tenant.id,
        membershipId: membership.id,
        memberId: member.id,
        delta: m.plan.includedCredits,
        reason: "purchase",
        note: `${m.plan.name} initial allocation`
      });
    }

    // ── Leads ──
    const leadData = [
      { firstName: "Aisha", lastName: "Maina", phone: "+254712000001", email: "aisha.maina@gmail.com", interest: "Weight loss + group classes", source: "instagram", stage: "new" },
      { firstName: "Bernard", lastName: "Oloo", phone: "+254723000002", email: null, interest: "Strength training", source: "walk_in", stage: "contacted" },
      { firstName: "Carol", lastName: "Mbugua", phone: "+254734000003", email: "carol.mbugua@outlook.com", interest: "Yoga & stress relief", source: "referral", stage: "trial_booked" },
      { firstName: "Daniel", lastName: "Wekesa", phone: "+254745000004", email: null, interest: "Spin & cardio", source: "facebook", stage: "trial_completed" },
      { firstName: "Eva", lastName: "Chebet", phone: "+254756000005", email: "eva.chebet@gmail.com", interest: "HIIT bootcamp", source: "instagram", stage: "offer" },
      { firstName: "Frank", lastName: "Odero", phone: "+254767000006", email: null, interest: "Personal training", source: "google", stage: "new" },
      { firstName: "Gloria", lastName: "Ndungu", phone: "+254778000007", email: "gloria.n@gmail.com", interest: "Morning yoga", source: "referral", stage: "contacted" },
      { firstName: "Henry", lastName: "Chesang", phone: "+254789000008", email: null, interest: "General fitness", source: "walk_in", stage: "lost" }
    ];

    for (const l of leadData) {
      const [contact] = await tx.insert(contacts).values({
        tenantId: tenant.id,
        firstName: l.firstName,
        lastName: l.lastName,
        phoneE164: l.phone,
        email: l.email
      }).returning();
      if (!contact) continue;

      await tx.insert(leads).values({
        tenantId: tenant.id,
        contactId: contact.id,
        branchId: branch.id,
        interest: l.interest,
        source: l.source,
        stage: l.stage,
        lostReason: l.stage === "lost" ? "Price too high" : null
      });
    }

    // ── Schedule Occurrences ──
    if (serviceRecords.length && roomMain && roomSpin) {
      const nowTime = new Date();
      const occurrencesToInsert = [];
      for (let dayOffset = -7; dayOffset <= 7; dayOffset++) {
        for (let idx = 0; idx < serviceRecords.length; idx++) {
          const svc = serviceRecords[idx]!;
          const room = idx % 2 === 0 ? roomMain : roomSpin;
          const start = new Date(nowTime);
          start.setDate(start.getDate() + dayOffset);
          start.setHours(6 + idx * 2, 0, 0, 0);
          const end = new Date(start);
          end.setMinutes(end.getMinutes() + svc.durationMinutes);
          occurrencesToInsert.push({
            tenantId: tenant.id,
            branchId: branch.id,
            serviceId: svc.id,
            roomId: room.id,
            trainerUserId,
            startsAt: start,
            endsAt: end,
            capacity: room.capacity ?? 20,
            status: "scheduled"
          });
        }
      }
      await tx.insert(scheduleOccurrences).values(occurrencesToInsert);
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
    ],
    seedRichData: true
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
