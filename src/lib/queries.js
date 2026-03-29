/**
 * queries.js — All database operations for the PMS.
 * Thin wrapper around Prisma — keeps API routes clean.
 */
import { prisma } from './db';
import { generatePairId } from './pairId';

// ── Role Templates ─────────────────────────────────────────────────────────

export async function getAllRoles() {
  return prisma.roleTemplate.findMany({ orderBy: { roleKey: 'asc' } });
}

export async function getRole(roleKey) {
  return prisma.roleTemplate.findUnique({ where: { roleKey } });
}

export async function upsertRole(roleKey, roleLabel, questions, opts = {}) {
  const { filename, profileCols, rmNameCol, rmEmailCol, bhNameCol, bhEmailCol } = opts;
  const data = {
    roleLabel, questions,
    ...(filename    !== undefined && { filename }),
    ...(profileCols !== undefined && { profileCols }),
    ...(rmNameCol   !== undefined && { rmNameCol }),
    ...(rmEmailCol  !== undefined && { rmEmailCol }),
    ...(bhNameCol   !== undefined && { bhNameCol }),
    ...(bhEmailCol  !== undefined && { bhEmailCol }),
  };
  return prisma.roleTemplate.upsert({
    where:  { roleKey },
    update: data,
    create: { roleKey, ...data },
  });
}

export async function deleteRole(roleKey) {
  return prisma.roleTemplate.delete({ where: { roleKey } });
}

// ── Employees ──────────────────────────────────────────────────────────────

export async function getEmployeesByRole(roleKey) {
  return prisma.employee.findMany({
    where:   { roleKey, isActive: true },
    orderBy: { empCode: 'asc' },
  });
}

export async function upsertEmployee(empCode, empName, roleKey, profileData = {}) {
  return prisma.employee.upsert({
    where:  { empCode_roleKey: { empCode, roleKey } },
    update: { empName, profileData },
    create: { empCode, empName, roleKey, profileData },
  });
}

export async function bulkUpsertEmployees(rows) {
  // rows: [{ empCode, empName, roleKey, profileData }]
  return prisma.$transaction(rows.map((r) =>
    prisma.employee.upsert({
      where:  { empCode_roleKey: { empCode: r.empCode, roleKey: r.roleKey } },
      update: { empName: r.empName, profileData: r.profileData },
      create: r,
    })
  ));
}

// ── Assessment Pairs ───────────────────────────────────────────────────────

export async function getPairsByRoleAndCycle(roleKey, cycle) {
  return prisma.assessmentPair.findMany({
    where:   { roleKey, cycle },
    orderBy: { empCode: 'asc' },
    include: { employee: { select: { profileData: true } } },
  });
}

export async function getPairById(pairId) {
  return prisma.assessmentPair.findUnique({ where: { pairId } });
}

export async function getPairByRmToken(rmToken) {
  return prisma.assessmentPair.findUnique({
    where:   { rmToken },
    include: { role: true },
  });
}

export async function getPairByBhToken(bhToken) {
  return prisma.assessmentPair.findUnique({
    where:   { bhToken },
    include: { role: true },
  });
}

export async function createPair({ empCode, empName, roleKey, cycle, rmName, rmEmail, bhName, bhEmail, selectedBy }) {
  // Build pairId: count existing pairs for this employee+role+cycle
  const existing = await prisma.assessmentPair.count({ where: { empCode, roleKey, cycle } });
  const seq = String(existing + 1).padStart(4, '0');
  const pairId = generatePairId(empCode, roleKey, cycle, seq);

  return prisma.assessmentPair.create({
    data: {
      pairId, empCode, empName, roleKey, cycle,
      rmName, rmEmail, bhName, bhEmail,
      status: 'PENDING_RM',
      selectedBy, selectedOn: new Date(),
      lastUpdatedBy: selectedBy, lastUpdatedOn: new Date(),
    },
  });
}

export async function submitRmAnswers(pairId, answers, performedBy) {
  return prisma.assessmentPair.update({
    where: { pairId },
    data: {
      rmAnswers:    answers,
      status:       'RM_SUBMITTED',
      rmSubmittedOn: new Date(),
      lastUpdatedBy: performedBy,
      lastUpdatedOn: new Date(),
    },
  });
}

export async function submitBhAnswers(pairId, answers, performedBy) {
  return prisma.assessmentPair.update({
    where: { pairId },
    data: {
      bhAnswers:    answers,
      status:       'FINALIZED',
      lockStatus:   'LOCKED',
      bhSubmittedOn: new Date(),
      lastUpdatedBy: performedBy,
      lastUpdatedOn: new Date(),
    },
  });
}

export async function deletePair(pairId) {
  // Delete audit logs first (FK constraint), then the pair
  await prisma.auditLog.deleteMany({ where: { pairId } });
  return prisma.assessmentPair.delete({ where: { pairId } });
}

export async function unlockPair(pairId, performedBy) {
  return prisma.assessmentPair.update({
    where: { pairId },
    data: {
      lockStatus:   'UNLOCKED',
      lastUpdatedBy: performedBy,
      lastUpdatedOn: new Date(),
    },
  });
}

// ── Dashboard stats ────────────────────────────────────────────────────────

export async function getDashboardStats(roleKey, cycle) {
  const where = { roleKey, cycle };
  const [total, pendingRm, rmSubmitted, pendingBh, finalized] = await Promise.all([
    prisma.assessmentPair.count({ where }),
    prisma.assessmentPair.count({ where: { ...where, status: 'PENDING_RM'   } }),
    prisma.assessmentPair.count({ where: { ...where, status: 'RM_SUBMITTED' } }),
    prisma.assessmentPair.count({ where: { ...where, status: 'PENDING_BH'   } }),
    prisma.assessmentPair.count({ where: { ...where, status: 'FINALIZED'    } }),
  ]);
  return { total, pendingRm, rmSubmitted, pendingBh, finalized };
}

export async function getRecentActivity(limit = 20) {
  return prisma.auditLog.findMany({
    orderBy: { timestamp: 'desc' },
    take:    limit,
  });
}

// ── Audit Log ──────────────────────────────────────────────────────────────

export async function appendAudit({ action, pairId, empCode, empName, roleKey, cycle, performedBy, details }) {
  return prisma.auditLog.create({
    data: { action, pairId, empCode, empName, roleKey, cycle, performedBy, details },
  });
}

export async function getAuditLog({ roleKey, cycle, limit = 100 } = {}) {
  return prisma.auditLog.findMany({
    where:   { ...(roleKey ? { roleKey } : {}), ...(cycle ? { cycle } : {}) },
    orderBy: { timestamp: 'desc' },
    take:    limit,
  });
}

// ── HR Users ───────────────────────────────────────────────────────────────

export async function getHrUserByEmail(email) {
  return prisma.hrUser.findUnique({ where: { email } });
}

export async function getAllHrUsers() {
  return prisma.hrUser.findMany({ orderBy: { createdAt: 'asc' } });
}

export async function createHrUser(email, name, role, hashedPassword) {
  return prisma.hrUser.create({ data: { email, name, role, password: hashedPassword } });
}

// ── Cycles list ────────────────────────────────────────────────────────────

export async function getCyclesByRole(roleKey) {
  const rows = await prisma.assessmentPair.findMany({
    where:  { roleKey },
    select: { cycle: true },
    distinct: ['cycle'],
    orderBy:  { cycle: 'desc' },
  });
  return rows.map((r) => r.cycle);
}
