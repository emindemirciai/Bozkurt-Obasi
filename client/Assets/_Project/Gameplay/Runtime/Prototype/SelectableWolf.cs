using UnityEngine;

namespace Bozkurt.Gameplay.Prototype
{
    [DisallowMultipleComponent]
    public sealed class SelectableWolf : MonoBehaviour
    {
        [SerializeField, Min(0.1f)] private float movementSpeed = 5.5f;
        [SerializeField, Min(1f)] private float rotationSpeed = 12f;

        private Renderer _renderer;
        private Material _material;
        private Color _baseColor;
        private Color? _statusColor;
        private Vector3 _destination;
        private bool _hasDestination;

        public int Index { get; private set; }
        public Vector3 FormationPosition { get; private set; }
        public bool IsSelected { get; private set; }
        public bool IsOperational { get; private set; } = true;
        public bool HasManualOrder { get; private set; }
        public bool IsMoving => _hasDestination;

        public void Initialize(int index, Vector3 formationPosition)
        {
            Index = index;
            FormationPosition = formationPosition;
            _destination = transform.position;
            IsOperational = true;
            CacheRenderer();
            RefreshColor();
        }

        public void SetFormationPosition(Vector3 formationPosition)
        {
            FormationPosition = new Vector3(formationPosition.x, transform.position.y, formationPosition.z);
        }

        public void SetSelected(bool selected)
        {
            CacheRenderer();
            IsSelected = selected && IsOperational;
            RefreshColor();
        }

        public void SetOperational(bool operational)
        {
            IsOperational = operational;
            if (!operational)
            {
                IsSelected = false;
                StopMovement();
            }
            RefreshColor();
        }

        public void SetStatusColor(Color color)
        {
            _statusColor = color;
            RefreshColor();
        }

        public void ClearStatusColor()
        {
            _statusColor = null;
            RefreshColor();
        }

        public void MoveTo(Vector3 worldPosition)
        {
            SetDestination(worldPosition, true);
        }

        public void MoveToSystem(Vector3 worldPosition)
        {
            SetDestination(worldPosition, false);
        }

        public void CancelManualOrder()
        {
            HasManualOrder = false;
        }

        public void StopMovement()
        {
            _destination = transform.position;
            _hasDestination = false;
            HasManualOrder = false;
        }

        public void ReturnToFormation()
        {
            SetDestination(FormationPosition, true);
        }

        private void SetDestination(Vector3 worldPosition, bool manualOrder)
        {
            if (!IsOperational)
            {
                return;
            }

            _destination = new Vector3(worldPosition.x, transform.position.y, worldPosition.z);
            _hasDestination = true;
            HasManualOrder = manualOrder;
        }

        private void Update()
        {
            if (!_hasDestination || !IsOperational)
            {
                return;
            }

            var offset = _destination - transform.position;
            offset.y = 0f;
            if (offset.sqrMagnitude <= 0.02f)
            {
                transform.position = _destination;
                _hasDestination = false;
                HasManualOrder = false;
                return;
            }

            var direction = offset.normalized;
            transform.position = Vector3.MoveTowards(
                transform.position,
                _destination,
                movementSpeed * Time.deltaTime);
            var targetRotation = Quaternion.LookRotation(direction, Vector3.up);
            transform.rotation = Quaternion.Slerp(
                transform.rotation,
                targetRotation,
                rotationSpeed * Time.deltaTime);
        }

        private void CacheRenderer()
        {
            if (_renderer != null)
            {
                return;
            }

            _renderer = GetComponentInChildren<Renderer>();
            if (_renderer == null)
            {
                return;
            }

            _material = _renderer.material;
            _baseColor = _material.color;
        }

        private void RefreshColor()
        {
            if (_material == null)
            {
                return;
            }

            if (_statusColor.HasValue)
            {
                _material.color = _statusColor.Value;
                return;
            }

            _material.color = IsSelected
                ? Color.Lerp(_baseColor, new Color(1f, 0.78f, 0.16f), 0.7f)
                : _baseColor;
        }
    }
}
