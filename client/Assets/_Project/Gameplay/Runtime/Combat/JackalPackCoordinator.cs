using System.Collections.Generic;
using UnityEngine;

namespace Bozkurt.Gameplay.Combat
{
    [DisallowMultipleComponent]
    public sealed class JackalPackCoordinator : MonoBehaviour
    {
        [Header("Tactics")]
        [SerializeField] private bool automaticTacticChanges;
        [SerializeField, Min(2f)] private float tacticDuration = 7.5f;
        [SerializeField, Min(4f)] private float flankWidth = 13f;
        [SerializeField, Min(1f)] private float stagingDepth = 1.5f;

        [Header("Howl Support")]
        [SerializeField, Min(1f)] private float howlRadius = 10f;
        [SerializeField, Min(0.5f)] private float howlDuration = 4.5f;
        [SerializeField, Min(1f)] private float howlDamageMultiplier = 1.22f;
        [SerializeField, Min(1f)] private float howlSpeedMultiplier = 1.16f;

        private readonly List<JackalCombatController> _members = new();
        private Vector3 _crescentOrigin;
        private Vector3 _starOrigin;
        private JackalCombatController _leader;
        private float _nextTacticAt;
        private int _tacticRevision;
        private int _howlCount;

        public JackalPackTactic CurrentTactic { get; private set; } = JackalPackTactic.DirectAssault;
        public string CurrentTacticName => JackalRoleNames.GetTacticDisplayName(CurrentTactic);
        public bool LeaderAlive => _leader != null && !_leader.IsDefeated;
        public bool BattleStarted { get; private set; }
        public bool CanChooseTactic => !BattleStarted;
        public int TacticRevision => _tacticRevision;
        public int HowlCount => _howlCount;
        public int ActiveMemberCount => CountActiveMembers();

        public void Initialize(Vector3 crescentOrigin, Vector3 starOrigin)
        {
            _members.Clear();
            _leader = null;
            _crescentOrigin = crescentOrigin;
            _starOrigin = starOrigin;
            _howlCount = 0;
            BattleStarted = false;
            CurrentTactic = JackalPackTactic.DirectAssault;
            _tacticRevision++;
            _nextTacticAt = float.PositiveInfinity;
        }

        public void UpdateAnchors(Vector3 crescentOrigin, Vector3 starOrigin)
        {
            _crescentOrigin = crescentOrigin;
            _starOrigin = starOrigin;
        }

        public void Register(JackalCombatController jackal)
        {
            if (jackal == null || _members.Contains(jackal))
            {
                return;
            }

            _members.Add(jackal);
            if (jackal.Role == JackalRole.Leader)
            {
                _leader = jackal;
            }
        }

        public void StartBattle()
        {
            if (BattleStarted)
            {
                return;
            }

            BattleStarted = true;
            _nextTacticAt = Time.time + tacticDuration;
            foreach (var member in _members)
            {
                if (member != null && !member.IsDefeated)
                {
                    member.NotifyBattleStarted();
                }
            }
        }

        public void StopBattle()
        {
            BattleStarted = false;
            _nextTacticAt = float.PositiveInfinity;
        }

        public void NotifyDefeated(JackalCombatController jackal)
        {
            if (jackal == null)
            {
                return;
            }

            if (jackal == _leader)
            {
                _leader = null;
                SetTactic(JackalPackTactic.DirectAssault);
            }
        }

        public bool CyclePlannedTactic()
        {
            if (!CanChooseTactic)
            {
                return false;
            }

            AdvanceTactic();
            return true;
        }

        public bool TrySetPlannedTactic(JackalPackTactic tactic)
        {
            if (!CanChooseTactic)
            {
                return false;
            }

            SetTactic(tactic);
            return true;
        }

        public void ForceNextTactic()
        {
            CyclePlannedTactic();
        }

