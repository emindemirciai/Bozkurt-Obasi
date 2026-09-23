using System;
using System.Collections.Generic;
using Bozkurt.Gameplay.Prototype;
using Bozkurt.Gameplay.Save;
using UnityEngine;

namespace Bozkurt.Gameplay.World
{
    [DisallowMultipleComponent]
    public sealed class PrototypeWorldController : MonoBehaviour
    {
        [Header("Migration")]
        [SerializeField, Min(0.1f)] private float migrationSpeed = 1.35f;
        [SerializeField, Min(0.5f)] private float arrivalDistance = 0.35f;
        [SerializeField, Min(1f)] private float collectDistance = 2.5f;

        [Header("World Clock")]
        [SerializeField, Min(30f)] private float dayLengthSeconds = 180f;
        [SerializeField, Min(10f)] private float weatherDurationSeconds = 38f;
        [SerializeField, Range(0f, 24f)] private float startingHour = 8f;

        [Header("Starting Resources")]
        [SerializeField, Min(0)] private int startingWater = 16;
        [SerializeField, Min(0)] private int startingFeed = 18;
        [SerializeField, Min(0)] private int startingHerbs = 3;
        [SerializeField, Min(0)] private int startingWood = 10;
        [SerializeField, Min(0)] private int startingStone = 8;

        [Header("Storage Capacities")]
        [SerializeField, Min(1)] private int startingWaterCapacity = 40;
        [SerializeField, Min(1)] private int startingFeedCapacity = 45;
        [SerializeField, Min(1)] private int startingHerbCapacity = 15;
        [SerializeField, Min(1)] private int startingWoodCapacity = 30;
        [SerializeField, Min(1)] private int startingStoneCapacity = 24;

        private readonly List<WorldWaypoint> _waypoints = new();
        private readonly List<GameObject> _worldVisuals = new();
        private FormationPrototypeController _formation;
        private Light _sun;
        private Camera _camera;
        private LineRenderer _routeLine;
        private int _currentWaypointIndex;
        private int _selectedWaypointIndex = 1;
        private bool _isMigrating;
        private float _migrationStartDistance;
        private float _worldHour;
        private int _worldDay = 1;
        private float _weatherTimer;
        private int _weatherIndex;
        private float _travelConsumptionAccumulator;

        public int Water { get; private set; }
        public int Feed { get; private set; }
        public int Herbs { get; private set; }
        public int Wood { get; private set; }
        public int Stone { get; private set; }
        public int WaterCapacity { get; private set; }
        public int FeedCapacity { get; private set; }
        public int HerbCapacity { get; private set; }
        public int WoodCapacity { get; private set; }
        public int StoneCapacity { get; private set; }
        public int WorldDay => _worldDay;
        public float WorldHour => _worldHour;
        public bool IsMigrating => _isMigrating;
        public PrototypeWeather Weather => (PrototypeWeather)_weatherIndex;
        public string WeatherName => WorldSimulationMath.GetWeatherDisplayName(Weather);
        public string TimeLabel => $"Gün {_worldDay} - {_worldHour:00}:00";
        public string CurrentLocationName => GetCurrentLocationName();
        public string SelectedRouteName => _waypoints.Count == 0 ? "Rota yok" : _waypoints[_selectedWaypointIndex].Name;
        public string MigrationStatusName => _isMigrating
            ? (_formation != null && _formation.IsBattleActive ? "Savaş nedeniyle durdu" : "Göç sürüyor")
            : "Beklemede";
        public float MigrationProgress01 => CalculateMigrationProgress();
        public bool CanCollectResources => FindNearestWaypointIndex(collectDistance) >= 0;

        private void Awake()
        {
            _formation = FindFirstObjectByType<FormationPrototypeController>();
            _sun = FindFirstObjectByType<Light>();
            _camera = Camera.main;
            Water = startingWater;
            Feed = startingFeed;
            Herbs = startingHerbs;
            Wood = startingWood;
            Stone = startingStone;
            WaterCapacity = startingWaterCapacity;
            FeedCapacity = startingFeedCapacity;
            HerbCapacity = startingHerbCapacity;
            WoodCapacity = startingWoodCapacity;
            StoneCapacity = startingStoneCapacity;
            _worldHour = startingHour;
            BuildWaypoints();
            CreateWorldVisuals();
            ApplyEnvironment();
        }

        private void Update()
        {
            if (_formation == null)
            {
                _formation = FindFirstObjectByType<FormationPrototypeController>();
                if (_formation == null)
                {
                    return;
                }
            }

            UpdateClockAndWeather();
            UpdateMigration();
            UpdateRouteLine();
        }

