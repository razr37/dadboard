import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { LCD_GREEN, LCD_DARK } from '../game/constants';

export function TitleScreen({ onStart, hi }: { onStart:()=>void; hi:number }) {
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => { Animated.loop(Animated.sequence([Animated.timing(blink,{toValue:0,duration:500,useNativeDriver:true}),Animated.timing(blink,{toValue:1,duration:500,useNativeDriver:true})])).start(); }, []);
  return (
    <View style={s.overlay}>
      <Text style={s.title}>⚓ POPEYE ⚓</Text>
      <Text style={s.sub}>THE SAILOR MAN</Text>
      {hi>0 && <Text style={s.hi}>HI-SCORE  {hi}</Text>}
      <Text style={s.hint}>Catch hearts · Dodge cans</Text>
      <Text style={s.hint}>PUNCH deflects · 🌿 = power</Text>
      <TouchableOpacity onPress={onStart} style={s.btn}><Animated.Text style={[s.btnTxt,{opacity:blink}]}>PRESS START</Animated.Text></TouchableOpacity>
    </View>
  );
}

export function GameOverScreen({ score, hi, onRestart }: { score:number; hi:number; onRestart:()=>void }) {
  return (
    <View style={s.overlay}>
      <Text style={s.title}>GAME OVER</Text>
      <Text style={s.scoreTxt}>SCORE  {score}</Text>
      {score>=hi && score>0 && <Text style={s.newhi}>🏆 NEW HI-SCORE!</Text>}
      <Text style={s.hi}>HI  {hi}</Text>
      <TouchableOpacity onPress={onRestart} style={s.btn}><Text style={s.btnTxt}>PLAY AGAIN</Text></TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  overlay:{...StyleSheet.absoluteFillObject,backgroundColor:`${LCD_GREEN}ee`,alignItems:'center',justifyContent:'center',gap:14,zIndex:10},
  title:{fontSize:30,fontWeight:'900',color:LCD_DARK,fontFamily:'monospace',letterSpacing:3},
  sub:{fontSize:13,fontWeight:'700',color:'#3a5a10',fontFamily:'monospace',letterSpacing:2},
  hi:{fontSize:13,fontWeight:'700',color:LCD_DARK,fontFamily:'monospace',letterSpacing:2},
  newhi:{fontSize:16,fontWeight:'900',color:'#884400',fontFamily:'monospace'},
  scoreTxt:{fontSize:20,fontWeight:'900',color:LCD_DARK,fontFamily:'monospace',letterSpacing:2},
  hint:{fontSize:11,color:LCD_DARK,fontFamily:'monospace'},
  btn:{marginTop:10,borderWidth:2,borderColor:LCD_DARK,paddingHorizontal:28,paddingVertical:12,borderRadius:6},
  btnTxt:{fontSize:14,fontWeight:'900',color:LCD_DARK,fontFamily:'monospace',letterSpacing:2},
});
