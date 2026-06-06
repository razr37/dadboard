import React, { useRef, useEffect, useCallback, useState } from 'react';
import { View, StyleSheet, StatusBar, SafeAreaView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import GameRenderer from './src/components/GameRenderer';
import Controls from './src/components/Controls';
import { TitleScreen, GameOverScreen } from './src/components/Overlays';
import { GameState, Input, makeState, startGame, tick } from './src/game/logic';
import { GOLD } from './src/game/constants';

export default function App() {
  useKeepAwake();
  const gs = useRef<GameState>(makeState());
  const inp = useRef<Input>({ left:false, right:false, up:false, down:false, punch:false, spinach:false });
  const [, redraw] = useState(0);

  const haptic = useCallback((t:'light'|'medium'|'heavy') => {
    if (t==='light')  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (t==='medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (t==='heavy')  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, []);

  useEffect(() => {
    const loop = setInterval(() => {
      gs.current = tick(gs.current, inp.current, haptic);
      inp.current.punch = false;
      inp.current.spinach = false;
      redraw(n => n+1);
    }, 1000/60);
    return () => clearInterval(loop);
  }, [haptic]);

  const g = gs.current;
  const livesStr = Array.from({length:3}).map((_,i) => i<g.lives?'♥':'♡').join(' ');

  return (
    <SafeAreaView style={s.root}>
      <StatusBar hidden />
      <View style={s.device}>
        <View style={s.bezel}>
          <View style={s.screen}>
            <GameRenderer gs={g} />
            {g.status==='title'    && <TitleScreen onStart={()=>{gs.current=startGame(gs.current);redraw(n=>n+1);}} hi={g.hi} />}
            {g.status==='gameover' && <GameOverScreen score={g.score} hi={g.hi} onRestart={()=>{gs.current=startGame(gs.current);redraw(n=>n+1);}} />}
          </View>
        </View>
        <Controls
          onInput={p=>{inp.current={...inp.current,...p};}}
          onPunch={()=>{inp.current.punch=true;}}
          onSpinach={()=>{inp.current.spinach=true;}}
          onStart={()=>{gs.current=startGame(gs.current);redraw(n=>n+1);}}
          lives={livesStr} score={`SCORE: ${g.score}`} hi={`HI: ${g.hi}`} level={`LEVEL ${g.level}`}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:{flex:1,backgroundColor:'#1a1a2e'},
  device:{flex:1,backgroundColor:GOLD},
  bezel:{flex:1,margin:10,backgroundColor:'#0a0a12',borderRadius:10,padding:7,borderWidth:3,borderColor:'#555'},
  screen:{flex:1,borderRadius:5,overflow:'hidden'},
});
