import { describe, it, expect } from 'vitest';
import { transition, initialWorkflow, demoAdapter, forgeAdapter, passport, scenarios } from './domain';
describe('demo decision workflow',()=>{
 it('blocks execution before approval',()=>expect(()=>transition(initialWorkflow(),'execute')).toThrow());
 it('records approval before simulated execution and exports demo disclosure',()=>{const state=transition(transition(initialWorkflow(),'approve','2026-11-02T10:00:00Z'),'execute','2026-11-02T10:01:00Z');expect(state.timeline).toHaveLength(2);expect(passport('C',state).disclosure).toContain('fictional');expect(passport('C',state).execution).toBe('Simulated complete')});
 it('does not remove unknown blockers from the safest fixture',()=>{expect(scenarios.C.violations).toBe(0);expect(scenarios.C.blockers).toContain('Support usage unknown')});
 it('rejects unsupported scenario parameters',async()=>{await expect(demoAdapter.simulateChange('D' as any)).rejects.toThrow()});
 it('does not silently substitute fixtures for Forge',async()=>{await expect(forgeAdapter.getEvidenceGraph()).rejects.toThrow('PENDING_BACKEND')});
});
