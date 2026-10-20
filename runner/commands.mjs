// One row per command: the standard it works to, the deliverable name, the desks it staffs and the default sizes.
// Adding a command is a row here plus its standard file under skills/desk/standards/.
export const COMMANDS = {
  design: {
    deliverable: 'social-card',
    standard: 'social-card',
    sizes: ['linkedin', 'ig-post'],
    desks: ['ui-designer', 'art-director', 'creative-director'],
    builder: 'ui-designer',
    visual: true,
    about: 'one still image for a feed, from a brief and the brand',
  },
};

export function getCommand(name) {
  const c = COMMANDS[name];
  if (!c) throw new Error(`Unknown command "${name}". Commands: ${Object.keys(COMMANDS).join(', ')}.`);
  return { name, ...c };
}
