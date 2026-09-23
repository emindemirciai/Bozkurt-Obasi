using System.Collections.Generic;
using Bozkurt.Gameplay.Prototype;
using Bozkurt.Gameplay.Save;
using Bozkurt.Gameplay.World;
using UnityEngine;

namespace Bozkurt.Gameplay.Camps
{
    [DisallowMultipleComponent]
    public sealed class PrototypeCampController : MonoBehaviour
    {
        [Header("Camp Placement")]
        [SerializeField, Min(4f)] private float campReachDistance = 13f;
        [SerializeField, Min(2f)] private float campOffsetDistance = 8.5f;
        [SerializeField, Min(2f)] private float buildingSlotRadius = 4.4f;

        [Header("Passive Camp Effects")]
        [SerializeField, Min(1f)] private float passiveHealingInterval = 4f;
        [SerializeField, Min(5f)] private float troughProductionInterval = 24f;
        [SerializeField, Range(0.01f, 0.2f)] private float passiveWolfHealingFraction = 0.045f;
        [SerializeField, Range(0.01f, 0.2f)] private float passiveHerdHealingFraction = 0.035f;

        [Header("Field Camp Cost")]
        [SerializeField, Min(0)] private int fieldCampWoodCost = 4;
        [SerializeField, Min(0)] private int fieldCampStoneCost = 2;

        private readonly List<CampSite> _camps = new();
        private FormationPrototypeController _formation;
        private PrototypeWorldController _world;
        private CampBuildingType _selectedBuilding = CampBuildingType.HealingArea;
        private float _nextPassiveHealingAt;
        private float _nextTroughProductionAt;
        private int _fieldCampSequence;

        public string SelectedBuildingName => CampBuildingCatalog.Get(_selectedBuilding).DisplayName;
        public CampBuildingType SelectedBuilding => _selectedBuilding;
        public int CampCount => _camps.Count;
        public bool IsAtCamp => FindNearestReachableCamp() != null;
        public bool IsAtMainBase => FindNearestReachableCamp()?.IsMainBase == true;
        public string CurrentCampName => FindNearestReachableCamp()?.Name ?? "Kamp dışında";
        public int CurrentCampBuildingCount => FindNearestReachableCamp()?.Buildings.Count ?? 0;
        public string CurrentCampBuildingSummary => BuildCurrentCampSummary();
        public bool CanUseCamp => _formation != null
            && _world != null
            && !_formation.IsBattleActive
            && !_world.IsMigrating;

        private void Awake()
        {
            FindControllers();
            CreateMainBase();
            _nextPassiveHealingAt = Time.time + passiveHealingInterval;
            _nextTroughProductionAt = Time.time + troughProductionInterval;
        }

        private void Update()
        {
            FindControllers();
            if (!CanUseCamp)
            {
                return;
            }

            var camp = FindNearestReachableCamp();
            if (camp == null)
            {
                return;
            }

            if (Time.time >= _nextPassiveHealingAt)
            {
                _nextPassiveHealingAt = Time.time + passiveHealingInterval;
                ApplyPassiveCampEffects(camp);
            }

            if (Time.time >= _nextTroughProductionAt)
            {
                _nextTroughProductionAt = Time.time + troughProductionInterval;
                ApplyTroughProduction(camp);
            }
        }

        public CampSessionData CaptureSessionData()
        {
            var data = new CampSessionData
            {
                selectedBuilding = (int)_selectedBuilding,
                fieldCampSequence = _fieldCampSequence
            };

            foreach (var camp in _camps)
            {
                var saved = new CampSiteSessionData
                {
                    name = camp.Name,
                    center = new SerializableVector3(camp.Center.x, camp.Center.y, camp.Center.z),
                    mainBase = camp.IsMainBase
                };
                foreach (var building in camp.Buildings)
                {
                    saved.buildings.Add((int)building.Type);
                }
                data.sites.Add(saved);
            }
            return data;
        }

