const audio = new Audio();

// Add permanently hosted songs here after placing the files in /songs.
// Example: { url: 'songs/night-drive.mp3', title: 'Night Drive', artist: 'Artist', mood: 'night' }
const bundledTracks = [];
let tracks = [...bundledTracks];
let current = -1;
let shuffleEnabled = false;
let repeatMode = 'all';
let searchQuery = '';
let favoritesOnly = false;

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
  noResults: document.querySelector('#no-results'),
  songCount: document.querySelector('#song-count'),
  clear: document.querySelector('#clear-playlist'),
  coverInitial: document.querySelector('#cover-initial'),
  themeLabel: document.querySelector('#theme-label'),
  favoriteCurrent: document.querySelector('#favorite-current'),
  favoritesFilter: document.querySelector('#show-favorites'),
  search: document.querySelector('#playlist-search'),
  shuffle: document.querySelector('#shuffle'),
  repeat: document.querySelector('#repeat'),
  volume: document.querySelector('#volume'),
  volumeValue: document.querySelector('#volume-value')
};

function readFavorites() {
  try {
    const stored = JSON.parse(localStorage.getItem('nh48-favorites') || '[]');
    return new Set(Array.isArray(stored) ? stored : []);
  } catch {
    return new Set();
  }
}

const favoriteKeys = readFavorites();

function saveFavorites() {
  try {
    localStorage.setItem('nh48-favorites', JSON.stringify([...favoriteKeys]));
  } catch {
    setMessage('Favorites work for this session, but could not be saved.');
  }
}

function trackKey(track) {
  return track.key || track.url;
}

function isFavorite(track) {
  return favoriteKeys.has(trackKey(track));
}

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

function updateFavoriteCurrent() {
  const track = tracks[current];
  const favorite = Boolean(track && isFavorite(track));
  elements.favoriteCurrent.disabled = !track;
  elements.favoriteCurrent.setAttribute('aria-pressed', String(favorite));
  elements.favoriteCurrent.setAttribute('aria-label', track
    ? `${favorite ? 'Remove' : 'Add'} ${track.title} ${favorite ? 'from' : 'to'} favorites`
    : 'Add current song to favorites');
}

function createHeartIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  path.setAttribute('d', 'M12 20.4 4.3 13A5.1 5.1 0 0 1 11.5 5.8l.5.5.5-.5a5.1 5.1 0 0 1 7.2 7.2z');
  svg.append(path);
  return svg;
}

function renderPlaylist() {
  elements.playlist.replaceChildren();
  const visibleTracks = tracks
    .map((track, index) => ({ track, index }))
    .filter(({ track }) => {
      const matchesSearch = `${track.title} ${track.artist}`.toLowerCase().includes(searchQuery);
      return matchesSearch && (!favoritesOnly || isFavorite(track));
    });

  visibleTracks.forEach(({ track, index }) => {
    const item = document.createElement('li');
    const playButton = document.createElement('button');
    const number = document.createElement('span');
    const copy = document.createElement('span');
    const trackTitle = document.createElement('span');
    const trackArtist = document.createElement('span');
    const bars = document.createElement('span');
    const favoriteButton = document.createElement('button');
    const favorite = isFavorite(track);

    item.className = 'playlist-row';
    playButton.type = 'button';
    playButton.className = `playlist-item${index === current ? ' active' : ''}`;
    playButton.dataset.index = String(index);
    playButton.setAttribute('aria-label', `Play ${track.title}`);
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
    playButton.append(number, copy, bars);

    favoriteButton.type = 'button';
    favoriteButton.className = 'favorite-track';
    favoriteButton.dataset.favoriteIndex = String(index);
    favoriteButton.setAttribute('aria-pressed', String(favorite));
    favoriteButton.setAttribute('aria-label', `${favorite ? 'Remove' : 'Add'} ${track.title} ${favorite ? 'from' : 'to'} favorites`);
    favoriteButton.append(createHeartIcon());

    item.append(playButton, favoriteButton);
    elements.playlist.append(item);
  });

  const hasTracks = tracks.length > 0;
  elements.emptyPlaylist.hidden = hasTracks;
  elements.playlist.hidden = !hasTracks || visibleTracks.length === 0;
  elements.noResults.hidden = !hasTracks || visibleTracks.length > 0;
  elements.clear.disabled = !hasTracks;
  elements.songCount.textContent = `${tracks.length} ${tracks.length === 1 ? 'SONG' : 'SONGS'}`;
  updateFavoriteCurrent();
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

  if (shouldPlay) audio.play().catch(() => setMessage('Press play to continue.'));
}

