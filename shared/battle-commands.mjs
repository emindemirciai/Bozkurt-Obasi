/** Active battle orders are authoritative, tick-based and independent of render cadence. */
export const BATTLE_COMMANDS = Object.freeze(
  [
    {
      id: 'brace',
      durationTicks: 6,
      cooldownTicks: 12,
      attack: 0.8,
      wolfDamage: 0.65,
      herdDamage: 0.65,
      panicReduction: 0,
    },
    {
      id: 'focus',
      durationTicks: 6,
      cooldownTicks: 12,
      attack: 1.35,
      wolfDamage: 1.2,
      herdDamage: 1,
      panicReduction: 0,
    },
    {
      id: 'rally',
      durationTicks: 0,
      cooldownTicks: 12,
      attack: 1,
      wolfDamage: 1,
      herdDamage: 1,
      panicReduction: 20,
    },
  ].map((definition) => Object.freeze(definition)),
);
const INTRO_TICKS = 6;
const MAX_COMMANDS = 8;
const definitionFor = (id) => BATTLE_COMMANDS.find((definition) => definition.id === id);
const exactKeys = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const fail = (code) => {
  const error = new Error(code);
  error.code = code;
  throw error;
};

/** Snapshot for controls: only the server's completed battle tick determines readiness. */
export function battleCommandStatus(state) {
  const battle = state.battle;
  const last = battle.commands.at(-1) ?? null;
  const definition = last ? definitionFor(last.id) : null;
  const active = battle.status === 'active';
  const elapsed = last ? battle.tick - last.tick : 0;
  const activeTicksLeft =
    active && definition ? Math.max(0, definition.durationTicks - elapsed) : 0;
  return {
    activeCommand: activeTicksLeft > 0 ? last.id : null,
    activeTicksLeft,
    cooldownTicksLeft: active && definition ? Math.max(0, definition.cooldownTicks - elapsed) : 0,
    lastCommand: last ? { ...last } : null,
  };
}

/** Reading a plan neither advances time nor issues an order. */
export function battleCommandPlan(state, id) {
  const status = battleCommandStatus(state);
  const blocked = !definitionFor(id)
    ? 'invalid'
    : state.battle.status !== 'active'
      ? 'inactive'
      : state.battle.tick < INTRO_TICKS
        ? 'intro'
        : status.cooldownTicksLeft > 0
          ? 'cooldown'
          : id === 'rally' && state.herd.panic <= 0
            ? 'noPanic'
            : null;
  const reasons = {
    invalid: 'INVALID_BATTLE_COMMAND',
    inactive: 'BATTLE_NOT_ACTIVE',
    intro: 'BATTLE_COMMAND_INTRO',
    cooldown: 'BATTLE_COMMAND_COOLDOWN',
    noPanic: 'BATTLE_COMMAND_NO_PANIC',
  };
  return {
    id,
    ready: blocked === null,
    blocked,
    reason: blocked ? reasons[blocked] : null,
    remainingTicks:
      blocked === 'intro'
        ? INTRO_TICKS - state.battle.tick
        : blocked === 'cooldown'
          ? status.cooldownTicksLeft
          : 0,
    active: status.activeCommand === id,
    activeTicksLeft: status.activeCommand === id ? status.activeTicksLeft : 0,
  };
}

/** Called after automatic ticks have advanced; client timing/effect overrides are rejected. */
export function applyBattleCommand(state, action) {
  if (!exactKeys(action, ['type', 'id']) || action.type !== 'battleCommand')
    fail('INVALID_BATTLE_COMMAND');
  const plan = battleCommandPlan(state, action.id);
  if (plan.reason) fail(plan.reason);
  const definition = definitionFor(action.id);
  state.battle.commands.push({ id: action.id, tick: state.battle.tick });
  if (definition.panicReduction)
    state.herd.panic = Math.max(0, state.herd.panic - definition.panicReduction);
  return state;
}

/** The next six exchanges are affected; never retroactively modify the issuing tick. */
export function battleCommandEffects(battle) {
  const last = battle.commands.at(-1);
  const definition = last && definitionFor(last.id);
  const applies =
    battle.status === 'active' &&
    definition &&
    battle.tick > last.tick &&
    battle.tick <= last.tick + definition.durationTicks;
  return {
    attack: applies ? definition.attack : 1,
    wolfDamage: applies ? definition.wolfDamage : 1,
    herdDamage: applies ? definition.herdDamage : 1,
  };
}

/** Migration adds only a missing field after the complete older state was validated. */
export function migrateBattleCommands(state) {
  if (!Object.hasOwn(state.battle, 'commands')) state.battle.commands = [];
  return state;
}

export function validateBattleCommands(battle) {
  if (!Array.isArray(battle.commands) || battle.commands.length > MAX_COMMANDS) return false;
  if (battle.status === 'preparing' && battle.commands.length) return false;
  let previous = null;
  for (const command of battle.commands) {
    if (
      !exactKeys(command, ['id', 'tick']) ||
      !definitionFor(command.id) ||
      !Number.isSafeInteger(command.tick) ||
      command.tick < INTRO_TICKS ||
      command.tick >= 90 ||
      command.tick > battle.tick ||
      (previous !== null && command.tick - previous < 12)
    )
      return false;
    previous = command.tick;
  }
  return true;
}
