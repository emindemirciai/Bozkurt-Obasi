/** Server-timed expeditions and escorts; all rewards are saved in the same transition. */
export const ITEM_DEFINITIONS = Object.freeze(
  [
    { id: 'leather_vest', attack: 0, defense: 3, scouting: 0, healing: 0 },
    { id: 'iron_guard', attack: 2, defense: 6, scouting: 0, healing: 0 },
    { id: 'scout_charm', attack: 1, defense: 0, scouting: 15, healing: 0 },
    { id: 'healer_satchel', attack: 0, defense: 1, scouting: 0, healing: 3 },
  ].map(Object.freeze),
);
export const REGIONS = Object.freeze(
  [
    { id: 'homeland', rank: 0, duration: 45, item: 'leather_vest' },
    { id: 'spring', rank: 1, duration: 60, item: 'leather_vest' },
    { id: 'meadow', rank: 2, duration: 90, item: 'scout_charm' },
    { id: 'highland', rank: 3, duration: 120, item: 'iron_guard' },
    { id: 'ruins', rank: 4, duration: 150, item: 'healer_satchel' },
  ].map(Object.freeze),
);
export const DIFFICULTIES = Object.freeze(['easy', 'normal', 'hard']);
export const ADVENTURE_PLANS = Object.freeze(['standard', 'survey', 'supply']);
const resources = ['water', 'feed', 'herbs', 'wood', 'stone'];
const fail = (code) => {
  const error = new Error(code);
  error.code = code;
  throw error;
};
const exact = (x, keys) =>
  x &&
  typeof x === 'object' &&
  !Array.isArray(x) &&
  Object.keys(x).length === keys.length &&
  keys.every((k) => Object.hasOwn(x, k));