        public WorldSessionData CaptureSessionData()
        {
            var data = new WorldSessionData
            {
                water = Water,
                feed = Feed,
                herbs = Herbs,
                wood = Wood,
                stone = Stone,
                waterCapacity = WaterCapacity,
                feedCapacity = FeedCapacity,
                herbCapacity = HerbCapacity,
                woodCapacity = WoodCapacity,
                stoneCapacity = StoneCapacity,
                worldDay = _worldDay,
                worldHour = _worldHour,
                weatherIndex = _weatherIndex,
                currentWaypointIndex = _currentWaypointIndex,
                selectedWaypointIndex = _selectedWaypointIndex,
                migrating = _isMigrating
            };

            foreach (var waypoint in _waypoints)
            {
                data.waypointAvailability.Add(waypoint.Available);
            }
            return data;
        }

        public void RestoreSessionData(WorldSessionData data)
        {
            if (data == null)
            {
                return;
            }

            WaterCapacity = Mathf.Max(1, data.waterCapacity);
            FeedCapacity = Mathf.Max(1, data.feedCapacity);
            HerbCapacity = Mathf.Max(1, data.herbCapacity);
            WoodCapacity = Mathf.Max(1, data.woodCapacity);
            StoneCapacity = Mathf.Max(1, data.stoneCapacity);
            Water = Mathf.Clamp(data.water, 0, WaterCapacity);
            Feed = Mathf.Clamp(data.feed, 0, FeedCapacity);
            Herbs = Mathf.Clamp(data.herbs, 0, HerbCapacity);
            Wood = Mathf.Clamp(data.wood, 0, WoodCapacity);
            Stone = Mathf.Clamp(data.stone, 0, StoneCapacity);
            _worldDay = Mathf.Max(1, data.worldDay);
            _worldHour = Mathf.Repeat(data.worldHour, 24f);
            _weatherIndex = Mathf.Clamp(data.weatherIndex, 0, System.Enum.GetValues(typeof(PrototypeWeather)).Length - 1);
            _currentWaypointIndex = Mathf.Clamp(data.currentWaypointIndex, 0, Mathf.Max(0, _waypoints.Count - 1));
            _selectedWaypointIndex = Mathf.Clamp(data.selectedWaypointIndex, 0, Mathf.Max(0, _waypoints.Count - 1));
            if (_selectedWaypointIndex == _currentWaypointIndex && _waypoints.Count > 1)
            {
                _selectedWaypointIndex = (_currentWaypointIndex + 1) % _waypoints.Count;
            }

            if (data.waypointAvailability != null)
            {
                var count = Mathf.Min(data.waypointAvailability.Count, _waypoints.Count);
                for (var index = 0; index < count; index++)
                {
                    var waypoint = _waypoints[index];
                    waypoint.Available = data.waypointAvailability[index];
                    _waypoints[index] = waypoint;
                }
            }

            _isMigrating = data.migrating && Water > 0 && Feed > 0;
            if (_isMigrating && _formation != null && _waypoints.Count > 0)
            {
                _migrationStartDistance = Mathf.Max(0.01f, FlatDistance(
                    _formation.CurrentStarOrigin,
                    _waypoints[_selectedWaypointIndex].Position));
            }
            _travelConsumptionAccumulator = 0f;
            _weatherTimer = 0f;
            ApplyEnvironment();
            UpdateWaypointVisuals();
            UpdateRouteLine();
        }

        public void CycleRoute()
        {
            if (_waypoints.Count <= 1)
            {
                return;
            }

            _selectedWaypointIndex = (_selectedWaypointIndex + 1) % _waypoints.Count;
            if (_selectedWaypointIndex == _currentWaypointIndex)
            {
                _selectedWaypointIndex = (_selectedWaypointIndex + 1) % _waypoints.Count;
            }
            UpdateWaypointVisuals();
        }

        public void StartMigration()
        {
            if (_formation == null || _formation.IsBattleActive || _waypoints.Count == 0)
            {
                return;
            }

            if (Water <= 0 || Feed <= 0)
            {
                _isMigrating = false;
                return;
            }

            var destination = _waypoints[_selectedWaypointIndex].Position;
            _migrationStartDistance = Mathf.Max(0.01f, FlatDistance(_formation.CurrentStarOrigin, destination));
            if (_migrationStartDistance <= arrivalDistance)
            {
                ArriveAtSelectedWaypoint();
                return;
            }

            _isMigrating = true;
            _travelConsumptionAccumulator = 0f;
        }

