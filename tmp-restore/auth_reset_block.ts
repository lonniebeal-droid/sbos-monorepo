describe('AuthService.resetPassword — session invalidation', () => {
  function makeResetService() {
    const storedHash = { current: '$2a$10$originalhash' };
    const storedVersion = { current: 1 };
    let resetSeq = 0;
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'u1', email: 'admin@sbos.health' }),
        update: vi.fn().mockImplementation(({ data }) => {
          if (data.passwordHash) storedHash.current = data.passwordHash;
          if (data.passwordVersion && typeof data.passwordVersion === 'object' && 'increment' in data.passwordVersion) {
            storedVersion.current += data.passwordVersion.increment;
          } else if (typeof data.passwordVersion === 'number') {
            storedVersion.current = data.passwordVersion;
          }
          return Promise.resolve({});
        }),
      },
      passwordReset: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: `reset-${++resetSeq}`, ...data })),
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      refreshToken: {
        create: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn().mockImplementation(async (ops: Promise<unknown>[]) => {
        const results = [];
        for (const op of ops) results.push(await op);
        return results;
      }),
    };
    const { service } = makeService({ prisma });
    return { service, prisma, storedHash, storedVersion };
  }

  it('forgot → reset writes NEW hash, increments passwordVersion, revokes refresh tokens', async () => {
    vi.useFakeTimers();
    try {
      const { service, prisma, storedHash, storedVersion } = makeResetService();

      const forgot = await service.forgotPassword('admin@sbos.health');
      const link = forgot.previewLink;
      expect(link).toBeTruthy();
      const resetId = link!.split('resetId=')[1].split('&')[0];
      const token = link!.split('token=')[1];
      const createdReset = await prisma.passwordReset.create.mock.results[0].value;

      prisma.passwordReset.findUnique.mockResolvedValue(createdReset);

      await service.resetPassword({ resetId, token, password: 'NewAdmin1!' });

      const newOk = await bcrypt.compare('NewAdmin1!', storedHash.current);
      expect(newOk).toBe(true);
      const oldOk = await bcrypt.compare('Admin123!', storedHash.current);
      expect(oldOk).toBe(false);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: createdReset.userId },
          data: expect.objectContaining({
            passwordVersion: { increment: 1 },
          }),
        }),
      );
      expect(storedVersion.current).toBe(2);
      expect(prisma.passwordReset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: createdReset.id },
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        }),
      );
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: createdReset.userId },
      });

      prisma.passwordReset.findUnique.mockResolvedValue({
        ...createdReset,
        usedAt: new Date(),
      });
      await expect(
        service.resetPassword({ resetId, token, password: 'Again1!' }),
      ).rejects.toThrow('Reset token already used');
    } finally {
      vi.useRealTimers();
    }
  });

  it('concurrent resets each increment passwordVersion (transaction uses increment)', async () => {
    const { service, prisma, storedVersion } = makeResetService();
    const forgot = await service.forgotPassword('admin@sbos.health');
    const link = forgot.previewLink!;
    const resetId = link.split('resetId=')[1].split('&')[0];
    const token = link.split('token=')[1];
    const createdReset = await prisma.passwordReset.create.mock.results[0].value;
    prisma.passwordReset.findUnique.mockResolvedValue(createdReset);

    await service.resetPassword({ resetId, token, password: 'FirstReset1!' });
    expect(storedVersion.current).toBe(2);

    const forgot2 = await service.forgotPassword('admin@sbos.health');
    const link2 = forgot2.previewLink!;
    const resetId2 = link2.split('resetId=')[1].split('&')[0];
    const token2 = link2.split('token=')[1];
    const createdReset2 = await prisma.passwordReset.create.mock.results[1].value;
    prisma.passwordReset.findUnique.mockResolvedValue(createdReset2);
    await service.resetPassword({
      resetId: resetId2,
      token: token2,
      password: 'SecondReset1!',
    });
    expect(storedVersion.current).toBe(3);
  });
});

describe('AuthService.issueTokens embeds passwordVersion', () => {
  it('signAsync access payload includes passwordVersion from user entity', async () => {
    const { service, usersService, jwtService, prisma } = makeService({
      usersService: {
        validateCredentials: vi.fn().mockResolvedValue({
          ...testUser,
          passwordVersion: 7,
        }),
        getMfaState: vi.fn().mockResolvedValue({ mfaEnabled: false, mfaSecret: null }),
      },
    });

    await service.login({
      email: 'clinician@sbos.health',
      password: 'x',
    } as never);

    expect(jwtService.signAsync).toHaveBeenCalled();
    const accessCall = jwtService.signAsync.mock.calls.find(
      (c: unknown[]) => (c[0] as { type?: string }).type === 'access',
    );
    expect(accessCall).toBeTruthy();
    expect(accessCall![0]).toEqual(
      expect.objectContaining({
        type: 'access',
        passwordVersion: 7,
        sub: 'u1',
      }),
    );
  });
});
