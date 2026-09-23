using UnityEngine;

namespace Bozkurt.Gameplay.Camps
{
    public readonly struct CampBuildingProfile
    {
        public CampBuildingProfile(
            CampBuildingType type,
            string displayName,
            int woodCost,
            int stoneCost,
            int herbCost,
            PrimitiveType primitive,
            Vector3 scale,
            Color color)
        {
            Type = type;
            DisplayName = displayName;
            WoodCost = woodCost;
            StoneCost = stoneCost;
            HerbCost = herbCost;
            Primitive = primitive;
            Scale = scale;
            Color = color;
        }

        public CampBuildingType Type { get; }
        public string DisplayName { get; }
        public int WoodCost { get; }
        public int StoneCost { get; }
        public int HerbCost { get; }
        public PrimitiveType Primitive { get; }
        public Vector3 Scale { get; }
        public Color Color { get; }
    }

    public static class CampBuildingCatalog
    {
        public static CampBuildingProfile Get(CampBuildingType type)
        {
            return type switch
            {
                CampBuildingType.HealingArea => new CampBuildingProfile(
                    type,
                    "İyileştirme Alanı",
                    2,
                    1,
                    1,
                    PrimitiveType.Cylinder,
                    new Vector3(1.7f, 0.18f, 1.7f),
                    new Color(0.2f, 0.72f, 0.42f)),
                CampBuildingType.SupplyDepot => new CampBuildingProfile(
                    type,
                    "Erzak Deposu",
                    3,
                    2,
                    0,
                    PrimitiveType.Cube,
                    new Vector3(1.8f, 1.2f, 1.45f),
                    new Color(0.5f, 0.31f, 0.15f)),
                CampBuildingType.WaterTrough => new CampBuildingProfile(
                    type,
                    "Su ve Yem Oluğu",
                    2,
                    1,
                    0,
                    PrimitiveType.Cube,
                    new Vector3(2.1f, 0.48f, 0.85f),
                    new Color(0.2f, 0.58f, 0.85f)),
                CampBuildingType.Shelter => new CampBuildingProfile(
                    type,
                    "Sürü Korunağı",
                    4,
                    2,
                    0,
                    PrimitiveType.Capsule,
                    new Vector3(1.7f, 1.05f, 2.1f),
                    new Color(0.68f, 0.54f, 0.3f)),
                _ => new CampBuildingProfile(
                    CampBuildingType.WatchPost,
                    "Gözcü Noktası",
                    3,
                    3,
                    0,
                    PrimitiveType.Cylinder,
                    new Vector3(0.85f, 2.2f, 0.85f),
                    new Color(0.46f, 0.48f, 0.5f))
            };
        }

        public static CampBuildingType Next(CampBuildingType current)
        {
            var next = (int)current + 1;
            return next > (int)CampBuildingType.WatchPost
                ? CampBuildingType.HealingArea
                : (CampBuildingType)next;
        }
    }
}
