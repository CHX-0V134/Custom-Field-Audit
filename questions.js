// Single source of truth for the audit form.
// Both the entry form and the history view render from this config.
// Toggle items are tri-state: "pass" | "fail" | "na" (unset = not answered).
// To change a question, edit the label. To add/remove, edit the items.
// Keep `key` values stable — they are how answers are stored in the DB.

const AUDIT_SECTIONS = [
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
      { key: "well_marked_on_label", label: "Well number is marked on label", type: "toggle" },
      { key: "sds_current", label: "SDS dry, legible and current", type: "toggle" },
    ],
  },
  {
    id: "tubing_connections",
    title: "Tubing & Connections",
    items: [
      { key: "no_leaks_tank_pump", label: "No leaks between tank and pump", type: "toggle" },
      { key: "sight_glass_ok", label: "Sight glass visible, operable, and isolated", type: "toggle" },
      { key: "pump_injecting", label: "Pump is injecting (if on)", type: "toggle" },
      { key: "injection_line_no_leaks", label: "Walked injection line — no leaks", type: "toggle" },
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
    id: "injection_notes",
    title: "Injection Notes",
    items: [
      { key: "chemical_product_name", label: "Chemical product name", type: "text", placeholder: "e.g. Methanol, Scale inhibitor X" },
      { key: "current_inventory_volume", label: "Current inventory volume", type: "number", unit: "gal" },
      { key: "last_known_injection_rate", label: "Last known injection rate (from service report)", type: "text", placeholder: "e.g. 2.5 qt/day" },
      { key: "current_injection_rate", label: "Current injection rate", type: "text", placeholder: "e.g. 2.5 qt/day" },
      { key: "psv_functioning", label: "PSV is functioning properly", type: "toggle" },
    ],
  },
];

// Flat lookup of every item by key, for the history renderer.
const ITEM_BY_KEY = Object.fromEntries(
  AUDIT_SECTIONS.flatMap((s) => s.items.map((i) => [i.key, { ...i, section: s.title }]))
);

window.AUDIT_SECTIONS = AUDIT_SECTIONS;
window.ITEM_BY_KEY = ITEM_BY_KEY;