        public void RestoreSessionData(CampSessionData data)
        {
            if (data == null || data.sites == null || data.sites.Count == 0)
            {
                return;
            }

            ClearCampVisuals();
            _selectedBuilding = System.Enum.IsDefined(typeof(CampBuildingType), data.selectedBuilding)
                ? (CampBuildingType)data.selectedBuilding
                : CampBuildingType.HealingArea;
            _fieldCampSequence = Mathf.Max(0, data.fieldCampSequence);

            foreach (var saved in data.sites)
            {
                if (saved == null)
                {
                    continue;
                }

                var center = new Vector3(saved.center.x, saved.center.y, saved.center.z);
                var camp = CreateCampSite(
                    string.IsNullOrWhiteSpace(saved.name) ? "Kamp" : saved.name,
                    center,
                    saved.mainBase);
                _camps.Add(camp);

                if (saved.buildings == null)
                {
                    continue;
                }

                foreach (var buildingValue in saved.buildings)
                {
                    if (!System.Enum.IsDefined(typeof(CampBuildingType), buildingValue))
                    {
                        continue;
                    }

                    var type = (CampBuildingType)buildingValue;
                    var profile = CampBuildingCatalog.Get(type);
                    var slotIndex = camp.Buildings.Count;
                    var position = GetBuildingSlot(camp.Center, slotIndex);
                    var visual = CreateBuildingVisual(camp.Root.transform, profile, position, slotIndex);
                    camp.Buildings.Add(new CampBuildingInstance(type, visual));
                }
            }
        }

        private void ClearCampVisuals()
        {
            foreach (var camp in _camps)
            {
                if (camp?.Root == null)
                {
                    continue;
                }

                camp.Root.SetActive(false);
                if (Application.isPlaying)
                {
                    Destroy(camp.Root);
                }
                else
                {
                    DestroyImmediate(camp.Root);
                }
            }
            _camps.Clear();
        }

        public void CycleSelectedBuilding()
        {
            _selectedBuilding = CampBuildingCatalog.Next(_selectedBuilding);
        }

        public bool EstablishFieldCamp(out string message)
        {
            FindControllers();
            if (!CanUseCamp)
            {
                message = "Savaş veya göç sürerken kamp kurulamaz.";
                return false;
            }

            if (FindNearestReachableCamp() != null)
            {
                message = "Ay-yıldız düzeni zaten kullanılabilir bir kampın yakınında.";
                return false;
            }

            if (!_world.TryConsumeCampResources(fieldCampWoodCost, fieldCampStoneCost, 0))
            {
                message = $"Kamp için {fieldCampWoodCost} odun ve {fieldCampStoneCost} taş gerekiyor.";
                return false;
            }

            _fieldCampSequence++;
            var center = CalculateCampCenter(_formation.CurrentStarOrigin, _fieldCampSequence);
            var camp = CreateCampSite($"Geçici Kamp {_fieldCampSequence}", center, false);
            _camps.Add(camp);
            message = $"{camp.Name} kuruldu. Yapılar kampın çevresindeki boş yuvalara yerleştirilecek.";
            return true;
        }

        public bool BuildSelectedBuilding(out string message)
        {
            FindControllers();
            if (!CanUseCamp)
            {
                message = "Savaş veya göç sürerken yapı kurulamaz.";
                return false;
            }

            var camp = FindNearestReachableCamp();
            if (camp == null)
            {
                message = "Önce bulunduğun noktada kamp kurmalısın.";
                return false;
            }

            var profile = CampBuildingCatalog.Get(_selectedBuilding);
            if (!_world.TryConsumeCampResources(profile.WoodCost, profile.StoneCost, profile.HerbCost))
            {
                message = $"{profile.DisplayName}: {profile.WoodCost} odun, {profile.StoneCost} taş, {profile.HerbCost} şifalı bitki gerekiyor.";
                return false;
            }

            var slotIndex = camp.Buildings.Count;
            var position = GetBuildingSlot(camp.Center, slotIndex);
            var visual = CreateBuildingVisual(camp.Root.transform, profile, position, slotIndex);
            camp.Buildings.Add(new CampBuildingInstance(profile.Type, visual));

            if (profile.Type == CampBuildingType.SupplyDepot)
            {
                _world.ExpandStorage(10, 12, 4, 8, 6);
            }

            message = profile.Type == CampBuildingType.SupplyDepot
                ? $"{profile.DisplayName}, {camp.Name} içine kuruldu. Kaynak kapasiteleri yükseldi."
                : $"{profile.DisplayName}, {camp.Name} içine kuruldu.";
            return true;
        }

