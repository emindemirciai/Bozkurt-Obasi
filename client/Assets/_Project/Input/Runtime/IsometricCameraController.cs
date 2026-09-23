using UnityEngine;
using UnityEngine.InputSystem;

namespace Bozkurt.Input
{
    public sealed class IsometricCameraController : MonoBehaviour
    {
        [Header("View")]
        [SerializeField] private Vector3 targetPosition = Vector3.zero;
        [SerializeField, Range(25f, 70f)] private float pitch = 48f;
        [SerializeField, Range(-180f, 180f)] private float yaw = 45f;
        [SerializeField, Min(5f)] private float distance = 24f;

        [Header("Movement")]
        [SerializeField, Min(0.1f)] private float panSpeed = 12f;
        [SerializeField, Min(0.1f)] private float zoomSpeed = 2.5f;
        [SerializeField] private Vector2 distanceLimits = new(10f, 45f);
        [SerializeField] private Vector2 horizontalLimits = new(-35f, 35f);
        [SerializeField] private Vector2 verticalLimits = new(-25f, 25f);

        private float _previousPinchDistance;

        private void Update()
        {
            ReadKeyboardPan();
            ReadMouseZoom();
            ReadTouchZoom();
            ApplyTransform();
        }

        private void ReadKeyboardPan()
        {
            var keyboard = Keyboard.current;
            if (keyboard == null)
            {
                return;
            }

            var input = Vector2.zero;
            if (keyboard.wKey.isPressed || keyboard.upArrowKey.isPressed) input.y += 1f;
            if (keyboard.sKey.isPressed || keyboard.downArrowKey.isPressed) input.y -= 1f;
            if (keyboard.dKey.isPressed || keyboard.rightArrowKey.isPressed) input.x += 1f;
            if (keyboard.aKey.isPressed || keyboard.leftArrowKey.isPressed) input.x -= 1f;

            if (input.sqrMagnitude <= 0f)
            {
                return;
            }

            input.Normalize();
            var rotation = Quaternion.Euler(0f, yaw, 0f);
            var worldDirection = rotation * new Vector3(input.x, 0f, input.y);
            targetPosition += worldDirection * (panSpeed * Time.unscaledDeltaTime);
            targetPosition.x = Mathf.Clamp(targetPosition.x, horizontalLimits.x, horizontalLimits.y);
            targetPosition.z = Mathf.Clamp(targetPosition.z, verticalLimits.x, verticalLimits.y);
        }

        private void ReadMouseZoom()
        {
            var mouse = Mouse.current;
            if (mouse == null)
            {
                return;
            }

            var scroll = mouse.scroll.ReadValue().y;
            if (Mathf.Abs(scroll) > 0.01f)
            {
                distance -= Mathf.Sign(scroll) * zoomSpeed;
                distance = Mathf.Clamp(distance, distanceLimits.x, distanceLimits.y);
            }
        }

        private void ReadTouchZoom()
        {
            var touchscreen = Touchscreen.current;
            if (touchscreen == null)
            {
                _previousPinchDistance = 0f;
                return;
            }

            var first = touchscreen.touches[0];
            var second = touchscreen.touches[1];
            if (!first.press.isPressed || !second.press.isPressed)
            {
                _previousPinchDistance = 0f;
                return;
            }

            var pinchDistance = Vector2.Distance(first.position.ReadValue(), second.position.ReadValue());
            if (_previousPinchDistance > 0f)
            {
                var delta = pinchDistance - _previousPinchDistance;
                distance -= delta * 0.015f;
                distance = Mathf.Clamp(distance, distanceLimits.x, distanceLimits.y);
            }

            _previousPinchDistance = pinchDistance;
        }

        private void ApplyTransform()
        {
            var rotation = Quaternion.Euler(pitch, yaw, 0f);
            transform.SetPositionAndRotation(targetPosition - rotation * Vector3.forward * distance, rotation);
        }

        public void Focus(Vector3 worldPosition)
        {
            targetPosition = new Vector3(worldPosition.x, 0f, worldPosition.z);
        }
    }
}
