import type {AgentView, Office, OfficeSnapshot} from '../../../shared/state/contract';

export type OfficeFilter = 'all' | 'working' | 'awaiting' | 'idle';

/** Office-level rule: working = some agent works without asking, awaiting = some agent needs attention, idle = neither. */
export function officeMatches(office: Office, filter: OfficeFilter): boolean {
  if (filter === 'all') return true;
  const agents: readonly AgentView[] = office.manager ? [office.manager, ...office.members] : office.members;
  const awaiting = agents.some(a => a.needsAttention);
  if (filter === 'awaiting') return awaiting;
  const working = agents.some(a => a.state === 'working' && !a.needsAttention);
  return filter === 'working' ? working : !working && !awaiting;
}

export function countOffices(snapshot: OfficeSnapshot): Record<OfficeFilter, number> {
  const counts: Record<OfficeFilter, number> = {all: 0, working: 0, awaiting: 0, idle: 0};
  for (const project of snapshot.projects) for (const office of project.offices) {
    for (const filter of Object.keys(counts) as OfficeFilter[]) if (officeMatches(office, filter)) counts[filter]++;
  }
  return counts;
}

/** Keeps matching offices in order and drops projects left empty. 'all' returns the snapshot itself. */
export function filterSnapshot(snapshot: OfficeSnapshot, filter: OfficeFilter): OfficeSnapshot {
  if (filter === 'all') return snapshot;
  const projects = snapshot.projects
    .map(project => ({...project, offices: project.offices.filter(office => officeMatches(office, filter))}))
    .filter(project => project.offices.length > 0);
  return {...snapshot, projects};
}