        public bool RestAtCurrentCamp(out string message)
        {
            FindControllers();
            if (!CanUseCamp)
            {
                message = "Savaş veya göç sürerken dinlenilemez.";
                return false;
            }

            var camp = FindNearestReachableCamp();
            if (camp == null)
            {
                message = "Dinlenmek için bir kampın yakınında olmalısın.";
                return false;
            }

            if (_formation.WoundedWolfCount <= 0
                && _formation.DownedWolfCount <= 0
                && _formation.TreatableHerdCount <= 0)
            {
                message = "Topluluk dinlenmiş durumda; tedavi gerektiren birim yok.";
                return false;
            }

            if (!_world.TryConsumeSupplies(1, 1))
            {
                message = "Dinlenmek için en az 1 su ve 1 yem gerekiyor.";
                return false;
            }

            var healingAreas = CountBuilding(camp, CampBuildingType.HealingArea);
            var shelters = CountBuilding(camp, CampBuildingType.Shelter);
            var wolfFraction = 0.34f + healingAreas * 0.12f;
            var herdFraction = 0.24f + healingAreas * 0.08f + shelters * 0.08f;
            var panicReduction = 0.35f + shelters * 0.15f;
            var affected = _formation.ApplyCampTreatment(
                Mathf.Clamp01(wolfFraction),
                Mathf.Clamp01(herdFraction),
                Mathf.Clamp01(panicReduction),
                true);

            message = $"{camp.Name} içinde dinlenildi. {affected} kurt veya sürü hayvanı toparlandı.";
            return true;
        }

        private void ApplyPassiveCampEffects(CampSite camp)
        {
            var healingAreas = CountBuilding(camp, CampBuildingType.HealingArea);
            var shelters = CountBuilding(camp, CampBuildingType.Shelter);
            var watchPosts = CountBuilding(camp, CampBuildingType.WatchPost);
            if (healingAreas <= 0 && shelters <= 0 && watchPosts <= 0)
            {
                return;
            }

            var wolfFraction = passiveWolfHealingFraction * healingAreas;
            var herdFraction = passiveHerdHealingFraction * (healingAreas + shelters);
            var panicReduction = 0.025f * shelters + 0.012f * watchPosts;
            _formation.ApplyCampTreatment(wolfFraction, herdFraction, panicReduction, false);
        }

        private void ApplyTroughProduction(CampSite camp)
        {
            var troughs = CountBuilding(camp, CampBuildingType.WaterTrough);
            if (troughs <= 0)
            {
                return;
            }

            _world.AddCampSupplies(troughs, troughs);
        }

        private void CreateMainBase()
        {
            if (_formation == null || _camps.Count > 0)
            {
                return;
            }

            var center = _formation.CurrentStarOrigin + new Vector3(campOffsetDistance, 0f, -campOffsetDistance * 0.55f);
            _camps.Add(CreateCampSite("Ana Yurt", center, true));
        }

        private CampSite CreateCampSite(string campName, Vector3 center, bool mainBase)
        {
            var root = new GameObject(campName);
            root.transform.SetParent(transform);
            root.transform.position = center;

            var ground = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            ground.name = "Kamp Sınırı";
            ground.transform.SetParent(root.transform);
            ground.transform.localPosition = new Vector3(0f, 0.08f, 0f);
            ground.transform.localScale = new Vector3(5.2f, 0.08f, 5.2f);
            ground.GetComponent<Renderer>().sharedMaterial = CreateMaterial(
                mainBase ? new Color(0.58f, 0.43f, 0.2f) : new Color(0.46f, 0.36f, 0.21f));
            DisableCollider(ground);

            var marker = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            marker.name = mainBase ? "Ana Yurt İşareti" : "Kamp İşareti";
            marker.transform.SetParent(root.transform);
            marker.transform.localPosition = new Vector3(0f, 1.4f, 0f);
            marker.transform.localScale = new Vector3(0.18f, 1.4f, 0.18f);
            marker.GetComponent<Renderer>().sharedMaterial = CreateMaterial(
                mainBase ? new Color(0.86f, 0.65f, 0.18f) : new Color(0.72f, 0.55f, 0.28f));
            DisableCollider(marker);

            var flag = GameObject.CreatePrimitive(PrimitiveType.Cube);
            flag.name = "Kamp Bayrağı";
            flag.transform.SetParent(root.transform);
            flag.transform.localPosition = new Vector3(0.6f, 2.15f, 0f);
            flag.transform.localScale = new Vector3(1.2f, 0.65f, 0.12f);
            flag.GetComponent<Renderer>().sharedMaterial = CreateMaterial(
                mainBase ? new Color(0.78f, 0.16f, 0.14f) : new Color(0.32f, 0.4f, 0.48f));
            DisableCollider(flag);

            return new CampSite(campName, center, mainBase, root);
        }

