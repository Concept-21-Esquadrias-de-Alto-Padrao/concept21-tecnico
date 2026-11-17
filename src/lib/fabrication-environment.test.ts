import {it,expect} from 'vitest';
import {fabricationEnvironment as gate} from './fabrication-environment';
const test='https://rnuanogfbhhphnnqxugf.supabase.co',official='https://jothuhbhlnazyobobtnn.supabase.co';
it('permite somente homologacao na base de teste',()=>{expect(gate(test,'preview',undefined)).toBe('test');expect(gate(test,'production','true')).toBeNull();});
it('exige ativacao explicita no oficial',()=>{expect(gate(official,'production',undefined)).toBeNull();expect(gate(official,'production','true')).toBe('official');});
it('impede preview ou local apontando para oficial',()=>{expect(gate(official,'preview','true')).toBeNull();expect(gate(official,undefined,'true')).toBeNull();});
it('rejeita destinos desconhecidos ou invalidos',()=>{expect(gate(undefined,'production','true')).toBeNull();expect(gate('https://example.com','production','true')).toBeNull();});
