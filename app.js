const audio = new Audio();

// Add permanently hosted songs here after placing the files in /songs.
// Example: { url: 'songs/night-drive.mp3', title: 'Night Drive', artist: 'Artist', mood: 'night' }
const bundledTracks = [];
let tracks = [...bundledTracks];
let current = -1;

const elements = {
  title: document.querySelector('#song-title'),
  artist: document.querySelector('#artist-name'),
  play: document.querySelector('#play'),
  progress: document.querySelector('#progress'),
  elapsed: document.querySelector('#elapsed'),
  duration: document.querySelector('#duration'),
  mood: document.querySelector('#mood'),
  message: document.querySelector('#player-message'),
  fileInput: document.querySelector('#song-files'),
  playlist: document.querySelector('#playlist-list'),
  emptyPlaylist: document.querySelector('#empty-playlist'),
  songCount: document.querySelector('#song-count'),
  clear: document.querySelector('#clear-playlist'),
  coverInitial: document.querySelector('#cover-initial'),
  themeLabel: document.querySelector('#theme-label')
};

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function cleanTitle(filename) {
  return filename.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function setMessage(text) {
  elements.message.textContent = text;
}

function setTheme(theme) {
  const neon = theme === 'neon';
  document.body.classList.toggle('theme-neon', neon);
  document.body.classList.toggle('theme-night', !neon);
  elements.themeLabel.textContent = neon ? 'NEON MODE' : 'NIGHT MODE';
  elements.mood.textContent = neon ? 'NEON CRUISE' : 'NIGHT DRIVE';
  document.querySelector('#theme-toggle').setAttribute('aria-label', `Switch to ${neon ? 'night' : 'neon'} theme`);
}

function renderPlaylist() {
  elements.playlist.replaceChildren();
  tracks.forEach((track, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    const number = document.createElement('span');
    const copy = document.createElement('span');
    const trackTitle = document.createElement('span');
    const trackArtist = document.createElement('span');
    const bars = document.createElement('span');

    button.type = 'button';
    button.className = `playlist-item${index === current ? ' active' : ''}`;
    button.dataset.index = String(index);
    button.setAttribute('aria-label', `Play ${track.title}`);
    number.className = 'track-number';
    number.textContent = String(index + 1).padStart(2, '0');
    copy.className = 'playlist-copy';
    trackTitle.className = 'playlist-title';
    trackTitle.textContent = track.title;
    trackArtist.className = 'playlist-artist';
    trackArtist.textContent = track.artist;
    bars.className = 'playing-bars';
    bars.setAttribute('aria-hidden', 'true');
    bars.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
    copy.append(trackTitle, trackArtist);
    button.append(number, copy, bars);
    item.append(button);
    elements.playlist.append(item);
  });

  elements.emptyPlaylist.hidden = tracks.length > 0;
  elements.playlist.hidden = tracks.length === 0;
  elements.clear.disabled = tracks.length === 0;
  elements.songCount.textContent = `${tracks.length} ${tracks.length === 1 ? 'SONG' : 'SONGS'}`;
}

function loadTrack(index, shouldPlay = false) {
  if (!tracks.length) {
    setMessage('Add songs to start your road queue.');
    return;
  }

  current = (index + tracks.length) % tracks.length;
  const track = tracks[current];
  audio.src = track.url;
  elements.title.textContent = track.title;
  elements.artist.textContent = track.artist;
  elements.coverInitial.textContent = track.title.slice(0, 2).toUpperCase();
  elements.elapsed.textContent = '0:00';
  elements.duration.textContent = '0:00';
  elements.progress.value = 0;
  setTheme(track.mood === 'neon' ? 'neon' : 'night');
  setMessage(`Track ${current + 1} of ${tracks.length}`);
  renderPlaylist();

  if (shouldPlay) {
    audio.play().catch(() => setMessage('Press play to continue.'));
  }
}

function togglePlayback() {
  if (!tracks.length) {
    elements.fileInput.click();
    return;
  }
  if (audio.paused) audio.play().catch(() => setMessage('Playback was blocked. Press play again.'));
  else audio.pause();
}

function addFiles(files) {
  const selected = [...files].filter(file =>
    file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)
  );
  if (!selected.length) {
    setMessage('No supported audio files were selected.');
    return;
  }

  const existingKeys = new Set(tracks.map(track => track.key).filter(Boolean));
  const additions = selected
    .filter(file => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`))
    .map((file, index) => ({
      url: URL.createObjectURL(file),
      title: cleanTitle(file.name) || `Track ${tracks.length + index + 1}`,
      artist: 'Local collection',
      mood: (tracks.length + index) % 2 ? 'neon' : 'night',
      local: true,
      key: `${file.name}-${file.size}-${file.lastModified}`
    }));

  if (!additions.length) {
    setMessage('Those songs are already in your queue.');
    return;
  }

  tracks.push(...additions);
  renderPlaylist();
  setMessage(`${additions.length} ${additions.length === 1 ? 'song' : 'songs'} added to the queue.`);
  if (current === -1) loadTrack(0, false);
}

function clearPlaylist() {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  tracks.forEach(track => { if (track.local) URL.revokeObjectURL(track.url); });
  tracks = [...bundledTracks];
  current = -1;
  elements.title.textContent = 'Your road. Your soundtrack.';
  elements.artist.textContent = 'Add songs to begin the journey';
  elements.coverInitial.textContent = '48';
  elements.elapsed.textContent = '0:00';
  elements.duration.textContent = '0:00';
  elements.progress.value = 0;
  document.body.classList.remove('is-playing');
  elements.play.dataset.playing = 'false';
  renderPlaylist();
  setMessage('Playlist cleared. Select songs to start again.');
  if (tracks.length) loadTrack(0, false);
}

audio.addEventListener('loadedmetadata', () => {
  elements.duration.textContent = formatTime(audio.duration);
});

audio.addEventListener('timeupdate', () => {
  elements.progress.value = audio.duration ? Math.round((audio.currentTime / audio.duration) * 1000) : 0;
  elements.elapsed.textContent = formatTime(audio.currentTime);
});

audio.addEventListener('play', () => {
  elements.play.dataset.playing = 'true';
  elements.play.setAttribute('aria-label', 'Pause track');
  document.body.classList.add('is-playing');
  renderPlaylist();
});

audio.addEventListener('pause', () => {
  elements.play.dataset.playing = 'false';
  elements.play.setAttribute('aria-label', 'Play track');
  document.body.classList.remove('is-playing');
  renderPlaylist();
});

audio.addEventListener('ended', () => {
  if (tracks.length) loadTrack(current + 1, true);
});

audio.addEventListener('error', () => {
  if (audio.src) setMessage('This file could not be played. Try another audio format.');
});

document.querySelector('#add-songs').addEventListener('click', () => elements.fileInput.click());
elements.fileInput.addEventListener('change', () => {
  addFiles(elements.fileInput.files);
  elements.fileInput.value = '';
});
elements.playlist.addEventListener('click', event => {
  const button = event.target.closest('.playlist-item');
  if (button) loadTrack(Number(button.dataset.index), true);
});
elements.play.addEventListener('click', togglePlayback);
document.querySelector('#previous').addEventListener('click', () => loadTrack(current - 1, !audio.paused));
document.querySelector('#next').addEventListener('click', () => loadTrack(current + 1, !audio.paused));
document.querySelector('#theme-toggle').addEventListener('click', () => setTheme(document.body.classList.contains('theme-neon') ? 'night' : 'neon'));
elements.clear.addEventListener('click', clearPlaylist);
elements.progress.addEventListener('input', () => {
  if (audio.duration) audio.currentTime = (Number(elements.progress.value) / 1000) * audio.duration;
});

setTheme('night');
renderPlaylist();
if (tracks.length) loadTrack(0, false);