        public bool TryGetStagingWaypoint(JackalCombatController jackal, out Vector3 waypoint)
        {
            waypoint = default;
            if (jackal == null || jackal.IsDefeated)
            {
                return false;
            }

            if (jackal.Role == JackalRole.Howler)
            {
                waypoint = GetHowlerAnchor(jackal.PackSlot);
                return true;
            }

            var profile = JackalRoleCatalog.Get(jackal.Role);
            if (!profile.CanFlank)
            {
                return false;
            }

            var side = 0f;
            switch (CurrentTactic)
            {
                case JackalPackTactic.LeftFlank:
                    side = -1f;
                    break;
                case JackalPackTactic.RightFlank:
                    side = 1f;
                    break;
                case JackalPackTactic.SplitFlank:
                    side = jackal.PackSlot % 2 == 0 ? -1f : 1f;
                    break;
                default:
                    return false;
            }

            var laneOffset = (jackal.PackSlot % 3 - 1) * 0.9f;
            waypoint = new Vector3(
                _starOrigin.x + side * (flankWidth + laneOffset),
                jackal.transform.position.y,
                _crescentOrigin.z - stagingDepth - Mathf.Abs(laneOffset) * 0.35f);
            return true;
        }

        public bool ShouldPreferHerd(JackalCombatController jackal)
        {
            if (jackal == null)
            {
                return false;
            }

            if (jackal.Role == JackalRole.Brute || jackal.Role == JackalRole.Leader || jackal.Role == JackalRole.Howler)
            {
                return false;
            }

            if (CurrentTactic == JackalPackTactic.HerdRush)
            {
                return true;
            }

            if (CurrentTactic is JackalPackTactic.LeftFlank or JackalPackTactic.RightFlank or JackalPackTactic.SplitFlank)
            {
                return JackalRoleCatalog.Get(jackal.Role).CanFlank;
            }

            return JackalRoleCatalog.Get(jackal.Role).PrefersHerd;
        }

        public Vector3 GetHowlerAnchor(int packSlot)
        {
            var side = packSlot % 2 == 0 ? -1f : 1f;
            return new Vector3(
                _crescentOrigin.x + side * 5.5f,
                0.7f,
                _crescentOrigin.z + 7.5f);
        }

        public void ApplyHowl(Vector3 origin)
        {
            if (!BattleStarted)
            {
                return;
            }

            _howlCount++;
            var radiusSquared = howlRadius * howlRadius;
            foreach (var member in _members)
            {
                if (member == null || member.IsDefeated)
                {
                    continue;
                }

                var offset = member.transform.position - origin;
                offset.y = 0f;
                if (offset.sqrMagnitude <= radiusSquared)
                {
                    member.ApplyPackBuff(howlDuration, howlDamageMultiplier, howlSpeedMultiplier);
                }
            }
        }

        private void Update()
        {
            RemoveInvalidMembers();
            if (!BattleStarted || ActiveMemberCount <= 1)
            {
                return;
            }

            if (!LeaderAlive)
            {
                if (CurrentTactic != JackalPackTactic.DirectAssault)
                {
                    SetTactic(JackalPackTactic.DirectAssault);
                }
                return;
            }

            if (automaticTacticChanges && Time.time >= _nextTacticAt)
            {
                AdvanceTactic();
            }
        }

        private void AdvanceTactic()
        {
            var next = CurrentTactic switch
            {
                JackalPackTactic.DirectAssault => JackalPackTactic.LeftFlank,
                JackalPackTactic.LeftFlank => JackalPackTactic.RightFlank,
                JackalPackTactic.RightFlank => JackalPackTactic.SplitFlank,
                JackalPackTactic.SplitFlank => JackalPackTactic.HerdRush,
                _ => JackalPackTactic.DirectAssault
            };
            SetTactic(next);
        }

        private void SetTactic(JackalPackTactic tactic)
        {
            CurrentTactic = tactic;
            _tacticRevision++;
            _nextTacticAt = BattleStarted && automaticTacticChanges
                ? Time.time + tacticDuration
                : float.PositiveInfinity;
        }

        private int CountActiveMembers()
        {
            var count = 0;
            foreach (var member in _members)
            {
                if (member != null && !member.IsDefeated)
                {
                    count++;
                }
            }
            return count;
        }

        private void RemoveInvalidMembers()
        {
            for (var index = _members.Count - 1; index >= 0; index--)
            {
                if (_members[index] == null)
                {
                    _members.RemoveAt(index);
                }
            }
        }
    }
}