        private static GameObject CreateBuildingVisual(
            Transform parent,
            CampBuildingProfile profile,
            Vector3 worldPosition,
            int slotIndex)
        {
            var building = GameObject.CreatePrimitive(profile.Primitive);
            building.name = $"{profile.DisplayName}_{slotIndex + 1:00}";
            building.transform.SetParent(parent);
            building.transform.position = worldPosition + Vector3.up * CalculateVisualHeight(profile);
            building.transform.localScale = profile.Scale;
            building.GetComponent<Renderer>().sharedMaterial = CreateMaterial(profile.Color);
            DisableCollider(building);
            return building;
        }

        private CampSite FindNearestReachableCamp()
        {
            if (_formation == null)
            {
                return null;
            }

            CampSite nearest = null;
            var bestDistance = campReachDistance;
            foreach (var camp in _camps)
            {
                var distance = FlatDistance(_formation.CurrentStarOrigin, camp.Center);
                if (distance > bestDistance)
                {
                    continue;
                }

                bestDistance = distance;
                nearest = camp;
            }
            return nearest;
        }

        private string BuildCurrentCampSummary()
        {
            var camp = FindNearestReachableCamp();
            if (camp == null || camp.Buildings.Count == 0)
            {
                return camp == null ? "Kamp yok" : "Yapı yok";
            }

            return $"İyileştirme {CountBuilding(camp, CampBuildingType.HealingArea)}, " +
                   $"Depo {CountBuilding(camp, CampBuildingType.SupplyDepot)}, " +
                   $"Oluk {CountBuilding(camp, CampBuildingType.WaterTrough)}, " +
                   $"Korunak {CountBuilding(camp, CampBuildingType.Shelter)}, " +
                   $"Gözcü {CountBuilding(camp, CampBuildingType.WatchPost)}";
        }

        private static int CountBuilding(CampSite camp, CampBuildingType type)
        {
            var count = 0;
            foreach (var building in camp.Buildings)
            {
                if (building.Type == type)
                {
                    count++;
                }
            }
            return count;
        }

        private Vector3 CalculateCampCenter(Vector3 starCenter, int sequence)
        {
            var side = sequence % 2 == 0 ? -1f : 1f;
            return starCenter + new Vector3(campOffsetDistance * side, 0f, -campOffsetDistance * 0.55f);
        }

        private Vector3 GetBuildingSlot(Vector3 center, int slotIndex)
        {
            var angle = (slotIndex * 67.5f + 22.5f) * Mathf.Deg2Rad;
            var ring = 1f + slotIndex / 8;
            var radius = buildingSlotRadius + (ring - 1f) * 2.2f;
            return center + new Vector3(Mathf.Cos(angle) * radius, 0f, Mathf.Sin(angle) * radius);
        }

        private void FindControllers()
        {
            if (_formation == null)
            {
                _formation = FindFirstObjectByType<FormationPrototypeController>();
            }

            if (_world == null)
            {
                _world = FindFirstObjectByType<PrototypeWorldController>();
            }
        }

        private static float CalculateVisualHeight(CampBuildingProfile profile)
        {
            return profile.Primitive == PrimitiveType.Cylinder
                ? profile.Scale.y
                : profile.Scale.y * 0.5f;
        }

        private static float FlatDistance(Vector3 first, Vector3 second)
        {
            first.y = 0f;
            second.y = 0f;
            return Vector3.Distance(first, second);
        }

        private static void DisableCollider(GameObject target)
        {
            var collider = target != null ? target.GetComponent<Collider>() : null;
            if (collider != null)
            {
                collider.enabled = false;
            }
        }

        private static Material CreateMaterial(Color color)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            return new Material(shader) { color = color };
        }

        private sealed class CampSite
        {
            public CampSite(string name, Vector3 center, bool isMainBase, GameObject root)
            {
                Name = name;
                Center = center;
                IsMainBase = isMainBase;
                Root = root;
            }

            public string Name { get; }
            public Vector3 Center { get; }
            public bool IsMainBase { get; }
            public GameObject Root { get; }
            public List<CampBuildingInstance> Buildings { get; } = new();
        }

        private readonly struct CampBuildingInstance
        {
            public CampBuildingInstance(CampBuildingType type, GameObject visual)
            {
                Type = type;
                Visual = visual;
            }

            public CampBuildingType Type { get; }
            public GameObject Visual { get; }
        }
    }
}
