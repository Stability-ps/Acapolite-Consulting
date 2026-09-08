import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { normalizeMetadata } from '../../supabase/functions/_shared/ingestionMetadata';
import { retrieveContent, contentFilter } from '../../supabase/functions/_shared/taxCoachContent';

beforeEach(() => vi.stubGlobal("AbortSignal", {timeout: () => new AbortController().signal}));
afterEach(() => vi.unstubAllGlobals());
describe('document ingestion boundaries', () => {
  it('keeps unknown and impossible dates blank and strips approval and client fields', () => {
    expect(normalizeMetadata('tax_knowledge', {publication_date:'2025-02-30', effective_from:'2025', title:'Guide', approved_for_ai_use:true, client_id:'x'})).toMatchObject({title:'Guide', publication_date:'',effective_from:'',effective_to:''});
    expect(normalizeMetadata('tax_knowledge', {approved_for_ai_use:true})).not.toHaveProperty('approved_for_ai_use');
    expect(normalizeMetadata('past_case', {closed_date:'2024-02-29'}).closed_date).toBe('2024-02-29');
  });
  it('restricts search to source identity and the current checksum', () => {
    expect(contentFilter('tax_knowledge_library', [{id:'one',openai_file_id:'file-one',checksum_sha256:'hash'}])).toEqual({type:'and',filters:[{type:'eq',key:'source_table',value:'tax_knowledge_library'},{type:'or',filters:[{type:'and',filters:[{type:'eq',key:'source_id',value:'one'},{type:'eq',key:'checksum',value:'hash'}]}]}]});
  });
  it('does not query any data or OpenAI when all sources are off in general scope', async () => {
    const from = vi.fn(); const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect(await retrieveContent({from} as never,'secret','query','general',false,false,'client','case')).toEqual([]);
    expect(from).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('never looks up active case data in general scope and rejects unexpected file results', async () => {
    const calls: string[] = []; const filters: unknown[] = [];
    const row = {id:'one',openai_file_id:'file-one',checksum_sha256:'hash',title:'Guide',category:'SARS Guide',status:'current'};
    const client = {from(table: string) {
      calls.push(table);
      const chain = {select:()=>chain,eq:(...args:unknown[])=>{filters.push(args); return chain;},neq:(...args:unknown[])=>{filters.push(args);return chain;},not:()=>chain,limit:async()=>({data:[row],error:null}),maybeSingle:async()=>({data:{openai_vector_store_id:'vs-knowledge'},error:null})}; return chain;
    }};
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({data:[{file_id:'file-foreign',attributes:{source_id:'one',checksum:'hash'},content:[{type:'text',text:'SECRET'}]},{file_id:'file-one',attributes:{source_id:'one',checksum:'old'},content:[{type:'text',text:'STALE'}]},{file_id:'file-one',attributes:{source_id:'one',checksum:'hash'},content:[{type:'text',text:'Actual approved guide excerpt'}]}]}))));
    const result = await retrieveContent(client as never,'secret','query','general',true,false,'client','case');
    expect(calls).toEqual(['ai_vector_stores','tax_knowledge_library']);
    expect(filters).toContainEqual(['approved_for_ai_use',true]);
    expect(filters).toContainEqual(['ai_index_status','indexed']);
    expect(result).toHaveLength(1); expect(result[0].block).toContain('Actual approved guide excerpt'); expect(result[0].classification).toBe('SARS GUIDANCE');
  });
});
