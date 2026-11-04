// level.js — Level 1 "First Night" layout data.
// World units are metres. x runs west->east (0..80), y runs north->south (0..130):
// the level starts at the bottom of the map (south) and the clinic is at the top.
// Rects are [x0, y0, x1, y1].

export const MAP_W = 80, MAP_H = 130;

export const ZONES = [
  { id: 'crash', name: 'Crash Site', r: [24, 110, 56, 130] },
  { id: 'rest', name: 'Rest Stop', r: [6, 82, 72, 110] },
  { id: 'overpass', name: 'Overpass', r: [34, 67, 46, 82] },
  { id: 'maple', name: 'Maple Street', r: [8, 27, 74, 67] },
  { id: 'clinic', name: 'Clinic Courtyard', r: [8, 0, 74, 27] },
];

// Walkable floor. Everything not carved is solid (woods, buildings, rubble).
export const CARVE = [
  [24, 118, 56, 128], // highway
  [30, 110, 50, 118], // north shoulder
  [27.5, 82, 52.5, 110], // rest stop lot
  [6, 95, 27.5, 100], // west service road
  [52.5, 85, 72, 90], // east exit road
  [34, 80, 46, 82], // overpass south apron
  [37, 67, 43, 82], // tunnel
  [34, 67, 46, 69], // overpass north apron
  [31, 44, 49, 67], // maple street
  [25, 27, 55, 44], // town square
  [8, 34, 25, 39], // west square alley
  [55, 34, 74, 39], // east square alley
  [12, 52, 31, 55], // west mid alley
  [49, 57, 70, 60], // east mid alley
  [39.5, 26.5, 41, 27], // courtyard south gap
  [28, 3.5, 52, 26.5], // courtyard
  [52, 13, 52.5, 15], // east breach
  [52.5, 6, 72, 22], // east yard
  [29, 3, 31, 3.5], // north breach
  [10, 0.5, 32, 3], // north alley
  [8, 0.5, 11, 39], // west lane
  [38, 0.5, 42, 3], // clinic ambulance bay (behind the gate)
];

// Ground materials (drawn in order; default is overgrown grass).
export const GROUND = [
  ['asphalt', [0, 118, 80, 128]],
  ['dirt', [30, 110, 50, 118]],
  ['concrete', [27.5, 82, 52.5, 110]],
  ['asphalt', [37, 95, 52.5, 110]],
  ['asphalt', [27.5, 93, 52.5, 97]],
  ['asphalt', [6, 95, 27.5, 100]],
  ['asphalt', [52.5, 85, 80, 90]],
  ['asphalt', [37, 60, 43, 82]],
  ['concrete', [34, 67, 46, 69]],
  ['concrete', [34, 80, 46, 82]],
  ['concrete', [25, 27.5, 55, 44]],
  ['concrete', [31, 44, 49, 67]],
  ['asphalt', [34, 44, 46, 67]],
  ['dirt', [8, 34, 25, 39]],
  ['dirt', [55, 34, 74, 39]],
  ['dirt', [12, 52, 31, 55]],
  ['dirt', [49, 57, 70, 60]],
  ['dirt', [8, 0, 11, 39]],
  ['dirt', [10, 0.5, 32, 3]],
  ['concrete', [28, 3.5, 52, 26.5]],
  ['dirt', [52.5, 6, 72, 22]],
  ['tile', [28.5, 83.5, 37, 92.5]],
  ['bus', [33.5, 114.5, 45, 117]],
  ['tile', [44, 97.5, 51.5, 106]],
  ['concrete', [43.5, 72, 45.5, 77]],
  ['tile', [49.5, 47.5, 54.5, 53.5]],
  ['concrete', [38, 0.5, 42, 3]],
];

