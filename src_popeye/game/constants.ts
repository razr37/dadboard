import { Dimensions } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

export const GW = SW;
export const GH = SH * 0.62;

export const LCD_GREEN  = '#8fad5a';
export const LCD_DARK   = '#1a2a00';
export const LCD_MID    = '#4a6a20';
export const LCD_SHADOW = '#6a8840';
export const GOLD       = '#c8a035';
export const DARK_GOLD  = '#a07820';

export const CW = GW * 0.075;
export const CH = GW * 0.075;

export const FLOORS = [
  { y: GH * 0.78, x1: GW * 0.05, x2: GW * 0.95 },
  { y: GH * 0.54, x1: GW * 0.17, x2: GW * 0.83 },
  { y: GH * 0.30, x1: GW * 0.29, x2: GW * 0.71 },
];

export const LADDERS = [
  { x: GW * 0.21, y1: FLOORS[1].y, y2: FLOORS[0].y },
  { x: GW * 0.79, y1: FLOORS[1].y, y2: FLOORS[0].y },
  { x: GW * 0.33, y1: FLOORS[2].y, y2: FLOORS[1].y },
  { x: GW * 0.67, y1: FLOORS[2].y, y2: FLOORS[1].y },
];
