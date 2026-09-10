import { afterEach, describe, expect, it, vi } from 'vitest';
import { MedicalConnectorsService } from './medical-connectors.service';

describe('MedicalConnectorsService NPPES boundary', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects a bad NPI checksum before any network request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const service = new MedicalConnectorsService({} as any, {} as any);
    await expect(service.validateProviderNpi('1467859901')).resolves.toMatchObject({ ok:false, checksumValid:false, registryVerified:false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('verifies a public NPPES record without claiming licensure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result_count:1, results:[{ number:1467859900, enumeration_type:'NPI-2', basic:{status:'A'}, taxonomies:[{code:'261Q00000X',desc:'Clinic/Center',primary:true}] }] }),
    }));
    const service = new MedicalConnectorsService({} as any, {} as any);
    const result = await service.validateProviderNpi('1467859900');
    expect(result).toMatchObject({ ok:true, checksumValid:true, registryVerified:true, active:true, enumerationType:'NPI-2' });
    expect(result.message).toMatch(/does not establish licensure/i);
  });
});