// Solid buildings drawn with a roof and a south face (height in metres).
export const BUILDINGS = [
  { r: [34, 69, 37, 80], h: 4, kind: 'concrete' },
  { r: [43, 69, 46, 80], h: 4, kind: 'concrete' },
  { r: [25, 44, 31, 52], h: 5, kind: 'brick', sign: { text: 'PAWN', color: '#ff5a3c', side: 'e', at: 47.5 } },
  { r: [25, 55, 31, 67], h: 6, kind: 'brick2', sign: { text: 'HARDWARE', color: '#ffb347', side: 'e', at: 61 } },
  { r: [49, 44, 55, 47], h: 5, kind: 'brick' },
  { r: [49, 54, 55, 57], h: 5, kind: 'brick2' },
  { r: [49, 60, 55, 67], h: 6, kind: 'brick', sign: { text: 'BARBER', color: '#ff7a59', side: 'w', at: 63 } },
  { r: [12, 39, 25, 52], h: 7, kind: 'brick2' },
  { r: [14, 55, 25, 67], h: 6, kind: 'brick' },
  { r: [55, 39, 72, 57], h: 7, kind: 'brick' },
  { r: [55, 60, 72, 67], h: 5, kind: 'brick2' },
  { r: [11, 3, 27.5, 27], h: 6, kind: 'brick' },
  { r: [11, 27, 25, 34], h: 6, kind: 'brick2' },
  { r: [52.5, 22, 55, 27], h: 4, kind: 'brick' },
  { r: [55, 22, 74, 34], h: 6, kind: 'brick2' },
  { r: [52.5, 0, 74, 6], h: 5, kind: 'brick' },
  { r: [55, 10, 58, 18], h: 3, kind: 'shed' },
  { r: [32, 0, 38, 3], h: 7, kind: 'clinic' },
  { r: [42, 0, 52.5, 3], h: 7, kind: 'clinic', sign: { text: 'MAPLE ST CLINIC', color: '#9fd8ff', side: 's', at: 40 } },
];

// Enterable rooms: floor is walkable, walls are solid, roof hides when the player is inside.
export const ROOMS = [
  {
    id: 'bus', r: [33, 114, 45.5, 117.5], h: 3, kind: 'bus',
    doors: [['s', 41, 42.5]],
  },
  {
    id: 'store', r: [28, 83, 37.5, 93], h: 4, kind: 'store',
    doors: [['e', 88, 90]],
    inner: [[32, 83, 32.5, 88, 'office'], [28, 87.5, 32.5, 88]],
    sign: { text: 'GAS  FOOD', color: '#ff8c32', side: 's', at: 32.5 },
  },
  {
    id: 'diner', r: [43.5, 97, 52, 106.5], h: 4, kind: 'diner',
    doors: [['w', 100, 102]],
    sign: { text: 'DINER', color: '#ff4f9a', side: 'w', at: 99 },
  },
  {
    id: 'maint', r: [43, 71.5, 46, 77.5], h: 4, kind: 'concrete', noRoofDraw: true,
    doors: [['w', 74, 75.5]],
  },
  {
    id: 'shop', r: [49, 47, 55, 54], h: 5, kind: 'shop',
    doors: [['w', 49.5, 51.5]],
    sign: { text: 'GROCER', color: '#5ad1ff', side: 'w', at: 48 },
  },
];

// Thin walls: [x0,y0,x1,y1, kind]
export const WALLS = [
  // courtyard
  [27.5, 3, 29, 3.5, 'brick'], [31, 3, 38, 3.5, 'brick'], [42, 3, 52.5, 3.5, 'brick'],
  [27.5, 3, 28, 27, 'brick'], [52, 3, 52.5, 13, 'brick'], [52, 15, 52.5, 27, 'brick'],
  [27.5, 26.5, 39.5, 27, 'brick'], [41, 26.5, 52.5, 27, 'brick'],
  // rest stop guard rail between highway shoulder and lot (with a gap)
  [30, 109.8, 37, 110.2, 'rail'], [43.5, 109.8, 50, 110.2, 'rail'],
];

// Dynamic doors (solid until opened)
export const DOORS = [
  { id: 'office', r: [32, 85, 32.5, 86.5], kind: 'door' },
  { id: 'gate', r: [38, 3, 42, 3.5], kind: 'gate' },
];

