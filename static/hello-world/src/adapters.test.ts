import { describe,it,expect } from 'vitest';
import { localAdapter, unavailableForgeAdapter } from './adapters';
describe('frontend integration boundary',()=>{
 it('returns deterministic project, snapshot and comparisons',async()=>{const projects=await localAdapter.getProjects();expect((await localAdapter.getProjectSnapshot(projects[0].id)).change).toBe('AUTH-142');expect((await localAdapter.compareScenarios(['A','C'])).map(x=>x.result.violations)).toEqual([3,0]);await expect(localAdapter.getProjectSnapshot('missing')).rejects.toThrow('NOT_FOUND')});
 it('blocks unsupported approval and premature execution',async()=>{await expect(localAdapter.approvePreventionPlan(await localAdapter.generatePreventionPlan('A'))).rejects.toThrow('DEMO_BLOCKED');await expect(localAdapter.executeApprovedPlan(await localAdapter.generatePreventionPlan('C'))).rejects.toThrow('approval')});
 it('exports actual local timeline after execution',async()=>{const plan=await localAdapter.executeApprovedPlan(await localAdapter.approvePreventionPlan(await localAdapter.generatePreventionPlan('C')));const report=await localAdapter.getPreventionPassport(plan);expect(report.approvalTimeline).toHaveLength(2);expect(report.disclosure).toContain('fictional')});
 it('all unconfigured Forge operations fail explicitly',async()=>{await expect(unavailableForgeAdapter.getProjects()).rejects.toThrow('PENDING_BACKEND');await expect(unavailableForgeAdapter.getPreventionPassport(await localAdapter.generatePreventionPlan('C'))).rejects.toThrow('PENDING_BACKEND')});
});
