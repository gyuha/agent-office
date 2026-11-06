Agent Office shows the agents in a workspace as people in a small pixel-art office. It adds an "Agent Office" panel to each workspace, showing the offices of that workspace's project, and an "Agent Office" item in the sidebar that shows every project, one section per project.

An agent that is running a turn sits at its desk. When the turn ends it steps away or takes a phone call, and after ten minutes without activity it falls asleep. An agent waiting for a permission decision keeps working but is flagged so you can spot it.

Offices are grouped by project first. Agents started by another agent (for example a team run by an orchestrator) share one office, even across workspaces of the same project, with the starting agent as manager. An agent with no team gets an office of its own. Closed and archived agents leave the office.

The plugin reads agent lifecycle events and the agent list from the local daemon and keeps the state in memory. Nothing is sent anywhere else and nothing is written to disk. The panel refreshes about every two seconds, and the office starts empty again when the daemon restarts, apart from the agents the daemon already lists.

## Known limits

Agents that already exist when the daemon starts are grouped using the `paseo.parent-agent-id` label that the daemon stores on team agents. This label is an undocumented internal convention and may change between Paseo versions. Agents created afterwards are grouped using the official parent field.