// Props: solid ones block movement (and bullets); `see` = also blocks sight.
export const PROPS = [
  // crash site
  { k: 'car', r: [22, 119, 26, 121], color: '#5a5f66', rot: 0.2, burned: true },
  { k: 'car', r: [22.5, 123.5, 26.5, 125.5], color: '#6b4a3a', rot: -0.15 },
  { k: 'truck', r: [54, 119, 58, 127], color: '#7a7466', rot: 0.08, see: true },
  { k: 'car', r: [47, 120.5, 51, 122.5], color: '#3e5566', rot: 0.35 },
  { k: 'jersey', r: [23.5, 118, 24, 128] }, { k: 'jersey', r: [56, 118, 56.5, 128] },
  { k: 'seat', r: [34, 114.6, 35, 115.4], noSolid: true }, { k: 'seat', r: [36, 114.6, 37, 115.4], noSolid: true },
  { k: 'seat', r: [38, 114.6, 39, 115.4], noSolid: true }, { k: 'seat', r: [40, 114.6, 41, 115.4], noSolid: true },
  { k: 'seat', r: [34, 116.2, 35, 117], noSolid: true }, { k: 'seat', r: [36, 116.2, 37, 117], noSolid: true },
  { k: 'seat', r: [43, 114.6, 44, 115.4], noSolid: true }, { k: 'seat', r: [43, 116.2, 44, 117], noSolid: true },
  // rest stop
  { k: 'pump', r: [42, 90, 43, 91] }, { k: 'pump', r: [42, 92.5, 43, 93.5] },
  { k: 'pump', r: [46.5, 90, 47.5, 91] }, { k: 'pump', r: [46.5, 92.5, 47.5, 93.5] },
  { k: 'canopy', r: [40, 88, 49.5, 95], noSolid: true },
  { k: 'shelf', r: [33.5, 89.5, 36, 90.5] }, { k: 'shelf', r: [33.5, 91.5, 36, 92] },
  { k: 'counter', r: [33.5, 83.5, 37, 84.5] },
  { k: 'shelf', r: [28.5, 89, 29, 92.5] },
  { k: 'desk', r: [28.5, 86, 30, 87.5] },
  { k: 'booth', r: [49.5, 98, 51.5, 99] }, { k: 'booth', r: [49.5, 100.5, 51.5, 101.5] }, { k: 'booth', r: [49.5, 103, 51.5, 104] },
  { k: 'counter', r: [45, 104.5, 48.5, 105.5] },
  { k: 'car', r: [29, 101, 33, 103], color: '#7a3d35', rot: 0.05 },
  { k: 'car', r: [29, 105, 31, 109], color: '#45566b', rot: -0.04, vertical: true },
  { k: 'car', r: [37.5, 100, 39.5, 104], color: '#69705a', rot: 0.1, vertical: true },
  { k: 'car', r: [47.5, 83, 51.5, 85], color: '#4a4f57', rot: 0 },
  { k: 'car', r: [60, 86.5, 64, 88.5], color: '#8b6b2e', rot: 0, alarm: 'rest' },
  { k: 'dumpster', r: [50.5, 107, 52.5, 109] },
  { k: 'barrel', r: [38, 84, 39, 85] },
  { k: 'car', r: [44, 80, 46, 82], color: '#3a3a3a', burned: true, fire: true, vertical: true },
  // overpass rubble inside tunnel (cover)
  { k: 'rubble', r: [37.5, 76.5, 39, 77.5] }, { k: 'rubble', r: [41.5, 71, 43, 72] },
  { k: 'barrel', r: [34.5, 67.5, 35.5, 68.5], fire: true },
  // maple street
  { k: 'car', r: [33, 61.5, 35, 65.5], color: '#5b6b75', rot: -0.06, vertical: true },
  { k: 'car', r: [44, 58, 46, 62], color: '#7b2f2f', rot: 0.12, vertical: true },
  { k: 'car', r: [35.5, 52, 39.5, 54], color: '#3d4a3a', rot: 0.25, burned: true, fire: true },
  { k: 'car', r: [42, 47, 44, 51], color: '#6a6f73', rot: -0.1, vertical: true },
  { k: 'car', r: [32, 45, 34, 49], color: '#40506a', rot: 0.03, vertical: true },
  { k: 'bench', r: [31.5, 56, 32.5, 58] },
  { k: 'statue', r: [39, 33, 41, 35], see: true },
  { k: 'car', r: [44, 37.5, 46, 41.5], color: '#9a8a3a', vertical: true, alarm: 'square' },
  { k: 'car', r: [29, 36.5, 33, 38.5], color: '#56606b', rot: 0.08 },
  { k: 'car', r: [48, 30, 52, 32], color: '#6d4f6b', rot: -0.1 },
  { k: 'dumpster', r: [26, 41, 28, 43] },
  { k: 'ambulance', r: [33, 27.5, 39.5, 29.5], color: '#d8d8d0', noSolid: true },
  // clinic
  { k: 'generator', r: [39.5, 13, 41, 14.5] },
  { k: 'crates', r: [44, 20, 46, 21.5] }, { k: 'crates', r: [34, 17, 35.5, 19] },
  { k: 'barrier', r: [46, 10, 49, 10.5] },
  { k: 'barrel', r: [30, 13.5, 31, 14.5] },
];