        public void StopMigration()
        {
            _isMigrating = false;
        }

        public void CollectResources()
        {
            var waypointIndex = FindNearestWaypointIndex(collectDistance);
            if (waypointIndex < 0)
            {
                return;
            }

            var waypoint = _waypoints[waypointIndex];
            if (!waypoint.Available)
            {
                return;
            }

            Water = Mathf.Min(WaterCapacity, Water + waypoint.WaterReward);
            Feed = Mathf.Min(FeedCapacity, Feed + waypoint.FeedReward);
            Herbs = Mathf.Min(HerbCapacity, Herbs + waypoint.HerbReward);
            Wood = Mathf.Min(WoodCapacity, Wood + waypoint.WoodReward);
            Stone = Mathf.Min(StoneCapacity, Stone + waypoint.StoneReward);
            waypoint.Available = false;
            _waypoints[waypointIndex] = waypoint;
            UpdateWaypointVisuals();
        }

        public bool TryConsumeHerbs(int amount)
        {
            var cost = Mathf.Max(0, amount);
            if (cost == 0)
            {
                return true;
            }

            if (Herbs < cost)
            {
                return false;
            }

            Herbs -= cost;
            return true;
        }

        public bool TryConsumeCampResources(int woodCost, int stoneCost, int herbCost)
        {
            var wood = Mathf.Max(0, woodCost);
            var stone = Mathf.Max(0, stoneCost);
            var herbs = Mathf.Max(0, herbCost);
            if (Wood < wood || Stone < stone || Herbs < herbs)
            {
                return false;
            }

            Wood -= wood;
            Stone -= stone;
            Herbs -= herbs;
            return true;
        }

        public bool TryConsumeSupplies(int waterCost, int feedCost)
        {
            var water = Mathf.Max(0, waterCost);
            var feed = Mathf.Max(0, feedCost);
            if (Water < water || Feed < feed)
            {
                return false;
            }

            Water -= water;
            Feed -= feed;
            return true;
        }

        public void AddCampSupplies(int waterAmount, int feedAmount)
        {
            Water = Mathf.Min(WaterCapacity, Water + Mathf.Max(0, waterAmount));
            Feed = Mathf.Min(FeedCapacity, Feed + Mathf.Max(0, feedAmount));
        }

        public void AddResources(int water, int feed, int herbs, int wood, int stone)
        {
            Water = Mathf.Min(WaterCapacity, Water + Mathf.Max(0, water));
            Feed = Mathf.Min(FeedCapacity, Feed + Mathf.Max(0, feed));
            Herbs = Mathf.Min(HerbCapacity, Herbs + Mathf.Max(0, herbs));
            Wood = Mathf.Min(WoodCapacity, Wood + Mathf.Max(0, wood));
            Stone = Mathf.Min(StoneCapacity, Stone + Mathf.Max(0, stone));
        }

        public void ExpandStorage(
            int waterIncrease,
            int feedIncrease,
            int herbIncrease,
            int woodIncrease,
            int stoneIncrease)
        {
            WaterCapacity += Mathf.Max(0, waterIncrease);
            FeedCapacity += Mathf.Max(0, feedIncrease);
            HerbCapacity += Mathf.Max(0, herbIncrease);
            WoodCapacity += Mathf.Max(0, woodIncrease);
            StoneCapacity += Mathf.Max(0, stoneIncrease);
        }

        public void CycleWeatherForTest()
        {
            _weatherIndex = (_weatherIndex + 1) % Enum.GetValues(typeof(PrototypeWeather)).Length;
            _weatherTimer = 0f;
            ApplyEnvironment();
        }

        private void BuildWaypoints()
        {
            var start = _formation != null ? _formation.CurrentStarOrigin : new Vector3(0f, 0f, -5f);
            _waypoints.Clear();
            _waypoints.Add(new WorldWaypoint("Başlangıç Kampı", start, 2, 3, 0, 3, 2, new Color(0.65f, 0.55f, 0.28f)));
            _waypoints.Add(new WorldWaypoint("Su Gözü", start + new Vector3(18f, 0f, 5f), 12, 3, 1, 1, 2, new Color(0.2f, 0.62f, 0.95f)));
            _waypoints.Add(new WorldWaypoint("Şifalı Çayır", start + new Vector3(-16f, 0f, -10f), 4, 9, 7, 2, 1, new Color(0.22f, 0.78f, 0.34f)));
            _waypoints.Add(new WorldWaypoint("Yüksek Otlak", start + new Vector3(9f, 0f, -19f), 5, 14, 2, 4, 3, new Color(0.83f, 0.72f, 0.18f)));
        }

