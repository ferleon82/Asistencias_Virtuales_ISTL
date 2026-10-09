import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

vi.mock('../../config/database', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { prisma } from '../../config/database';
import { authenticate, generateAccessToken, invalidateUserStatus } from './jwt';

const token = generateAccessToken({ sub: 'user-1', email: 'jdoe@tecnologicoloja.edu.ec', rol: 'tics' });

async function run(authorization?: string) {
  const req = { headers: { authorization } } as Request;
  const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
  await authenticate(req, {} as Response, next);
  return { req, error: next.mock.calls[0]?.[0] as { statusCode?: number } | undefined };
}

describe('authenticate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateUserStatus('user-1');
  });

  it('rechaza peticiones sin token', async () => {
    const { error } = await run();
    expect(error?.statusCode).toBe(401);
  });

  it('usa el rol vigente de la base y no el del token', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ rol: 'docente', activo: true } as never);

    const { req, error } = await run(`Bearer ${token}`);

    expect(error).toBeUndefined();
    expect(req.user).toEqual({ id: 'user-1', email: 'jdoe@tecnologicoloja.edu.ec', rol: 'docente' });
  });

  it('rechaza un token válido de un usuario desactivado', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ rol: 'tics', activo: false } as never);

    const { req, error } = await run(`Bearer ${token}`);

    expect(error?.statusCode).toBe(401);
    expect(req.user).toBeUndefined();
  });

  it('rechaza un token de un usuario eliminado', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const { error } = await run(`Bearer ${token}`);
    expect(error?.statusCode).toBe(401);
  });

  it('cachea el estado y lo vuelve a consultar al invalidarlo', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ rol: 'tics', activo: true } as never);

    await run(`Bearer ${token}`);
    await run(`Bearer ${token}`);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

    invalidateUserStatus('user-1');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ rol: 'tics', activo: false } as never);
    const { error } = await run(`Bearer ${token}`);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    expect(error?.statusCode).toBe(401);
  });
});
