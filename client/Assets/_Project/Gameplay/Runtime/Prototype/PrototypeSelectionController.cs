using System.Collections.Generic;
using Bozkurt.Gameplay.Combat;
using Bozkurt.Gameplay.Progression;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;

namespace Bozkurt.Gameplay.Prototype
{
    public sealed class PrototypeSelectionController : MonoBehaviour
    {
        [SerializeField, Min(2f)] private float dragThreshold = 12f;
        [SerializeField, Min(0.1f)] private float longPressDuration = 0.45f;
        [SerializeField, Min(0.1f)] private float commandSpacing = 1.8f;
        [SerializeField, Min(20f)] private float downedWolfScreenPickRadius = 72f;

        private readonly List<SelectableWolf> _selected = new();
        private Camera _camera;
        private Vector2 _dragStart;
        private Vector2 _dragCurrent;
        private bool _isDragging;
        private double _touchStartedAt;
        private Vector2 _touchStart;
        private string _commandMessage = string.Empty;
        private float _commandMessageUntil;

        public int SelectedCount => _selected.Count;
        public string CommandMessage => Time.unscaledTime <= _commandMessageUntil ? _commandMessage : string.Empty;
        public WolfProgression PrimarySelectedProgression
        {
            get
            {
                RemoveInvalidSelection();
                return _selected.Count > 0 && _selected[0] != null
                    ? _selected[0].GetComponent<WolfProgression>()
                    : null;
            }
        }

        private void Awake()
        {
            _camera = Camera.main;
        }

        private void Update()
        {
            if (_camera == null)
            {
                _camera = Camera.main;
                if (_camera == null) return;
            }

            RemoveInvalidSelection();
            HandleMouse();
            HandleTouch();
        }

        private void HandleMouse()
        {
            var mouse = Mouse.current;
            if (mouse == null)
            {
                return;
            }

            var pointerPosition = mouse.position.ReadValue();
            if (mouse.leftButton.wasPressedThisFrame && !IsPointerOverUi())
            {
                _dragStart = pointerPosition;
                _dragCurrent = pointerPosition;
                _isDragging = true;
            }

            if (_isDragging && mouse.leftButton.isPressed)
            {
                _dragCurrent = pointerPosition;
            }

            if (_isDragging && mouse.leftButton.wasReleasedThisFrame)
            {
                var additive = Keyboard.current != null
                    && (Keyboard.current.leftShiftKey.isPressed || Keyboard.current.rightShiftKey.isPressed);
                CompleteSelection(pointerPosition, additive);
                _isDragging = false;
            }

            if (mouse.rightButton.wasPressedThisFrame && !IsPointerOverUi())
            {
                CommandSelected(pointerPosition);
            }
        }

        private void HandleTouch()
        {
            var touchscreen = Touchscreen.current;
            if (touchscreen == null)
            {
                return;
            }

            var touch = touchscreen.primaryTouch;
            if (touch.press.wasPressedThisFrame)
            {
                _touchStartedAt = Time.unscaledTimeAsDouble;
                _touchStart = touch.position.ReadValue();
            }

            if (!touch.press.wasReleasedThisFrame)
            {
                return;
            }

            var position = touch.position.ReadValue();
            if (IsPointerOverUi(touch.touchId.ReadValue()))
            {
                return;
            }

            var duration = Time.unscaledTimeAsDouble - _touchStartedAt;
            var movement = Vector2.Distance(_touchStart, position);
            if (duration >= longPressDuration && movement < dragThreshold * 1.5f)
            {
                CommandSelected(position);
            }
            else if (movement < dragThreshold * 1.5f)
            {
                SelectAt(position, false);
            }
        }

        private void CompleteSelection(Vector2 releasePosition, bool additive)
        {
            if (Vector2.Distance(_dragStart, releasePosition) < dragThreshold)
            {
                SelectAt(releasePosition, additive);
                return;
            }

            SelectInsideScreenRectangle(_dragStart, releasePosition, additive);
        }

        private void SelectAt(Vector2 screenPosition, bool additive)
        {
            if (!additive)
            {
                ClearSelection();
            }

            var ray = _camera.ScreenPointToRay(screenPosition);
            if (!Physics.Raycast(ray, out var hit, 500f, ~0, QueryTriggerInteraction.Ignore))
            {
                return;
            }

            var wolf = hit.collider.GetComponentInParent<SelectableWolf>();
            if (wolf != null && wolf.IsOperational)
            {
                AddSelection(wolf);
            }
        }