function getNextIndex() {
  if (!tracks.length) return -1;
  if (repeatMode === 'one') return current;
  if (current >= tracks.length - 1 && repeatMode === 'off') return -1;
  if (shuffleEnabled && tracks.length > 1) {
    let next = current;
    while (next === current) next = Math.floor(Math.random() * tracks.length);
    return next;
  }
  return current < tracks.length - 1 ? current + 1 : 0;
}

function playNext() {
  const next = getNextIndex();
  if (next === -1) {
    audio.pause();
    setMessage('You reached the end of the queue.');
    return;
  }
  loadTrack(next, true);
}

function playPrevious() {
  if (!tracks.length) return;
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  if (shuffleEnabled && tracks.length > 1) {
    let previous = current;
    while (previous === current) previous = Math.floor(Math.random() * tracks.length);
    loadTrack(previous, !audio.paused);
    return;
  }
  const previous = current > 0 ? current - 1 : (repeatMode === 'all' ? tracks.length - 1 : 0);
  loadTrack(previous, !audio.paused);
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

  const existingKeys = new Set(tracks.map(trackKey));
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

function toggleFavorite(index) {
  const track = tracks[index];
  if (!track) return;
  const key = trackKey(track);
  if (favoriteKeys.has(key)) favoriteKeys.delete(key);
  else favoriteKeys.add(key);
  saveFavorites();
  renderPlaylist();
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

audio.volume = Number(elements.volume.value) / 100;

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

audio.addEventListener('ended', playNext);

audio.addEventListener('error', () => {
  if (audio.src) setMessage('This file could not be played. Try another audio format.');
});

document.querySelector('#add-songs').addEventListener('click', () => elements.fileInput.click());
elements.fileInput.addEventListener('change', () => {
  addFiles(elements.fileInput.files);
  elements.fileInput.value = '';
});
elements.playlist.addEventListener('click', event => {
  const favoriteButton = event.target.closest('.favorite-track');
  if (favoriteButton) {
    toggleFavorite(Number(favoriteButton.dataset.favoriteIndex));
    return;
  }
  const playButton = event.target.closest('.playlist-item');
  if (playButton) loadTrack(Number(playButton.dataset.index), true);
});
elements.favoriteCurrent.addEventListener('click', () => toggleFavorite(current));
elements.play.addEventListener('click', togglePlayback);
document.querySelector('#previous').addEventListener('click', playPrevious);
document.querySelector('#next').addEventListener('click', playNext);
document.querySelector('#theme-toggle').addEventListener('click', () => setTheme(document.body.classList.contains('theme-neon') ? 'night' : 'neon'));
elements.clear.addEventListener('click', clearPlaylist);
elements.progress.addEventListener('input', () => {
  if (audio.duration) audio.currentTime = (Number(elements.progress.value) / 1000) * audio.duration;
});
elements.search.addEventListener('input', () => {
  searchQuery = elements.search.value.trim().toLowerCase();
  renderPlaylist();
});
elements.favoritesFilter.addEventListener('click', () => {
  favoritesOnly = !favoritesOnly;
  elements.favoritesFilter.setAttribute('aria-pressed', String(favoritesOnly));
  renderPlaylist();
});
elements.shuffle.addEventListener('click', () => {
  shuffleEnabled = !shuffleEnabled;
  elements.shuffle.setAttribute('aria-pressed', String(shuffleEnabled));
  setMessage(`Shuffle ${shuffleEnabled ? 'enabled' : 'disabled'}.`);
});
elements.repeat.addEventListener('click', () => {
  repeatMode = repeatMode === 'all' ? 'one' : repeatMode === 'one' ? 'off' : 'all';
  const labels = { all: 'REPEAT ALL', one: 'REPEAT ONE', off: 'REPEAT OFF' };
  elements.repeat.dataset.mode = repeatMode;
  elements.repeat.textContent = labels[repeatMode];
  elements.repeat.classList.toggle('active', repeatMode !== 'off');
  setMessage(`Repeat mode: ${repeatMode}.`);
});
elements.volume.addEventListener('input', () => {
  audio.volume = Number(elements.volume.value) / 100;
  elements.volumeValue.value = elements.volume.value;
  elements.volumeValue.textContent = elements.volume.value;
});

setTheme('night');
renderPlaylist();
if (tracks.length) loadTrack(0, false);