// Fixed light sources (the flashlight is added by the game).
export const LIGHTS = [
  { x: 32.5, y: 115.5, r: 7, c: [255, 140, 50], f: 'fire' },
  { x: 44.5, y: 121, r: 4.5, c: [255, 60, 50], f: 'flare' },
  { x: 42.5, y: 91.5, r: 6.5, c: [200, 225, 255], f: 'tube' },
  { x: 47, y: 91.5, r: 6.5, c: [200, 225, 255], f: 'tube2' },
  { x: 32.5, y: 93.5, r: 5, c: [255, 140, 50], f: 'neon' },
  { x: 43, y: 99, r: 5, c: [255, 80, 160], f: 'neon' },
  { x: 30.2, y: 85.6, r: 3.5, c: [255, 200, 130], f: 'steady' },
  { x: 45, y: 81, r: 6, c: [255, 130, 40], f: 'fire' },
  { x: 40, y: 74.5, r: 5, c: [255, 170, 70], f: 'tube' },
  { x: 35, y: 68, r: 5, c: [255, 140, 50], f: 'fire' },
  { x: 37.5, y: 53, r: 6.5, c: [255, 130, 40], f: 'fire' },
  { x: 32, y: 59, r: 6, c: [190, 210, 255], f: 'tube' },
  { x: 48, y: 50.5, r: 5, c: [90, 200, 255], f: 'neon' },
  { x: 31.5, y: 47.5, r: 5, c: [255, 90, 60], f: 'neon' },
  { x: 40, y: 31, r: 7, c: [255, 200, 120], f: 'tube2' },
  { x: 40, y: 4.2, r: 4, c: [255, 40, 40], f: 'flare' },
  { x: 40, y: 13.6, r: 3, c: [255, 180, 80], f: 'steady' },
  // clinic floodlights: only lit once the generator is running
  { x: 29.5, y: 5, r: 10, c: [220, 235, 255], f: 'flood', flood: true },
  { x: 50.5, y: 5, r: 10, c: [220, 235, 255], f: 'flood', flood: true },
  { x: 29.5, y: 25, r: 10, c: [220, 235, 255], f: 'flood', flood: true },
  { x: 50.5, y: 25, r: 10, c: [220, 235, 255], f: 'flood', flood: true },
];

// Decals hint at the route: blood trails, debris, cracks, oil.
export const DECALS = [
  ['trail', 46, 112, 42, 104], ['trail', 40, 99, 38, 92], ['trail', 39, 86, 40, 79], ['trail', 40, 70, 39, 61],
  ['trail', 41, 45, 40, 36], ['trail', 40, 30, 40.2, 25],
  ['blood', 47, 111, 1.2], ['blood', 34.5, 111.5, 0.8], ['blood', 41.5, 104, 1], ['blood', 30, 86, 0.7], ['blood', 40, 76, 1.4],
  ['blood', 33.5, 60, 1.1], ['blood', 41, 35, 1.6], ['blood', 44, 15, 0.9],
  ['oil', 47, 92, 1.5], ['oil', 36, 104, 1.2], ['oil', 41, 57, 1.8], ['oil', 25, 122, 2],
  ['debris', 36, 120, 2.5], ['debris', 40, 112.5, 2], ['debris', 44, 86, 1.5], ['debris', 40, 78, 2.5], ['debris', 39.5, 70, 2],
  ['debris', 37, 50, 2.5], ['debris', 46, 41, 2], ['debris', 34, 24, 1.5], ['debris', 50, 18, 1.5],
  ['glass', 37.6, 89, 1], ['glass', 32.2, 85.8, 0.6], ['glass', 49.2, 50.5, 1],
  ['crack', 30, 124, 4], ['crack', 50, 125, 3], ['crack', 40, 64, 3], ['crack', 38, 40, 4], ['crack', 45, 85, 3],
];

