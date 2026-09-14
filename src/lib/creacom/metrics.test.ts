import { expect, it, vi } from 'vitest';
import { loadCommercialMetrics } from './metrics';
import type { SupabaseClient } from '@supabase/supabase-js';
it('loads official aggregates without a client row limit or date range', async () => {
  const data={pipeline_count:1,stages:{},open_count:0,open_m3:0,won_m3:0,currencies:[]};
  const rpc=vi.fn().mockResolvedValue({data,error:null});
  expect(await loadCommercialMetrics({rpc} as unknown as SupabaseClient)).toEqual(data);
  expect(rpc).toHaveBeenCalledWith('creacom_metrics',{p_pipeline_id:null});
});
it('scopes a board summary to its pipeline', async () => {
  const rpc=vi.fn().mockResolvedValue({data:{},error:null});
  await loadCommercialMetrics({rpc} as unknown as SupabaseClient,'demo');
  expect(rpc).toHaveBeenCalledWith('creacom_metrics',{p_pipeline_id:'demo'});
});
it('does not invent zero figures on query failure', async () => {
  const rpc=vi.fn().mockResolvedValue({data:null,error:{message:'no access'}});
  await expect(loadCommercialMetrics({rpc} as unknown as SupabaseClient)).rejects.toThrow(/métricas/);
});
