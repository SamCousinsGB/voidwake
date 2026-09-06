export class FlightAudio {
 private beam:{oscillators:OscillatorNode[];gain:GainNode}|null=null;
 private last:Record<string,number>={};
 constructor(private ctx:AudioContext){}
 stopBeam(){if(!this.beam)return;const {oscillators,gain}=this.beam;this.beam=null;gain.gain.setTargetAtTime(0,this.ctx.currentTime,.03);for(const o of oscillators){o.stop(this.ctx.currentTime+.15);o.onended=()=>{o.disconnect();gain.disconnect();};}}
 play(type:string){
  const ctx=this.ctx,t=ctx.currentTime;if(type==='phaser-start'){
   if(this.beam)return;const gain=ctx.createGain();gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.014,t+.08);gain.connect(ctx.destination);
   const oscillators=[235,472,710].map((f,i)=>{const o=ctx.createOscillator();o.type=i?'sine':'triangle';o.frequency.value=f;o.connect(gain);o.start();return o;});this.beam={oscillators,gain};return;
  }
  if(t-(this.last[type]??-99)<(type==='hit'?.12:.055))return;this.last[type]=t;
  const impact=['explode','torpedo-impact','missile-impact','singularity'].includes(type);
  const frequencies:Record<string,number[]>={laser:[1150,140],torpedo:[140,38],missile:[190,530],antimatter:[65,22],hit:[95,35],explode:[85,22],'missile-impact':[115,30],'torpedo-impact':[75,18],singularity:[125,18],intercept:[1800,720],trade:[520,880],dock:[190,380],jump:[70,750]};
  const [from,to]=frequencies[type]??[240,120],duration=type==='singularity'?2.4:type==='jump'?1.8:type==='torpedo-impact'?1.25:impact?.65:type==='trade'?.18:.15;
  const o=ctx.createOscillator(),gain=ctx.createGain();o.type=impact?'triangle':'sine';o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,t+duration);gain.gain.setValueAtTime(impact?.11:.035,t);gain.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(gain);gain.connect(ctx.destination);o.start();o.stop(t+duration);o.onended=()=>{o.disconnect();gain.disconnect();};
  if(impact){const length=Math.ceil(ctx.sampleRate*duration),buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,2);const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),noiseGain=ctx.createGain();filter.type='lowpass';filter.frequency.setValueAtTime(type==='singularity'?700:1800,t);filter.frequency.exponentialRampToValueAtTime(45,t+duration);noiseGain.gain.value=.06;source.buffer=buffer;source.connect(filter);filter.connect(noiseGain);noiseGain.connect(ctx.destination);source.start();source.onended=()=>{source.disconnect();filter.disconnect();noiseGain.disconnect();};}
 }
}
