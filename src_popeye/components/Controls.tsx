import React, { useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Input } from '../game/logic';
import { GOLD, DARK_GOLD } from '../game/constants';

interface Props { onInput:(i:Partial<Input>)=>void; onPunch:()=>void; onSpinach:()=>void; onStart:()=>void; lives:string; score:string; hi:string; level:string }

export default function Controls({ onInput, onPunch, onSpinach, onStart, lives, score, hi, level }: Props) {
  const held = useRef<Set<string>>(new Set());
  const press = (k:string) => { held.current.add(k); emit(); };
  const release = (k:string) => { held.current.delete(k); emit(); };
  const emit = () => onInput({ left:held.current.has('L'), right:held.current.has('R'), up:held.current.has('U'), down:held.current.has('D') });
  return (
    <View style={s.wrap}>
      <View style={s.bar}><Text style={s.barText}>{score}</Text><Text style={s.barText}>{hi}</Text></View>
      <View style={s.row}>
        <View style={s.dpad}>
          <TouchableOpacity style={[s.db,s.du]} onPressIn={()=>press('U')} onPressOut={()=>release('U')} activeOpacity={0.7}><Text style={s.dl}>▲</Text></TouchableOpacity>
          <TouchableOpacity style={[s.db,s.dd]} onPressIn={()=>press('D')} onPressOut={()=>release('D')} activeOpacity={0.7}><Text style={s.dl}>▼</Text></TouchableOpacity>
          <TouchableOpacity style={[s.db,s.dleft]} onPressIn={()=>press('L')} onPressOut={()=>release('L')} activeOpacity={0.7}><Text style={s.dl}>◀</Text></TouchableOpacity>
          <TouchableOpacity style={[s.db,s.dright]} onPressIn={()=>press('R')} onPressOut={()=>release('R')} activeOpacity={0.7}><Text style={s.dl}>▶</Text></TouchableOpacity>
          <View style={s.dc} />
        </View>
        <View style={s.center}>
          <TouchableOpacity style={s.mini} onPress={onStart}><Text style={s.miniTxt}>START</Text></TouchableOpacity>
          <Text style={s.livesTxt}>{lives}</Text>
          <Text style={s.levelTxt}>{level}</Text>
        </View>
        <View style={s.actions}>
          <TouchableOpacity style={s.punch} onPressIn={onPunch} activeOpacity={0.7}><Text style={s.punchTxt}>PUNCH</Text></TouchableOpacity>
          <TouchableOpacity style={s.spinach} onPressIn={onSpinach} activeOpacity={0.7}><Text style={s.spinachTxt}>🌿</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:{backgroundColor:GOLD,borderTopWidth:2,borderTopColor:DARK_GOLD},
  bar:{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:5,backgroundColor:'#b8901a'},
  barText:{color:'#3a1a00',fontSize:13,fontFamily:'monospace',fontWeight:'700',letterSpacing:1},
  row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:16,paddingTop:10,paddingBottom:14},
  dpad:{width:114,height:114,position:'relative'},
  db:{position:'absolute',width:38,height:38,backgroundColor:'#2a2a2a',borderRadius:5,alignItems:'center',justifyContent:'center',elevation:4},
  du:{top:0,left:38},dd:{bottom:0,left:38},dleft:{top:38,left:0},dright:{top:38,right:0},
  dc:{position:'absolute',top:38,left:38,width:38,height:38,backgroundColor:'#3a3a3a',borderRadius:5},
  dl:{color:'#ccc',fontSize:14,fontWeight:'700'},
  center:{alignItems:'center',gap:8},
  mini:{backgroundColor:'#333',borderRadius:14,paddingHorizontal:16,paddingVertical:7,elevation:2},
  miniTxt:{color:'#aaa',fontSize:9,fontWeight:'700',letterSpacing:1.5},
  livesTxt:{color:'#3a1a00',fontSize:18,fontWeight:'700',letterSpacing:3},
  levelTxt:{color:'#5a3500',fontSize:9,fontWeight:'700',letterSpacing:1},
  actions:{alignItems:'center',gap:12},
  punch:{width:64,height:64,borderRadius:32,backgroundColor:'#991111',alignItems:'center',justifyContent:'center',elevation:6},
  punchTxt:{color:'#fff',fontSize:10,fontWeight:'900',letterSpacing:0.5},
  spinach:{width:46,height:46,borderRadius:23,backgroundColor:'#226622',alignItems:'center',justifyContent:'center',elevation:4},
  spinachTxt:{fontSize:20},
});