        private void SelectInsideScreenRectangle(Vector2 start, Vector2 end, bool additive)
        {
            if (!additive)
            {
                ClearSelection();
            }

            var rectangle = ScreenRectangle(start, end);
            var wolves = FindObjectsByType<SelectableWolf>(FindObjectsSortMode.None);
            foreach (var wolf in wolves)
            {
                if (!wolf.IsOperational)
                {
                    continue;
                }

                var screenPosition = _camera.WorldToScreenPoint(wolf.transform.position);
                if (screenPosition.z > 0f && rectangle.Contains(screenPosition))
                {
                    AddSelection(wolf);
                }
            }
        }

        private void CommandSelected(Vector2 screenPosition)
        {
            RemoveInvalidSelection();

            if (TryFindDownedWolf(screenPosition, out var downedWolf))
            {
                if (TryBeginRescue(downedWolf))
                {
                    ShowCommand($"Kurtarma emri verildi: {downedWolf.name}");
                }
                else
                {
                    ShowCommand("Kurtarabilecek aktif kurt bulunamadı.");
                }
                return;
            }

            if (_selected.Count == 0)
            {
                ShowCommand("Önce en az bir aktif kurt seç.");
                return;
            }

            var ray = _camera.ScreenPointToRay(screenPosition);
            if (!Physics.Raycast(ray, out var hit, 500f, ~0, QueryTriggerInteraction.Ignore))
            {
                return;
            }

            var center = hit.point;
            var columns = Mathf.CeilToInt(Mathf.Sqrt(_selected.Count));
            for (var index = 0; index < _selected.Count; index++)
            {
                var row = index / columns;
                var column = index % columns;
                var offset = new Vector3(
                    (column - (columns - 1) * 0.5f) * commandSpacing,
                    0f,
                    row * -commandSpacing);
                _selected[index].MoveTo(center + offset);
            }

            ShowCommand($"Hareket emri: {_selected.Count} kurt");
        }

        private bool TryFindDownedWolf(Vector2 screenPosition, out WolfCombatController target)
        {
            target = null;
            var ray = _camera.ScreenPointToRay(screenPosition);
            var hits = Physics.RaycastAll(ray, 500f, ~0, QueryTriggerInteraction.Ignore);
            var nearestRayDistance = float.PositiveInfinity;

            foreach (var hit in hits)
            {
                var candidate = hit.collider.GetComponentInParent<WolfCombatController>();
                if (candidate == null || !candidate.IsDowned || hit.distance >= nearestRayDistance)
                {
                    continue;
                }

                nearestRayDistance = hit.distance;
                target = candidate;
            }

            if (target != null)
            {
                return true;
            }

            // Fallback: a downed wolf can be visually flattened or partly hidden by another unit.
            // In that case, choose the closest downed wolf to the pointer in screen space.
            var bestScreenDistance = downedWolfScreenPickRadius;
            var wolves = FindObjectsByType<WolfCombatController>(FindObjectsSortMode.None);
            foreach (var candidate in wolves)
            {
                if (candidate == null || !candidate.IsDowned)
                {
                    continue;
                }

                var projected = _camera.WorldToScreenPoint(candidate.transform.position);
                if (projected.z <= 0f)
                {
                    continue;
                }

                var distance = Vector2.Distance(screenPosition, new Vector2(projected.x, projected.y));
                if (distance >= bestScreenDistance)
                {
                    continue;
                }

                bestScreenDistance = distance;
                target = candidate;
            }

            return target != null;
        }

        private bool TryBeginRescue(WolfCombatController target)
        {
            WolfCombatController nearest = null;
            var bestDistance = float.PositiveInfinity;

            foreach (var selectable in _selected)
            {
                ConsiderRescuer(selectable != null ? selectable.GetComponent<WolfCombatController>() : null);
            }

            // If the player has no valid selection, keep the interaction simple and use the nearest active wolf.
            if (nearest == null)
            {
                var allWolves = FindObjectsByType<WolfCombatController>(FindObjectsSortMode.None);
                foreach (var candidate in allWolves)
                {
                    ConsiderRescuer(candidate);
                }
            }

            if (nearest == null)
            {
                return false;
            }

            return nearest.BeginRescue(target);

            void ConsiderRescuer(WolfCombatController candidate)
            {
                if (candidate == null || candidate == target || candidate.IsDowned)
                {
                    return;
                }

                var distance = (candidate.transform.position - target.transform.position).sqrMagnitude;
                if (distance >= bestDistance)
                {
                    return;
                }

                bestDistance = distance;
                nearest = candidate;
            }
        }


