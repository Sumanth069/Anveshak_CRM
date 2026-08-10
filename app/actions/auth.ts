'use server';

import { prisma } from '@/lib/prisma';

export async function seedAdminAccountAction() {
  try {
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@anveshak.com' }
    });

    if (!existingAdmin) {
      const admin = await prisma.user.create({
        data: {
          fullName: 'KP Sumanth',
          email: 'admin@anveshak.com',
          password: '12345678',
          role: 'ADMIN',
          isActive: true,
          assignedCount: 0
        }
      });
      return { success: true, user: admin };
    }

    return { success: true, user: existingAdmin };
  } catch (err: any) {
    console.error('seedAdminAccountAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function loginAction(email: string, password: string) {
  try {
    // Ensure default admin exists first
    await seedAdminAccountAction();

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }
    });

    if (!user) {
      return { success: false, error: 'User account not found with this email address.' };
    }

    if (!user.isActive) {
      return { success: false, error: 'Your account has been deactivated by an Admin.' };
    }

    if (user.password !== password) {
      return { success: false, error: 'Invalid password. Please check your credentials.' };
    }

    return {
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role || 'SALES_REP',
        isActive: user.isActive || true,
        assignedCount: user.assignedCount || 0
      }
    };
  } catch (err: any) {
    console.error('loginAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function getUsersListAction() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return { success: true, users };
  } catch (err: any) {
    console.error('getUsersListAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function createUserAction(userData: {
  fullName: string;
  email: string;
  password?: string;
  role: string;
}) {
  try {
    const created = await prisma.user.create({
      data: {
        fullName: userData.fullName.trim(),
        email: userData.email.trim().toLowerCase(),
        password: userData.password || '12345678',
        role: userData.role || 'SALES_REP',
        isActive: true,
        assignedCount: 0
      }
    });
    return { success: true, user: created };
  } catch (err: any) {
    console.error('createUserAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function deleteUserAction(id: string) {
  try {
    await prisma.user.delete({
      where: { id }
    });
    return { success: true };
  } catch (err: any) {
    console.error('deleteUserAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function updateUserAction(id: string, updates: any) {
  try {
    const updated = await prisma.user.update({
      where: { id },
      data: updates
    });
    return { success: true, user: updated };
  } catch (err: any) {
    console.error('updateUserAction error:', err);
    return { success: false, error: err.message };
  }
}
