import React from 'react';
import { Canvas, Rect, RoundedRect, Circle, Path, Skia, Group } from '@shopify/react-native-skia';
import { GameState } from '../game/logic';
import { GW, GH, CW, CH, FLOORS, LADDERS, LCD_GREEN, LCD_DARK, LCD_MID, LCD_SHADOW } from '../game/constants';

export default function GameRenderer({ gs }: { gs: GameState }) {
  return (
    <Canvas style={{ width: GW, height: GH }}>
      <Rect x={0} y={0} width={GW} height={GH} color={LCD_GREEN} />
      {Array.from({ length: Math.floor(GH/3) }).map((_,i) => <Rect key={i} x={0} y={i*3} width={GW} height={1} color="rgba(0,0,0,0.035)" />)}
      {FLOORS.map((fl,i) => <Group key={i}><Rect x={fl.x1} y={fl.y} width={fl.x2-fl.x1} height={5} color={LCD_DARK} /><Rect x={fl.x1} y={fl.y+5} width={fl.x2-fl.x1} height={2} color={LCD_SHADOW} /></Group>)}
      {LADDERS.map((lad,i) => (
        <Group key={i}>
          <Rect x={lad.x-2} y={lad.y1} width={2} height={lad.y2-lad.y1} color={LCD_MID} />
          <Rect x={lad.x+CW*0.5} y={lad.y1} width={2} height={lad.y2-lad.y1} color={LCD_MID} />
          {Array.from({ length: Math.floor((lad.y2-lad.y1)/10) }).map((_,j) => <Rect key={j} x={lad.x-2} y={lad.y1+j*10} width={CW*0.7} height={2} color={LCD_MID} />)}
        </Group>
      ))}
      {gs.spinachCan && <Group><RoundedRect x={gs.spinachCan.x} y={gs.spinachCan.y} width={CW*0.85} height={CH*0.9} r={3} color={`rgba(0,140,0,${0.55+Math.sin(gs.spinachCan.pulse)*0.45})`} /><Rect x={gs.spinachCan.x+2} y={gs.spinachCan.y+3} width={CW*0.6} height={CH*0.6} color={LCD_DARK} /></Group>}
      {gs.hearts.map(h => <Heart key={h.id} x={h.x} y={h.y} />)}
      {gs.projectiles.map(p => <Group key={p.id}><Circle cx={p.x} cy={p.y} r={CW*0.3} color="#334466" /><Circle cx={p.x} cy={p.y} r={CW*0.13} color="#99aacc" /></Group>)}
      <Olive x={gs.olive.x} y={gs.olive.y} />
      <Bluto x={gs.bluto.x} y={gs.bluto.y} angry={gs.bluto.angry>0} />
      <Popeye x={gs.popeye.x} y={gs.popeye.y} facing={gs.popeye.facing} punch={gs.popeye.punch} spinach={gs.spinachActive} frame={gs.frame} invincible={gs.popeye.invincible>0} />
      {gs.spinachActive && <Group><Rect x={GW*0.3} y={GH-14} width={GW*0.4} height={5} color="rgba(0,0,0,0.25)" /><Rect x={GW*0.3} y={GH-14} width={GW*0.4*(gs.spinachTimer/300)} height={5} color="#44ee44" /></Group>}
    </Canvas>
  );
}

function Heart({ x, y }: { x: number; y: number }) {
  const s = CW*0.6;
  const path = Skia.Path.Make();
  path.moveTo(x+s*0.5, y+s*0.3);
  path.cubicTo(x+s*0.5, y, x+s, y, x+s, y+s*0.38);
  path.cubicTo(x+s, y+s*0.65, x+s*0.5, y+s*0.88, x+s*0.5, y+s);
  path.cubicTo(x+s*0.5, y+s*0.88, x, y+s*0.65, x, y+s*0.38);
  path.cubicTo(x, y, x+s*0.5, y, x+s*0.5, y+s*0.3);
  return <Path path={path} color="#cc2244" />;
}

function Popeye({ x, y, facing, punch, spinach, frame, invincible }: { x:number;y:number;facing:number;punch:number;spinach:boolean;frame:number;invincible:boolean }) {
  if (invincible && Math.floor(frame/4)%2===0) return null;
  const col = spinach ? (frame%6<3 ? '#22aa22' : LCD_DARK) : LCD_DARK;
  return (
    <Group>
      <Rect x={x+CW*0.1} y={y-CH*0.1} width={CW*0.8} height={CH*0.12} color={col} />
      <RoundedRect x={x+CW*0.18} y={y+CH*0.02} width={CW*0.64} height={CH*0.38} r={4} color={col} />
      <Rect x={x+CW*0.14} y={y+CH*0.38} width={CW*0.72} height={CH*0.42} color={col} />
      <Rect x={x+CW*0.14} y={y+CH*0.78} width={CW*0.26} height={CH*0.22} color={col} />
      <Rect x={x+CW*0.60} y={y+CH*0.78} width={CW*0.26} height={CH*0.22} color={col} />
      {punch>0 ? <Group><Rect x={facing>0?x+CW*0.85:x-CW*0.65} y={y+CH*0.32} width={CW*0.65} height={CH*0.18} color="#aa8822" /><Circle cx={facing>0?x+CW*1.6:x-CW*0.55} cy={y+CH*0.4} r={CH*0.16} color="#ffcc00" /></Group> : <Rect x={facing>0?x+CW*0.82:x+CW*0.02} y={y+CH*0.35} width={CW*0.2} height={CH*0.16} color={col} />}
      <Rect x={x+CW*(facing>0?0.62:0.08)} y={y+CH*0.2} width={CW*0.28} height={CH*0.08} color={col} />
    </Group>
  );
}

function Bluto({ x, y, angry }: { x:number;y:number;angry:boolean }) {
  const col = angry ? '#cc3333' : '#334466';
  const w=CW*1.3, h=CH*1.3;
  return <Group><RoundedRect x={x} y={y} width={w} height={h*0.42} r={5} color={col} /><Rect x={x-w*0.08} y={y+h*0.38} width={w*1.16} height={h*0.44} color={col} /><Rect x={x+w*0.1} y={y+h*0.8} width={w*0.28} height={h*0.2} color={col} /><Rect x={x+w*0.62} y={y+h*0.8} width={w*0.28} height={h*0.2} color={col} /></Group>;
}

function Olive({ x, y }: { x:number;y:number }) {
  return <Group><Circle cx={x+CW*0.4} cy={y+CH*0.2} r={CW*0.32} color={LCD_DARK} /><Rect x={x+CW*0.2} y={y+CH*0.38} width={CW*0.46} height={CH*0.42} color={LCD_DARK} /><Rect x={x} y={y+CH*0.78} width={CW*0.22} height={CH*0.22} color={LCD_DARK} /><Rect x={x+CW*0.58} y={y+CH*0.78} width={CW*0.22} height={CH*0.22} color={LCD_DARK} /></Group>;
}
