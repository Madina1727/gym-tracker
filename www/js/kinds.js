// Equipment kinds, the numbers each one records, and muscle groups.
export const FIELDS = {
  minutes:    { label: "Time",       unit: "min",   step: 1 },
  distance:   { label: "Distance",   unit: "dist",  step: 0.01 },
  speed:      { label: "Speed",      unit: "speed", step: 0.1 },
  incline:    { label: "Incline",    unit: "%",     step: 0.5 },
  resistance: { label: "Resistance", unit: "level", step: 1 },
  floors:     { label: "Floors",     unit: "floors",step: 1 },
  steps:      { label: "Steps",      unit: "steps", step: 1 },
  calories:   { label: "Calories",   unit: "kcal",  step: 1 },
};
export const KINDS = {
  treadmill:  { label: "Treadmill",        group: "cardio",   icon: "footprints",  fields: ["minutes", "distance", "speed", "incline", "calories"] },
  stair:      { label: "Stair climber",    group: "cardio",   icon: "chart-no-axes-column-increasing", fields: ["minutes", "floors", "steps", "calories"] },
  bike:       { label: "Bike",             group: "cardio",   icon: "bike",        fields: ["minutes", "distance", "speed", "resistance", "calories"] },
  elliptical: { label: "Elliptical",       group: "cardio",   icon: "orbit",       fields: ["minutes", "distance", "resistance", "calories"] },
  rower:      { label: "Rowing machine",   group: "cardio",   icon: "waves",       fields: ["minutes", "distance", "calories"] },
  cardio:     { label: "Other cardio",     group: "cardio",   icon: "heart-pulse", fields: ["minutes", "distance", "calories"] },
  machine:    { label: "Strength machine", group: "strength", icon: "dumbbell" },
  free:       { label: "Free weights",     group: "strength", icon: "weight" },
  cable:      { label: "Cable station",    group: "strength", icon: "cable" },
  bodyweight: { label: "Bodyweight",       group: "strength", icon: "person-standing" },
};
export const isCardio = (kind) => KINDS[kind]?.group === "cardio";
export const kindOf = (k) => KINDS[k] || KINDS.machine;
/** Which numbers a target can be set for: the first three for cardio keep the planner simple. */
export const targetFields = (kind) => isCardio(kind) ? kindOf(kind).fields.filter((f) => ["minutes", "distance", "floors", "calories", "speed", "incline", "resistance"].includes(f)) : [];

export const MUSCLES = ["Glutes", "Quads", "Hamstrings", "Calves", "Hip adductors", "Hip abductors", "Chest", "Back", "Lats", "Shoulders", "Biceps", "Triceps", "Forearms", "Core", "Lower back", "Heart and lungs"];
