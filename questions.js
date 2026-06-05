// Single source of truth for the audit form, split into the two levels:
//   TANK_SECTIONS  — filled ONCE per visit (shared by every well on the tank)
//   WELL_SECTIONS  — filled per well (repeats for each well on the tank)
// Toggle items are tri-state: "pass" | "fail" | "na" (unset = not answered).
// Keep `key` values stable and unique across both lists — they're the DB keys.

const TANK_SECTIONS = [
  {
    id: "tank_integrity",
    title: "Tank Integrity",
    items: [
      { key: "no_cracks", label: "No cracks", type: "toggle" },
      { key: "good_visibility", label: "Good visibility (can see the amount clearly)", type: "toggle" },
      { key: "no_deformations", label: "No deformations", type: "toggle" },
      { key: "lid_on_properly", label: "Lid / cover is on properly", type: "toggle" },
    ],
  },
  {
    id: "label_sds",
    title: "Label & SDS",
    items: [
      { key: "name_visible", label: "Name is fully visible", type: "toggle" },
      { key: "single_correct_label", label: "Only one label (correct label for delivery)", type: "toggle" },
      { key: "sds_current", label: "SDS dry, legible and current", type: "toggle" },
    ],
  },
  {
    id: "containment",
    title: "Containment",
    items: [
      { key: "no_holes_cracks", label: "No holes or cracks", type: "toggle" },
      { key: "no_excess_fluid", label: "No excess fluid", type: "toggle" },
    ],
  },
  {
    id: "electrical",
    title: "Electrical Checks",
    items: [
      { key: "grounded_no_corrosion", label: "Grounded properly, no rust or corrosion", type: "toggle" },
      { key: "batteries_charging", label: "Batteries are charging", type: "toggle" },
      { key: "no_liquid_battery_box", label: "No liquid in battery box", type: "toggle" },
      { key: "no_snow_solar", label: "No snow on solar panels", type: "toggle" },
    ],
  },
  {
    id: "chemical",
    title: "Chemical & Inventory",
    items: [
      { key: "chemical_product_name", label: "Chemical product name", type: "select", placeholder: "Select product…" },
      { key: "current_inventory_volume", label: "Current inventory volume", type: "number", unit: "gal" },
    ],
  },
];

const WELL_SECTIONS = [
  {
    id: "tubing",
    title: "Tubing & Connections",
    items: [
      { key: "no_leaks_tank_pump", label: "No leaks between tank and pump", type: "toggle" },
      { key: "sight_glass_ok", label: "Sight glass visible, operable, and isolated", type: "toggle" },
      { key: "pump_injecting", label: "Pump is injecting (if on)", type: "toggle" },
      { key: "injection_line_no_leaks", label: "Walked injection line — no leaks", type: "toggle" },
    ],
  },
  {
    id: "injection",
    title: "Injection",
    items: [
      { key: "last_known_injection_rate", label: "Last known injection rate (from service report)", type: "text", inputmode: "decimal", placeholder: "e.g. 2.5" },
      { key: "current_injection_rate", label: "Current injection rate", type: "text", inputmode: "decimal", placeholder: "e.g. 2.5" },
      { key: "psv_functioning", label: "PSV is functioning properly", type: "toggle" },
    ],
  },
  {
    id: "well_label",
    title: "Marking",
    items: [
      { key: "well_marked_on_label", label: "Well number is marked on label", type: "toggle" },
    ],
  },
];

const ITEM_BY_KEY = Object.fromEntries(
  [...TANK_SECTIONS, ...WELL_SECTIONS].flatMap((s) => s.items.map((i) => [i.key, { ...i, section: s.title }]))
);

window.TANK_SECTIONS = TANK_SECTIONS;
window.WELL_SECTIONS = WELL_SECTIONS;
window.ITEM_BY_KEY = ITEM_BY_KEY;
