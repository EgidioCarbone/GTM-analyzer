import { SSDModule } from './types';
import { fibraModule } from './modules/fibra';
import { genertelModule } from './modules/genertel';
import { actalisModule } from './modules/actalis';

const modules: SSDModule[] = [fibraModule, genertelModule, actalisModule];

export const modulesById = new Map(modules.map(mod => [mod.meta.id, mod]));

export function getModule(id: string): SSDModule | undefined {
  return modulesById.get(id as SSDModule['meta']['id']);
}

export function listModules(): SSDModule[] {
  return modules;
}
