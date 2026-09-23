using UnityEngine;

namespace Bozkurt.Gameplay.Combat
{
    [DisallowMultipleComponent]
    public sealed class WorldHealthBar : MonoBehaviour
    {
        private HealthComponent _health;
        private Transform _barRoot;
        private Transform _fill;
        private float _width;
        private Camera _camera;

        public void Initialize(HealthComponent health, float verticalOffset, float width, Color fillColor)
        {
            _health = health;
            _width = Mathf.Max(0.3f, width);
            _camera = Camera.main;

            var root = new GameObject("HealthBar");
            root.transform.SetParent(transform, false);
            root.transform.localPosition = Vector3.up * verticalOffset;
            _barRoot = root.transform;

            var background = CreateBarPart("Background", new Color(0.08f, 0.08f, 0.08f), root.transform);
            background.localScale = new Vector3(_width, 0.12f, 0.06f);

            _fill = CreateBarPart("Fill", fillColor, root.transform);
            Refresh();
        }

        private void LateUpdate()
        {
            if (_barRoot == null || _health == null)
            {
                return;
            }

            if (_camera == null)
            {
                _camera = Camera.main;
            }

            if (_camera != null)
            {
                _barRoot.rotation = _camera.transform.rotation;
            }

            Refresh();
        }

        private void Refresh()
        {
            if (_fill == null || _health == null)
            {
                return;
            }

            var ratio = Mathf.Clamp01(_health.NormalizedHealth);
            if (_barRoot != null)
            {
                _barRoot.gameObject.SetActive(ratio < 0.999f);
            }
            _fill.localScale = new Vector3(_width * ratio, 0.075f, 0.07f);
            _fill.localPosition = new Vector3(-(_width * (1f - ratio)) * 0.5f, 0f, -0.04f);
        }

        private static Transform CreateBarPart(string name, Color color, Transform parent)
        {
            var part = GameObject.CreatePrimitive(PrimitiveType.Cube);
            part.name = name;
            part.transform.SetParent(parent, false);
            var collider = part.GetComponent<Collider>();
            if (collider != null)
            {
                Destroy(collider);
            }

            var shader = Shader.Find("Universal Render Pipeline/Unlit")
                ?? Shader.Find("Unlit/Color")
                ?? Shader.Find("Standard");
            part.GetComponent<Renderer>().material = new Material(shader) { color = color };
            return part.transform;
        }
    }
}
