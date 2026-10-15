import { adventureQuote, DIFFICULTIES, REGIONS } from '../shared/adventures.mjs';

// Read-only explanation of the existing server rules, never an authorization or a mutation.
export function adventureReadiness(state, selection) {
  const quote = adventureQuote(state, selection);
  const index = REGIONS.findIndex((region) => region.id === selection.region);
  const escort = selection.kind === 'caravan';
  const discovered = state.adventure.unlocked.includes(selection.region);
  const previous = REGIONS[index - 1];
  const routeOpen = escort
    ? discovered && selection.region !== state.location
    : Boolean(previous && state.adventure.unlocked.includes(previous.id));
  const selected = state.wolves.filter((wolf) => selection.wolfIds.includes(wolf.id));
  const validParty =
    selected.length === selection.wolfIds.length &&
    new Set(selection.wolfIds).size === selection.wolfIds.length &&
    selected.every((wolf) => wolf.hp >= 20);
  const shortages = Object.entries(quote.cost)
    .filter(([resource, amount]) => state.resources[resource] < amount)
    .map(([resource, amount]) => ({
      resource,
      amount: Math.ceil(amount - state.resources[resource]),
    }));
  // Storage is an estimate at the current balance; production/gifts can change it before arrival.
  const overflow = Object.entries(quote.reward)
    .filter(([resource, amount]) => state.resources[resource] + amount > state.capacity)
    .map(([resource, amount]) => ({
      resource,
      amount: Math.ceil(state.resources[resource] + amount - state.capacity),
    }));
  const check = (id, ok, key, values = {}) => ({ id, ok, key, values });
  const checks = [
    check('battle', state.battle.status !== 'active', 'battleReadyCheck'),
    check('journey', !state.adventure.active && !state.journey, 'journeyReadyCheck'),
    check(
      'route',
      routeOpen,
      routeOpen
        ? 'routeReadyCheck'
        : escort
          ? discovered
            ? 'routeElsewhereCheck'
            : 'routeDiscoverCheck'
          : 'routeLockedCheck',
      { region: escort ? selection.region : previous?.id || 'spring' },
    ),
    check('party', selected.length >= quote.minimumWolves, 'partyReadyCheck', {
      count: selected.length,
      required: quote.minimumWolves,
    }),
    check('wolves', validParty, 'wolvesReadyCheck'),
    ...(escort ? [check('herd', state.herd.hp >= 60, 'herdReadyCheck')] : []),
    check('supplies', shortages.length === 0, 'suppliesReadyCheck'),
  ];
  return {
    quote,
    ready: checks.every((entry) => entry.ok),
    checks,
    shortages,
    overflow,
    itemFull: state.inventory[quote.item] >= 10000,
    fatigue: (DIFFICULTIES.indexOf(selection.difficulty) + 1) * 5,
  };
}
