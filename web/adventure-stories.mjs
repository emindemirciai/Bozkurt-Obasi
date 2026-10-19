import { ADVENTURE_PLANS, adventureQuote, outingQuote } from '../shared/adventures.mjs';

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const resources = (values, t, language) =>
  Object.entries(values)
    .filter(([, amount]) => amount > 0)
    .map(
      ([key, amount]) =>
        `${language ? amount.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 6 }) : Math.ceil(amount)} ${escape(t(key))}`,
    )
    .join(' · ');
export const missionPlan = (outing) => outing.plan ?? 'standard';
export const missionStoryKey = (outing, stage) => `story_${outing.kind}_${outing.region}_${stage}`;

export function missionPlanPicker(
  state,
  selection,
  { t, disabled = false, active = false, outing = null },
) {
  return `<fieldset class="mission-plans" ${disabled ? 'disabled' : ''} aria-describedby="mission-plan-hint"><legend>${t('missionPlanTitle')}</legend><p id="mission-plan-hint">${t(active ? 'missionPlanLocked' : 'missionPlanHint')}</p><div class="mission-plan-grid">${ADVENTURE_PLANS.map(
    (plan) => {
      const quote = outing
        ? outingQuote(state, { ...outing, plan })
        : adventureQuote(state, { ...selection, plan });
      return `<label class="mission-plan-card" data-mission-plan="${plan}"><span class="mission-plan-heading"><input type="radio" id="adventure-plan-${plan}" name="adventure-plan" value="${plan}" ${missionPlan(selection) === plan ? 'checked' : ''} aria-labelledby="mission-plan-title-${plan}" aria-describedby="mission-plan-description-${plan} mission-plan-stats-${plan}"><strong id="mission-plan-title-${plan}">${t('missionPlan_' + plan)}</strong></span><span class="mission-plan-description" id="mission-plan-description-${plan}">${t('missionPlan_' + plan + 'Hint')}</span><dl id="mission-plan-stats-${plan}"><div><dt>${t('missionTime')}</dt><dd data-plan-seconds>${quote.seconds} ${t('seconds')}</dd></div><div><dt>${t('missionSupplies')}</dt><dd data-plan-cost>${resources(quote.cost, t)}</dd></div><div><dt>${t('missionMaterials')}</dt><dd data-plan-reward>${resources(quote.reward, t)}</dd></div><div><dt>${t('missionXp')}</dt><dd data-plan-xp>+${quote.xp}</dd></div><div><dt>${t('missionFatigue')}</dt><dd data-plan-fatigue>−${quote.fatigue} ${t('missionHp')}</dd></div></dl></label>`;
    },
  ).join('')}</div></fieldset>`;
}

export function journeyStory(outing, { t, now }) {
  const elapsed = Math.max(0, Math.min(outing.endsAt - outing.startedAt, now - outing.startedAt));
  const part = Math.min(2, Math.floor((3 * elapsed) / (outing.endsAt - outing.startedAt)));
  const stages = ['departure', 'middle', 'arrival'];
  const labels = ['missionStageDeparture', 'missionStageMiddle', 'missionStageArrival'];
  return `<section class="journey-story detail-card" data-active-adventure data-mission-stage="${stages[part]}"><span class="eyebrow">${t(outing.kind)} · ${t(outing.region)} · ${t(outing.difficulty)}</span><h2>${t('expeditionActive')}</h2><span class="mission-plan-badge" data-active-plan>${t('missionPlan_' + missionPlan(outing))}</span><ol class="mission-stages" aria-label="${t('missionStageLabel')}">${stages.map((stage, i) => `<li ${i === part ? 'aria-current="step"' : ''} class="${i < part ? 'complete' : ''}"><span aria-hidden="true">${i < part ? '✓' : i + 1}</span>${t(labels[i])}</li>`).join('')}</ol><p data-mission-story>${t(missionStoryKey(outing, stages[part]))}</p><p class="mission-plan-flavor">${t('missionPlan_' + missionPlan(outing) + 'Story')}</p><progress aria-label="${t('journeyProgress')}" value="${elapsed}" max="${outing.endsAt - outing.startedAt}"></progress><strong>${Math.max(0, Math.ceil((outing.endsAt - now) / 1000))} ${t('seconds')}</strong></section>`;
}

export function missionBrief(selection, { t }) {
  return `<span class="eyebrow">${t('missionStoryBrief')}</span><h3>${t(selection.region)} · ${t(selection.kind)}</h3><p data-mission-brief>${t(missionStoryKey(selection, 'departure'))}</p><span class="mission-plan-badge">${t('missionPlan_' + missionPlan(selection))}</span><p class="mission-plan-flavor">${t('missionPlan_' + missionPlan(selection) + 'Story')}</p>`;
}

export function missionReport(report, { t, language }) {
  return `<article class="detail-card" tabindex="-1" data-mission-report="${escape(report.id)}"><span class="eyebrow">${t(report.kind)} · ${t(report.region)} · ${t(report.difficulty)}</span><p class="mission-report-plan">${t('missionReportPlan')}: <strong data-report-plan>${t('missionPlan_' + missionPlan(report))}</strong></p><h3>${t('missionArrival')}</h3><p data-mission-story>${t(missionStoryKey(report, 'report'))}</p><p class="mission-plan-flavor">${t('missionPlan_' + missionPlan(report) + 'Story')}</p><p data-report-reward>${t('rewardReceived')}: ${resources(report.reward, t, language) || t('missionNoMaterials')} · ${report.itemCount} ${t(report.item)} · +${report.xp} ${t('xp')} / ${t('wolfCount')}</p><small>${report.wolfIds.map((id) => t(id.replace('wolf-', '') === 'healer' ? 'healerPath' : id.replace('wolf-', ''))).join(' · ')} · ${new Date(report.completedAt).toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US')}</small></article>`;
}