const int = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
export function initializeAdventureState(state) {
  const data = {
    adventure: { sequence: 0, active: null, unlocked: ['homeland'], history: [] },
    inventory: Object.fromEntries(ITEM_DEFINITIONS.map((item) => [item.id, 0])),
  };
  if (state) {
    Object.assign(state, data);
    for (const wolf of state.wolves) wolf.equipment = null;
    return state;
  }
  return data;
}
export function migrateAdventureState(state) {
  initializeAdventureState(state);
  for (const id of [state.location, state.journey?.destination])
    if (REGIONS.some((r) => r.id === id)) {
      for (const region of REGIONS.slice(0, REGIONS.findIndex((r) => r.id === id) + 1))
        if (!state.adventure.unlocked.includes(region.id)) state.adventure.unlocked.push(region.id);
    }
  return state;
}
export function isWolfBusy(state, id) {
  return Boolean(state.adventure?.active?.wolfIds.includes(id));
}
export function equipmentBonuses(wolf) {
  return (
    ITEM_DEFINITIONS.find((item) => item.id === wolf.equipment) || {
      attack: 0,
      defense: 0,
      scouting: 0,
      healing: 0,
    }
  );
}
export function grantWolfXp(wolf, amount) {
  wolf.xp += amount;
  while (wolf.level < 20 && wolf.xp >= wolf.level * 45) {
    wolf.xp -= wolf.level * 45;
    wolf.level++;
    wolf.points++;
    wolf.maxHp += 6;
    wolf.hp = Math.min(wolf.maxHp, wolf.hp + 18);
  }
  if (wolf.level === 20) wolf.xp = Math.min(wolf.xp, 899);
}
export function adventureQuote(state, selection) {
  const { kind = 'expedition', region = 'spring', difficulty = 'easy', wolfIds = [] } = selection;
  // Missing plan is the pre-v2.6 contract; malformed explicit values must never become standard.
  const plan = Object.hasOwn(selection, 'plan') ? selection.plan : 'standard';
  if (!ADVENTURE_PLANS.includes(plan)) fail('INVALID_EXPEDITION');
  const route = REGIONS.find((r) => r.id === region),
    tier = DIFFICULTIES.indexOf(difficulty) + 1;
  if (!route || !tier || !['expedition', 'caravan'].includes(kind)) fail('INVALID_EXPEDITION');
  const scouts = state.wolves
    .filter((w) => wolfIds.includes(w.id))
    .reduce((n, w) => n + equipmentBonuses(w).scouting, 0);
  const factor = Math.max(0.7, 1 - scouts / 100);
  const suppliesFactor = plan === 'standard' ? 1 : 1.25;
  const rewardFactor = plan === 'survey' ? 0.75 : plan === 'supply' ? 1.5 : 1;
  const xpFactor = plan === 'survey' ? 1.5 : plan === 'supply' ? 0.75 : 1;
  return {
    plan,
    cost: {
      water: Math.ceil((10 + tier * 5 + route.rank * 3) * suppliesFactor),
      feed: Math.ceil((12 + tier * 7 + route.rank * 4) * suppliesFactor),
    },
    seconds: Math.ceil(route.duration * tier * factor * suppliesFactor),
    minimumWolves: tier,
    xp: Math.floor((20 + route.rank * 10) * tier * xpFactor),
    reward: {
      wood: Math.floor((20 + route.rank * 12) * tier * rewardFactor),
      stone: Math.floor((12 + route.rank * 9) * tier * rewardFactor),
      herbs: Math.floor((5 + route.rank * 2) * tier * rewardFactor),
    },
    fatigue: tier * (plan === 'survey' ? 7 : plan === 'supply' ? 8 : 5),
    item: route.item,
  };
}
function start(state, action, now, kind) {
  if (state.adventure.active || state.journey) fail('JOURNEY_ACTIVE');
  if (state.battle.status === 'active') fail('BATTLE_ACTIVE');
  if (
    !REGIONS.some((region) => region.id === action.region) ||
    !DIFFICULTIES.includes(action.difficulty)
  )
    fail('INVALID_EXPEDITION');
  const ids = action.wolfIds;
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 5 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !state.wolves.some((w) => w.id === id && w.hp >= 20))
  )
    fail('INVALID_PARTY');
  const quote = adventureQuote(state, { ...action, kind });
  if (ids.length < quote.minimumWolves) fail('PARTY_TOO_SMALL');
  const index = REGIONS.findIndex((r) => r.id === action.region);
  if (
    kind === 'expedition' &&
    (index === 0 || !state.adventure.unlocked.includes(REGIONS[index - 1].id))
  )
    fail('REGION_LOCKED');
  if (kind === 'caravan' && !state.adventure.unlocked.includes(action.region))
    fail('REGION_LOCKED');
  if (kind === 'caravan' && action.region === state.location) fail('ALREADY_THERE');
  if (kind === 'caravan' && state.herd.hp < 60) fail('PACK_EXHAUSTED');
  if (
    !int(now, state.updatedAt, 8_640_000_000_000_000) ||
    !Number.isSafeInteger(now + quote.seconds * 1000) ||
    now + quote.seconds * 1000 > 8_640_000_000_000_000 ||
    state.adventure.sequence >= 1_000_000
  )
    fail('INVALID_CLOCK');
  if (Object.entries(quote.cost).some(([key, value]) => state.resources[key] < value))
    fail('INSUFFICIENT_RESOURCES');
  for (const [key, value] of Object.entries(quote.cost)) state.resources[key] -= value;
  state.adventure.sequence++;
  state.adventure.active = {
    id: `outing-${state.adventure.sequence}`,
    kind,
    region: action.region,
    difficulty: action.difficulty,
    plan: quote.plan,
    wolfIds: [...ids],
    startedAt: now,
    endsAt: now + quote.seconds * 1000,
  };
  return state;
}
export const startExpedition = (state, action, now) => start(state, action, now, 'expedition');
export const startCaravan = (state, action, now) => start(state, action, now, 'caravan');
export function advanceAdventure(state, now) {
  const active = state.adventure.active;
  if (!active || now < active.endsAt) return state;
  const quote = adventureQuote(state, active);
  const awarded = {};
  for (const key of resources) {
    const amount = Math.min(state.capacity - state.resources[key], quote.reward[key] || 0);
    state.resources[key] += amount;
    awarded[key] = amount;
  }
  const itemCount = state.inventory[quote.item] < 10000 ? 1 : 0;
  state.inventory[quote.item] += itemCount;
  for (const id of active.wolfIds) {
    const wolf = state.wolves.find((w) => w.id === id);
    wolf.hp = Math.max(1, wolf.hp - quote.fatigue);
    grantWolfXp(wolf, quote.xp);
  }
  if (!state.adventure.unlocked.includes(active.region))
    state.adventure.unlocked.push(active.region);
  if (active.kind === 'caravan') state.location = active.region;
  state.adventure.history.unshift({
    ...active,
    completedAt: active.endsAt,
    reward: awarded,
    item: quote.item,
    itemCount,
    xp: quote.xp,
  });
  state.adventure.history = state.adventure.history.slice(0, 20);
  state.adventure.active = null;
  return state;
}
export function equipWolf(state, { id, item }) {
  const wolf = state.wolves.find((w) => w.id === id);
  if (!wolf || !ITEM_DEFINITIONS.some((i) => i.id === item)) fail('INVALID_EQUIPMENT');
  if (state.battle.status === 'active' || isWolfBusy(state, id)) fail('WOLF_BUSY');
  if (wolf.equipment === item) return state;
  if (state.inventory[item] < 1) fail('ITEM_UNAVAILABLE');
  if (wolf.equipment && state.inventory[wolf.equipment] >= 10000) fail('INVENTORY_FULL');
  state.inventory[item]--;
  if (wolf.equipment) state.inventory[wolf.equipment]++;
  wolf.equipment = item;
  return state;
}
export function unequipWolf(state, { id }) {
  const wolf = state.wolves.find((w) => w.id === id);
  if (!wolf) fail('INVALID_EQUIPMENT');
  if (state.battle.status === 'active' || isWolfBusy(state, id)) fail('WOLF_BUSY');
  if (!wolf.equipment) return state;
  if (state.inventory[wolf.equipment] >= 10000) fail('INVENTORY_FULL');
  state.inventory[wolf.equipment]++;
  wolf.equipment = null;
  return state;
}
export function validateAdventureState(state) {
  const a = state.adventure,
    itemIds = ITEM_DEFINITIONS.map((i) => i.id);
  if (
    !exact(a, ['sequence', 'active', 'unlocked', 'history']) ||
    !int(a.sequence, 0, 1_000_000) ||
    !exact(state.inventory, itemIds) ||
    !itemIds.every((id) => int(state.inventory[id], 0, 10000))
  )
    return false;
  if (
    !Array.isArray(a.unlocked) ||
    !a.unlocked.length ||
    a.unlocked.length > REGIONS.length ||
    a.unlocked.some((id, index) => id !== REGIONS[index].id)
  )
    return false;
  if (state.wolves.some((w) => w.equipment !== null && !itemIds.includes(w.equipment)))
    return false;
  const fields = ['id', 'kind', 'region', 'difficulty', 'wolfIds', 'startedAt', 'endsAt'];
  function outingFields(o, extra = []) {
    const hasPlan = o && Object.hasOwn(o, 'plan');
    return (
      exact(o, [...fields, ...(hasPlan ? ['plan'] : []), ...extra]) &&
      (!hasPlan || ADVENTURE_PLANS.includes(o.plan))
    );
  }
  function outing(o) {
    return (
      ['expedition', 'caravan'].includes(o.kind) &&
      REGIONS.some((r) => r.id === o.region) &&
      DIFFICULTIES.includes(o.difficulty) &&
      /^outing-[1-9]\d{0,6}$/.test(o.id) &&
      Number(o.id.slice(7)) <= a.sequence &&
      int(o.startedAt, 0, state.updatedAt) &&
      int(o.endsAt, o.startedAt + 1, 8_640_000_000_000_000) &&
      o.endsAt - o.startedAt <= (o.plan && o.plan !== 'standard' ? 563000 : 450000) &&
      Array.isArray(o.wolfIds) &&
      o.wolfIds.length >= DIFFICULTIES.indexOf(o.difficulty) + 1 &&
      o.wolfIds.length <= 5 &&
      new Set(o.wolfIds).size === o.wolfIds.length &&
      o.wolfIds.every((id) => state.wolves.some((w) => w.id === id))
    );
  }
  if (a.active !== null) {
    if (
      !outingFields(a.active) ||
      !outing(a.active) ||
      a.active.id !== `outing-${a.sequence}` ||
      a.active.endsAt <= state.updatedAt ||
      state.journey !== null ||
      state.battle.status === 'active'
    )
      return false;
    const regionIndex = REGIONS.findIndex((r) => r.id === a.active.region);
    if (
      a.active.kind === 'expedition' &&
      (regionIndex === 0 || !a.unlocked.includes(REGIONS[regionIndex - 1].id))
    )
      return false;
    if (
      a.active.kind === 'caravan' &&
      (!a.unlocked.includes(a.active.region) || a.active.region === state.location)
    )
      return false;
    if (a.active.endsAt - a.active.startedAt !== adventureQuote(state, a.active).seconds * 1000)
      return false;
  }
  if (
    !Array.isArray(a.history) ||
    a.history.length > 20 ||
    new Set(a.history.map((r) => r.id)).size !== a.history.length
  )
    return false;
  for (const [index, r] of a.history.entries()) {
    if (
      !outingFields(r, ['completedAt', 'reward', 'item', 'itemCount', 'xp']) ||
      !outing(r) ||
      r.completedAt !== r.endsAt ||
      r.completedAt > state.updatedAt ||
      r.id === a.active?.id ||
      !exact(r.reward, resources) ||
      !int(r.itemCount, 0, 1)
    )
      return false;
    const quote = adventureQuote(state, r);
    if (
      r.item !== quote.item ||
      r.xp !== quote.xp ||
      !resources.every(
        (k) =>
          Number.isFinite(r.reward[k]) &&
          r.reward[k] >= 0 &&
          r.reward[k] <= Math.min(state.capacity, quote.reward[k] || 0),
      )
    )
      return false;
    if (
      index > 0 &&
      (Number(r.id.slice(7)) >= Number(a.history[index - 1].id.slice(7)) ||
        r.completedAt > a.history[index - 1].startedAt)
    )
      return false;
  }
  return true;
}