        public void SelectFirstHealer()
        {
            ClearSelection();
            WolfProgression selected = null;
            var progressions = FindObjectsByType<WolfProgression>(FindObjectsSortMode.None);
            foreach (var progression in progressions)
            {
                if (progression == null || !progression.CanHeal)
                {
                    continue;
                }

                var combat = progression.GetComponent<WolfCombatController>();
                if (combat == null || combat.IsDowned)
                {
                    continue;
                }

                if (selected == null || progression.WolfIndex < selected.WolfIndex)
                {
                    selected = progression;
                }
            }

            if (selected == null)
            {
                ShowCommand("Aktif şifacı kurt bulunamadı.");
                return;
            }

            var selectable = selected.GetComponent<SelectableWolf>();
            if (selectable == null)
            {
                ShowCommand("Şifacı kurt seçilemedi.");
                return;
            }

            AddSelection(selectable);
            ShowCommand($"Şifacı seçildi: {selected.gameObject.name}");
        }

        public void TrainSelectedGuardian() => TrainSelected(WolfTrainingPath.Guardian);

        public void TrainSelectedHunter() => TrainSelected(WolfTrainingPath.Hunter);

        public void TrainSelectedLeader() => TrainSelected(WolfTrainingPath.Leader);

        public void TrainSelectedHealer() => TrainSelected(WolfTrainingPath.Healer);

        private void TrainSelected(WolfTrainingPath path)
        {
            var progression = PrimarySelectedProgression;
            if (progression == null)
            {
                ShowCommand("Eğitim için önce bir kurt seç.");
                return;
            }

            if (!progression.SpendTrainingPoint(path))
            {
                ShowCommand($"{progression.gameObject.name} için kullanılabilir eğitim puanı yok.");
                return;
            }

            var combat = progression.GetComponent<WolfCombatController>();
            combat?.RefreshProgressionBonuses();
            ShowCommand($"{progression.gameObject.name}: {WolfTrainingPathNames.GetDisplayName(path)} eğitimi tamamlandı.");
        }

        private void AddSelection(SelectableWolf wolf)
        {
            if (_selected.Contains(wolf) || !wolf.IsOperational)
            {
                return;
            }

            _selected.Add(wolf);
            wolf.SetSelected(true);
        }

        private void ClearSelection()
        {
            foreach (var wolf in _selected)
            {
                if (wolf != null) wolf.SetSelected(false);
            }
            _selected.Clear();
        }

        private void RemoveInvalidSelection()
        {
            for (var index = _selected.Count - 1; index >= 0; index--)
            {
                var wolf = _selected[index];
                if (wolf != null && wolf.IsOperational)
                {
                    continue;
                }

                if (wolf != null)
                {
                    wolf.SetSelected(false);
                }
                _selected.RemoveAt(index);
            }
        }

        private void ShowCommand(string message)
        {
            _commandMessage = message;
            _commandMessageUntil = Time.unscaledTime + 3f;
        }

        private static Rect ScreenRectangle(Vector2 start, Vector2 end)
        {
            var minimum = Vector2.Min(start, end);
            var maximum = Vector2.Max(start, end);
            return Rect.MinMaxRect(minimum.x, minimum.y, maximum.x, maximum.y);
        }

        private static bool IsPointerOverUi(int pointerId = -1)
        {
            if (EventSystem.current == null)
            {
                return false;
            }

            return pointerId >= 0
                ? EventSystem.current.IsPointerOverGameObject(pointerId)
                : EventSystem.current.IsPointerOverGameObject();
        }

        private void OnGUI()
        {
            if (!_isDragging)
            {
                return;
            }

            var previousColor = GUI.color;
            var screenRect = ScreenRectangle(
                new Vector2(_dragStart.x, Screen.height - _dragStart.y),
                new Vector2(_dragCurrent.x, Screen.height - _dragCurrent.y));
            GUI.color = new Color(0.2f, 0.65f, 1f, 0.22f);
            GUI.DrawTexture(screenRect, Texture2D.whiteTexture);
            GUI.color = new Color(0.2f, 0.65f, 1f, 0.9f);
            GUI.Box(screenRect, GUIContent.none);
            GUI.color = previousColor;
        }
    }
}