// Road markings: [x0,y0,x1,y1, color, dashed]
export const MARKS = [
  [0, 123, 80, 123, '#c9a640', true], [0, 118.6, 80, 118.6, '#bdbdb0', false], [0, 127.4, 80, 127.4, '#bdbdb0', false],
  [40, 44, 40, 82, '#c9a640', true],
  [6, 97.5, 27.5, 97.5, '#bdbdb0', true],
  [29, 98, 29, 100.5, '#bdbdb0', false], [33, 98, 33, 100.5, '#bdbdb0', false], [29, 103.5, 33, 103.5, '#bdbdb0', false],
  [33, 103.5, 33, 109.5, '#bdbdb0', false],
];

// Walk-over pickups. amount is per pickup.
export const PICKUPS = [
  { id: 'p_band1', k: 'bandage', x: 48.5, y: 116.5 },
  { id: 'p_scrap1', k: 'scrap', x: 31, y: 112 },
  { id: 'p_pistol', k: 'pistol', x: 35, y: 86.3 },
  { id: 'p_ammo1', k: 'ammo', x: 30, y: 91.5 },
  { id: 'p_ammo2', k: 'ammo', x: 39.3, y: 96.6 },
  { id: 'p_med1', k: 'medkit', x: 46.5, y: 98.6 },
  { id: 'p_key', k: 'key', x: 29.5, y: 84.6 },
  { id: 'p_scrap2', k: 'scrap', x: 51.5, y: 96.5 },
  { id: 'p_scrap3', k: 'scrap', x: 28.6, y: 109.2 },
  { id: 'p_scrap4', k: 'scrap', x: 10.5, y: 97.5 },
  { id: 'p_ammo3', k: 'ammo', x: 35.5, y: 81.2 },
  { id: 'p_band2', k: 'bandage', x: 42.3, y: 69.8 },
  { id: 'p_scrap5', k: 'scrap', x: 36, y: 67.8 },
  { id: 'p_shotgun', k: 'shotgun', x: 40, y: 64.5 },
  { id: 'p_ammo4', k: 'ammo', x: 33.5, y: 59.8 },
  { id: 'p_ammo5', k: 'ammo', x: 47.2, y: 52.5 },
  { id: 'p_ammo6', k: 'ammo', x: 27, y: 40 },
  { id: 'p_shell1', k: 'shells', x: 32.2, y: 50 },
  { id: 'p_shell2', k: 'shells', x: 53, y: 40 },
  { id: 'p_med2', k: 'medkit', x: 36, y: 30.5 },
  { id: 'p_scrap6', k: 'scrap', x: 30, y: 30.5 },
  { id: 'p_scrap7', k: 'scrap', x: 54, y: 43 },
  { id: 'p_scrap8', k: 'scrap', x: 46.5, y: 65.5 },
  { id: 'p_crate', k: 'crate', x: 33.5, y: 7 },
  { id: 'p_med3', k: 'medkit', x: 47, y: 7.5 },
  { id: 'p_med4', k: 'medkit', x: 31, y: 23 },
  { id: 'p_scrap9', k: 'scrap', x: 29, y: 25.6 },
];

// Hold-to-interact objects.
export const INTERACTS = [
  { id: 'crowbar', k: 'crowbar', x: 47, y: 111.2, label: 'Pick up crowbar' },
  { id: 'office', k: 'door', x: 32.25, y: 85.75, label: 'Open door' },
  { id: 'cache_diner', k: 'cache', x: 50.8, y: 105.4, label: 'Search supply cache' },
  { id: 'cache_maint', k: 'cache', x: 44.6, y: 72.8, label: 'Search supply cache' },
  { id: 'cache_shop', k: 'cache', x: 53.6, y: 52.6, label: 'Search supply cache' },
  { id: 'generator', k: 'generator', x: 40.25, y: 13.75, label: 'Start generator' },
];

