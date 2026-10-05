// Progress is derived from the authoritative save; the guide never changes game state.
export function firstSteps(state) {
  const definitions = [
    ['gather', state.stats.gathers, 1],
    ['build', state.stats.builds, 1],
    [
      'reward',
      Number(Boolean(state.quests.find((quest) => quest.id === 'first_build')?.claimed)),
      1,
    ],
    ['train', state.stats.trained, 2],
    ['win', state.stats.wins, 1],
  ];
  const steps = definitions.map(([id, value, target]) => ({
    id,
    progress: Math.min(value, target),
    target,
    complete: value >= target,
  }));
  return {
    steps,
    completed: steps.filter((step) => step.complete).length,
    next: steps.find((step) => !step.complete)?.id || 'explore',
  };
}
