const audio = new Audio();
// Add permanent, deployed tracks here after putting files in /songs.
// Example: { url: 'songs/midnight-drive.mp3', title: 'Midnight Drive', artist: 'Your Artist', mood: '90s' }
const bundledTracks = [];
let tracks = [...bundledTracks];
let current = -1;

const title = document.querySelector('#song-title');
const artist = document.querySelector('#artist-name');
const play = document.querySelector('#play');
const progress = document.querySelector('#progress');
const elapsedText = document.querySelector('#elapsed');
const durationText = document.querySelector('#duration');
const mood = document.querySelector('#mood');
const toggle = document.querySelector('#theme-toggle');
const message = document.querySelector('#player-message');
const fileInput = document.querySelector('#song-files');

function format(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function applyTheme(theme) {
  const is80s = theme === '80s';
  document.body.classList.toggle('theme-80s', is80s);
  document.body.classList.toggle('theme-90s', !is80s);
  toggle.querySelector('.toggle-icon').textContent = is80s ? '80S' : '90S';
  toggle.querySelector('.toggle-label').textContent = is80s ? 'neon mode' : 'night mode';
  toggle.setAttribute('aria-label', `Switch to ${is80s ? '90s' : '80s'} theme`);
  mood.textContent = is80s ? 'SYNTHWAVE' : 'NOSTALGIA';
}

function setMessage(text) { message.textContent = text; }

function loadTrack(index, shouldPlay = false) {
  if (!tracks.length) return setMessage('Add MP3 songs to start listening.');
  current = (index + tracks.length) % tracks.length;
  const track = tracks[current];
  audio.src = track.url;
  title.textContent = track.title;
  artist.textContent = track.artist;
  durationText.textContent = '0:00';
  progress.value = 0;
  applyTheme(track.mood);
  setMessage(`${current + 1} of ${tracks.length} songs loaded`);
  if (shouldPlay) audio.play().catch(() => setMessage('Press PLAY to begin this song.'));
}

function togglePlayback() {
  if (!tracks.length) return fileInput.click();
  if (audio.paused) audio.play().catch(() => setMessage('Your browser blocked playback. Press PLAY again.'));
  else audio.pause();
}

audio.addEventListener('loadedmetadata', () => { durationText.textContent = format(audio.duration); });
audio.addEventListener('timeupdate', () => {
  progress.value = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  elapsedText.textContent = format(audio.currentTime);
});
audio.addEventListener('play', () => { play.textContent = 'PAUSE'; play.setAttribute('aria-label', 'Pause track'); });
audio.addEventListener('pause', () => { play.textContent = 'PLAY'; play.setAttribute('aria-label', 'Play track'); });
audio.addEventListener('ended', () => loadTrack(current + 1, true));
audio.addEventListener('error', () => setMessage('This audio file could not be played. Try an MP3, WAV, or OGG file.'));

document.querySelector('#add-songs').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const selected = [...fileInput.files].filter(file => file.type.startsWith('audio/'));
  if (!selected.length) return setMessage('No supported audio files were selected.');
  tracks.forEach(track => { if (track.local) URL.revokeObjectURL(track.url); });
  tracks = selected.map((file, index) => ({
    url: URL.createObjectURL(file),
    title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' '),
    artist: 'Your local collection',
    mood: index % 2 ? '80s' : '90s',
    local: true
  }));
  loadTrack(0, false);
});
play.addEventListener('click', togglePlayback);
document.querySelector('#previous').addEventListener('click', () => loadTrack(current - 1, !audio.paused));
document.querySelector('#next').addEventListener('click', () => loadTrack(current + 1, !audio.paused));
toggle.addEventListener('click', () => applyTheme(document.body.classList.contains('theme-80s') ? '90s' : '80s'));
progress.addEventListener('input', () => { if (audio.duration) audio.currentTime = (progress.value / 100) * audio.duration; });
applyTheme('90s');
if (tracks.length) loadTrack(0, false);
