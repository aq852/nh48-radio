const tracks = [
  { title: 'Midnight on NH 48', artist: 'The Night Drives', duration: 222, mood: '90s' },
  { title: 'Neon Mile', artist: 'Cassette Dreams', duration: 196, mood: '80s' },
  { title: 'Monsoon Memory', artist: 'Highway Hearts', duration: 238, mood: '90s' }
];

let current = 0;
let playing = false;
let elapsed = 0;
let timer;
const title = document.querySelector('#song-title');
const artist = document.querySelector('#artist-name');
const play = document.querySelector('#play');
const progress = document.querySelector('#progress');
const elapsedText = document.querySelector('#elapsed');
const durationText = document.querySelector('#duration');
const mood = document.querySelector('#mood');
const toggle = document.querySelector('#theme-toggle');

function format(seconds) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
function applyTheme(theme) {
  document.body.classList.toggle('theme-80s', theme === '80s');
  document.body.classList.toggle('theme-90s', theme === '90s');
  toggle.querySelector('.toggle-icon').textContent = theme === '80s' ? '☀' : '☾';
  toggle.querySelector('.toggle-label').textContent = theme === '80s' ? '80s neon' : '90s night';
  toggle.setAttribute('aria-label', `Switch to ${theme === '80s' ? '90s' : '80s'} theme`);
  mood.textContent = theme === '80s' ? 'SYNTHWAVE' : 'NOSTALGIA';
}
function loadTrack(index, autoplay = playing) {
  current = (index + tracks.length) % tracks.length;
  const track = tracks[current];
  elapsed = 0;
  title.textContent = track.title;
  artist.textContent = track.artist;
  durationText.textContent = format(track.duration);
  progress.value = 0;
  applyTheme(track.mood);
  if (autoplay) start();
}
function tick() {
  const track = tracks[current];
  elapsed += 1;
  if (elapsed >= track.duration) return loadTrack(current + 1, true);
  elapsedText.textContent = format(elapsed);
  progress.value = (elapsed / track.duration) * 100;
}
function start() { playing = true; play.textContent = 'Ⅱ'; play.setAttribute('aria-label', 'Pause track'); clearInterval(timer); timer = setInterval(tick, 1000); }
function pause() { playing = false; play.textContent = '▶'; play.setAttribute('aria-label', 'Play track'); clearInterval(timer); }
play.addEventListener('click', () => playing ? pause() : start());
document.querySelector('#previous').addEventListener('click', () => loadTrack(current - 1));
document.querySelector('#next').addEventListener('click', () => loadTrack(current + 1));
toggle.addEventListener('click', () => applyTheme(document.body.classList.contains('theme-80s') ? '90s' : '80s'));
progress.addEventListener('input', () => { elapsed = Math.round((progress.value / 100) * tracks[current].duration); elapsedText.textContent = format(elapsed); });
loadTrack(0, false);