        private void CreateWorldVisuals()
        {
            foreach (var item in _worldVisuals)
            {
                if (item != null)
                {
                    Destroy(item);
                }
            }
            _worldVisuals.Clear();

            var routeObject = new GameObject("Göç Rotası");
            routeObject.transform.SetParent(transform);
            _routeLine = routeObject.AddComponent<LineRenderer>();
            _routeLine.positionCount = 2;
            _routeLine.startWidth = 0.18f;
            _routeLine.endWidth = 0.18f;
            _routeLine.material = CreateMaterial(new Color(0.98f, 0.78f, 0.2f));
            _routeLine.startColor = new Color(1f, 0.82f, 0.2f, 0.9f);
            _routeLine.endColor = new Color(1f, 0.82f, 0.2f, 0.25f);
            _worldVisuals.Add(routeObject);

            for (var index = 0; index < _waypoints.Count; index++)
            {
                var marker = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                marker.name = $"Rota Noktası - {_waypoints[index].Name}";
                marker.transform.SetParent(transform);
                marker.transform.position = _waypoints[index].Position + Vector3.up * 0.12f;
                marker.transform.localScale = new Vector3(1.15f, 0.12f, 1.15f);
                marker.GetComponent<Renderer>().sharedMaterial = CreateMaterial(_waypoints[index].Color);
                _worldVisuals.Add(marker);
                var waypoint = _waypoints[index];
                waypoint.Visual = marker;
                _waypoints[index] = waypoint;
            }

            UpdateWaypointVisuals();
            UpdateRouteLine();
        }

        private void UpdateMigration()
        {
            if (!_isMigrating || _formation == null)
            {
                return;
            }

            // Savaş başladığı anda göç, sürünün bulunduğu yerde durur. Savaş bitince aynı rota devam eder.
            if (_formation.IsBattleActive)
            {
                return;
            }

            if (Water <= 0 || Feed <= 0)
            {
                _isMigrating = false;
                return;
            }

            var destination = _waypoints[_selectedWaypointIndex].Position;
            var speed = migrationSpeed * WorldSimulationMath.GetMigrationSpeedMultiplier(Weather);
            var nextCenter = Vector3.MoveTowards(
                _formation.CurrentStarOrigin,
                destination,
                speed * Time.deltaTime);
            _formation.MoveFormationCenter(nextCenter, true);

            _travelConsumptionAccumulator += Time.deltaTime;
            if (_travelConsumptionAccumulator >= 5f)
            {
                _travelConsumptionAccumulator -= 5f;
                Water = Mathf.Max(0, Water - 1);
                Feed = Mathf.Max(0, Feed - 1);
            }

            if (FlatDistance(_formation.CurrentStarOrigin, destination) <= arrivalDistance)
            {
                ArriveAtSelectedWaypoint();
            }
        }

        private void ArriveAtSelectedWaypoint()
        {
            _formation?.MoveFormationCenter(_waypoints[_selectedWaypointIndex].Position, true);
            _currentWaypointIndex = _selectedWaypointIndex;
            _isMigrating = false;
            UpdateWaypointVisuals();
        }

        private void UpdateClockAndWeather()
        {
            var previousDay = _worldDay;
            _worldHour += 24f / dayLengthSeconds * Time.deltaTime;
            while (_worldHour >= 24f)
            {
                _worldHour -= 24f;
                _worldDay++;
            }

            if (_worldDay != previousDay)
            {
                RegenerateResources();
            }

            _weatherTimer += Time.deltaTime;
            if (_weatherTimer >= weatherDurationSeconds)
            {
                _weatherTimer = 0f;
                _weatherIndex = (_weatherIndex + 1) % Enum.GetValues(typeof(PrototypeWeather)).Length;
            }

            ApplyEnvironment();
        }

        private void RegenerateResources()
        {
            for (var index = 0; index < _waypoints.Count; index++)
            {
                var waypoint = _waypoints[index];
                waypoint.Available = true;
                _waypoints[index] = waypoint;
            }
            UpdateWaypointVisuals();
        }

