// 浏览器预览页：底部播放控制条（播放/暂停、进度拖动、当前站名、小节:拍），
// 支持从本地拖入一个音频文件和画面同步播放（只在本页内存里，不上传、不保存）。
// 有音频时以音频时钟为准；没有时用系统时钟。
import { renderAt } from './film.js';
import { duration, beatAt, sectionAt, barBeatLabel, grid, setGrid } from '../beat/time.js';
import { stationByN } from '../data/stations.js';
import { BPM, FIRST_DOWNBEAT } from '../beat/config.js';

export function setupPreview(p, canvas, ctx) {
  document.body.classList.add('preview');
  const stage = document.getElementById('stage');
  stage.appendChild(canvas);
  const $ = (id) => document.getElementById(id);
  const ui = {
    play: $('play'), seek: $('seek'), time: $('time'), beat: $('beat'), station: $('station'),
    prev: $('prev'), next: $('next'), audioName: $('audioName'), offset: $('offset'), bpm: $('bpm'),
    metro: $('metro'), drop: $('drop'), fps: $('fps'),
  };
  const audio = new Audio();
  let hasAudio = false;
  let playing = false;
  let t = 0;
  let lastWall = 0;
  let audioStartOffset = 0; // 音频时间 = 画面时间 - audioStartOffset（固定为 0：配乐与成片从同一时刻开始）

  ui.offset.value = grid.firstDownbeat;
  ui.bpm.value = grid.bpm;
  ui.seek.max = duration();
  ui.seek.step = 1 / 60;

  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
  function sectionName(gb) {
    const sec = sectionAt(gb);
    if (sec.id === 'intro') return 'Intro';
    if (sec.id === 'outro') return 'Outro';
    const st = stationByN(sec.station);
    return `第 ${st.n} 站 · ${st.albumZh} ·「${st.song}」`;
  }
  let frames = 0, fpsT = performance.now();
  function draw() {
    renderAt(ctx, t);
    const gb = beatAt(t);
    ui.time.textContent = `${fmt(t)} / ${fmt(duration())}`;
    ui.beat.textContent = barBeatLabel(gb);
    ui.station.textContent = sectionName(gb);
    if (document.activeElement !== ui.seek) ui.seek.value = t;
    // 节拍灯：每拍闪一下，强拍更亮
    const frac = gb % 1;
    const strong = Math.floor(gb) % 4 === 0;
    ui.metro.style.opacity = gb > 0 ? String(Math.max(0.15, 1 - frac * 3)) : '0.15';
    ui.metro.style.background = strong ? '#ff4d4d' : '#ffd24d';
    frames++;
    const now = performance.now();
    if (now - fpsT > 1000) { ui.fps.textContent = `${frames} fps`; frames = 0; fpsT = now; }
  }
  function tick(now) {
    if (playing) {
      if (hasAudio) t = audio.currentTime + audioStartOffset;
      else t += (now - lastWall) / 1000;
      lastWall = now;
      if (t >= duration()) { t = duration(); setPlaying(false); }
      draw();
    }
    requestAnimationFrame(tick);
  }
  function setPlaying(v) {
    playing = v;
    ui.play.textContent = v ? '❚❚ 暂停' : '▶ 播放';
    lastWall = performance.now();
    if (hasAudio) {
      if (v) { audio.currentTime = Math.max(0, t - audioStartOffset); audio.play(); }
      else audio.pause();
    }
  }
  function seek(nt) {
    t = Math.min(Math.max(0, nt), duration());
    if (hasAudio) audio.currentTime = Math.max(0, t - audioStartOffset);
    draw();
  }
  ui.play.onclick = () => setPlaying(!playing);
  ui.seek.oninput = () => seek(parseFloat(ui.seek.value));
  ui.prev.onclick = () => seek(t - 1 / 30);
  ui.next.onclick = () => seek(t + 1 / 30);
  ui.offset.onchange = () => { setGrid({ firstDownbeat: parseFloat(ui.offset.value) }); ui.seek.max = duration(); draw(); };
  ui.bpm.onchange = () => { setGrid({ bpm: parseFloat(ui.bpm.value) }); ui.seek.max = duration(); draw(); };
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
    if (e.code === 'ArrowLeft') seek(t - (e.shiftKey ? 1 : 1 / 30));
    if (e.code === 'ArrowRight') seek(t + (e.shiftKey ? 1 : 1 / 30));
  });
  // 拖入音频
  const loadAudio = (file) => {
    if (!file || !file.type.startsWith('audio')) return;
    audio.src = URL.createObjectURL(file);
    hasAudio = true;
    ui.audioName.textContent = `♪ ${file.name}（只在本页播放，不保存）`;
    setPlaying(false);
    seek(0);
  };
  window.addEventListener('dragover', (e) => { e.preventDefault(); ui.drop.classList.add('on'); });
  window.addEventListener('dragleave', () => ui.drop.classList.remove('on'));
  window.addEventListener('drop', (e) => { e.preventDefault(); ui.drop.classList.remove('on'); loadAudio(e.dataTransfer.files[0]); });
  $('audioFile').onchange = (e) => loadAudio(e.target.files[0]);
  $('resetGrid').onclick = () => { setGrid({ bpm: BPM, firstDownbeat: FIRST_DOWNBEAT }); ui.offset.value = FIRST_DOWNBEAT; ui.bpm.value = BPM; draw(); };
  draw();
  requestAnimationFrame(tick);
}