// Dormant enemies placed in the world. `group` lets triggers wake them together.
export const PLACED = [
  { id: 'w_crash', t: 'walker', x: 35, y: 111.4, pose: 'sit', face: 0.5, zone: 'crash', group: 'crash', at: 'start' },
  { id: 'w_pumpA', t: 'walker', x: 44.6, y: 89.2, pose: 'stand', face: 2, zone: 'rest', group: 'pumps', at: 'start' },
  { id: 'w_pumpB', t: 'walker', x: 45, y: 95.2, pose: 'stand', face: 1.6, zone: 'rest', group: 'pumps', at: 'start' },
  { id: 'w_pumpC', t: 'walker', x: 41.5, y: 95.6, pose: 'sit', face: 1.2, zone: 'rest', group: 'pumps', at: 'start' },
  { id: 'w_dinerA', t: 'walker', x: 41.2, y: 101.6, pose: 'sit', face: 1.3, zone: 'rest', group: 'diner', at: 'start' },
  { id: 'w_dinerB', t: 'walker', x: 36, y: 106, pose: 'stand', face: 0.9, zone: 'rest', group: 'diner', at: 'start' },
  { id: 'w_ovA', t: 'walker', x: 38.5, y: 80.6, pose: 'stand', face: 1.57, zone: 'overpass', at: 'start' },
  { id: 'w_ovB', t: 'walker', x: 42, y: 79.2, pose: 'sit', face: 1.9, zone: 'overpass', at: 'start' },
  { id: 'w_ovC', t: 'walker', x: 39.2, y: 75.5, pose: 'sit', face: 1.57, zone: 'overpass', at: 'start' },
  { id: 'w_ovD', t: 'walker', x: 41.6, y: 73, pose: 'stand', face: 1.4, zone: 'overpass', at: 'start' },
  { id: 'w_ovE', t: 'walker', x: 38, y: 68.4, pose: 'stand', face: 1.57, zone: 'overpass', at: 'start' },
  { id: 'w_ovF', t: 'walker', x: 42.2, y: 67.6, pose: 'sit', face: 2.2, zone: 'overpass', at: 'start' },
  { id: 'w_mA', t: 'walker', x: 31.8, y: 61, pose: 'sit', face: 0.3, zone: 'maple', at: 'key' },
  { id: 'w_mB', t: 'walker', x: 47.5, y: 56.5, pose: 'stand', face: 2.4, zone: 'maple', at: 'key' },
  { id: 'w_mC', t: 'walker', x: 32, y: 51.5, pose: 'stand', face: 1, zone: 'maple', at: 'key' },
  { id: 'w_mD', t: 'walker', x: 47.8, y: 46, pose: 'sit', face: 2.2, zone: 'maple', at: 'key' },
  { id: 'w_mE', t: 'walker', x: 27.5, y: 33, pose: 'sit', face: 0.8, zone: 'maple', at: 'key' },
  { id: 'w_mF', t: 'walker', x: 53, y: 29, pose: 'stand', face: 2, zone: 'maple', at: 'key' },
];

// Spawn candidate points for scripted waves (validated at spawn time: >= 18 m and out of sight).
export const SPAWNS = {
  restWest: [[8, 97.5], [11, 96.5], [14, 98.5], [17, 97]],
  restEast: [[70, 87.5], [67, 88.5], [65.5, 86.5]],
  mapleWestMid: [[13.5, 53.5], [17, 53.5], [20, 53]],
  mapleEastMid: [[68, 58.5], [64, 58.5], [61, 59]],
  squareWest: [[9.5, 36.5], [13, 36.5], [17, 35.5], [20, 37.5]],
  squareEast: [[72, 36.5], [68.5, 36.5], [65, 35.5], [62, 37.5]],
  westLane: [[9.5, 8], [9.5, 15], [9.5, 22], [9.5, 29]],
  northAlley: [[12, 1.75], [15.5, 1.75], [19, 1.75], [9.5, 4]],
  eastYard: [[69, 8], [70, 19.5], [66, 20.5], [65, 7.5], [62, 21]],
};

// Hold-out breach points and the spawn pools that feed them.
export const BREACH = {
  east: { x: 52.25, y: 14, pools: ['eastYard'] },
  south: { x: 40.25, y: 27, pools: ['squareWest', 'squareEast'] },
  north: { x: 30, y: 3.25, pools: ['northAlley', 'westLane'] },
};

export const START = { x: 37.5, y: 115.8, face: -Math.PI / 2 };
export const CHECKPOINT_POS = { x: 30.6, y: 85.8 };
export const HOLDOUT_POS = { x: 40.25, y: 16 };
export const GATE_EXIT_Y = 2.2;
export const COURTYARD = [28, 3.5, 52, 26.5];