        private void ApplyEnvironment()
        {
            var daylight = WorldSimulationMath.CalculateDaylight01(_worldHour);
            var weatherLightMultiplier = Weather switch
            {
                PrototypeWeather.Foggy => 0.72f,
                PrototypeWeather.Rainy => 0.58f,
                PrototypeWeather.Windy => 0.9f,
                _ => 1f
            };

            if (_sun != null)
            {
                _sun.intensity = Mathf.Lerp(0.16f, 1.15f, daylight) * weatherLightMultiplier;
                _sun.color = Color.Lerp(new Color(0.38f, 0.45f, 0.68f), new Color(1f, 0.94f, 0.78f), daylight);
                _sun.transform.rotation = Quaternion.Euler(Mathf.Lerp(12f, 62f, daylight), -35f, 0f);
            }

            var ambient = Color.Lerp(new Color(0.08f, 0.11f, 0.19f), new Color(0.55f, 0.56f, 0.58f), daylight);
            if (Weather == PrototypeWeather.Rainy)
            {
                ambient *= 0.72f;
            }
            RenderSettings.ambientLight = ambient;
            RenderSettings.fog = Weather == PrototypeWeather.Foggy || Weather == PrototypeWeather.Rainy;
            RenderSettings.fogColor = Weather == PrototypeWeather.Rainy
                ? new Color(0.23f, 0.28f, 0.31f)
                : new Color(0.5f, 0.55f, 0.58f);
            RenderSettings.fogDensity = Weather == PrototypeWeather.Foggy ? 0.018f : 0.008f;

            if (_camera != null)
            {
                _camera.backgroundColor = Color.Lerp(new Color(0.035f, 0.055f, 0.1f), new Color(0.18f, 0.24f, 0.28f), daylight) * weatherLightMultiplier;
            }
        }

        private void UpdateRouteLine()
        {
            if (_routeLine == null || _formation == null || _waypoints.Count == 0)
            {
                return;
            }

            _routeLine.SetPosition(0, _formation.CurrentStarOrigin + Vector3.up * 0.18f);
            _routeLine.SetPosition(1, _waypoints[_selectedWaypointIndex].Position + Vector3.up * 0.18f);
        }

        private void UpdateWaypointVisuals()
        {
            for (var index = 0; index < _waypoints.Count; index++)
            {
                var waypoint = _waypoints[index];
                if (waypoint.Visual == null)
                {
                    continue;
                }

                var scale = index == _selectedWaypointIndex ? 1.45f : index == _currentWaypointIndex ? 1.25f : 1f;
                waypoint.Visual.transform.localScale = new Vector3(scale, 0.12f, scale);
                var renderer = waypoint.Visual.GetComponent<Renderer>();
                if (renderer != null)
                {
                    renderer.sharedMaterial.color = waypoint.Available ? waypoint.Color : waypoint.Color * 0.35f;
                }
            }
        }

        private int FindNearestWaypointIndex(float maximumDistance)
        {
            if (_formation == null)
            {
                return -1;
            }

            var bestIndex = -1;
            var bestDistance = maximumDistance;
            for (var index = 0; index < _waypoints.Count; index++)
            {
                var distance = FlatDistance(_formation.CurrentStarOrigin, _waypoints[index].Position);
                if (distance < bestDistance)
                {
                    bestDistance = distance;
                    bestIndex = index;
                }
            }
            return bestIndex;
        }

        private string GetCurrentLocationName()
        {
            var nearest = FindNearestWaypointIndex(2.5f);
            return nearest >= 0 ? _waypoints[nearest].Name : "Göç rotası";
        }

        private float CalculateMigrationProgress()
        {
            if (!_isMigrating || _formation == null || _waypoints.Count == 0)
            {
                return 0f;
            }

            var remaining = FlatDistance(_formation.CurrentStarOrigin, _waypoints[_selectedWaypointIndex].Position);
            return Mathf.Clamp01(1f - remaining / Mathf.Max(0.01f, _migrationStartDistance));
        }

        private static float FlatDistance(Vector3 a, Vector3 b)
        {
            a.y = 0f;
            b.y = 0f;
            return Vector3.Distance(a, b);
        }

        private static Material CreateMaterial(Color color)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            return new Material(shader) { color = color };
        }

        private struct WorldWaypoint
        {
            public WorldWaypoint(
                string name,
                Vector3 position,
                int waterReward,
                int feedReward,
                int herbReward,
                int woodReward,
                int stoneReward,
                Color color)
            {
                Name = name;
                Position = position;
                WaterReward = waterReward;
                FeedReward = feedReward;
                HerbReward = herbReward;
                WoodReward = woodReward;
                StoneReward = stoneReward;
                Color = color;
                Available = true;
                Visual = null;
            }

            public string Name;
            public Vector3 Position;
            public int WaterReward;
            public int FeedReward;
            public int HerbReward;
            public int WoodReward;
            public int StoneReward;
            public Color Color;
            public bool Available;
            public GameObject Visual;
        }
    }
}
