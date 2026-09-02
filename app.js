const audio = new Audio();
const LIBRARY_DB = 'nh48-radio-library';
const LIBRARY_STORE = 'settings';
const DIRECTORY_HANDLE_KEY = 'music-directory';

// Official demo streams, ready to play when the app opens.
const bundledTracks = [
  { url: 'https://ice5.somafm.com/groovesalad-128-mp3', title: 'Groove Salad', artist: 'SomaFM - Ambient and downtempo', mood: 'night', stream: true, key: 'demo-groovesalad' },
  { url: 'https://ice5.somafm.com/dronezone-128-mp3', title: 'Drone Zone', artist: 'SomaFM - Deep ambient', mood: 'neon', stream: true, key: 'demo-dronezone' },
  { url: 'https://ice5.somafm.com/spacestation-128-mp3', title: 'Space Station Soma', artist: 'SomaFM - Space music', mood: 'night', stream: true, key: 'demo-spacestation' }
];
let tracks = [...bundledTracks];
let current = -1;
let shuffleEnabled = false;
let repeatMode = 'all';
let searchQuery = '';
let favoritesOnly = false;
let audioContext;
let analyser;
let mediaSource;
let frequencyData;
let visualizerFrame;
let smoothedEnergy = 0;
let smoothedBass = 0;
let savedDirectoryHandle = null;
let installPrompt = null;
let lastMediaPositionUpdate = 0;
let openQueueMenuIndex = null;
let draggedTrackIndex = null;
let priorityNextKey = null;
let mediaArtworkUrl = null;
let mediaArtworkRequest = 0;

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
  volumeValue: document.querySelector('#volume-value'),
  visualizer: document.querySelector('#audio-visualizer'),
  folderInput: document.querySelector('#folder-files'),
  scanFolder: document.querySelector('#scan-folder'),
  scanFolderLabel: document.querySelector('#scan-folder-label'),
  libraryStatus: document.querySelector('#library-status'),
  libraryTitle: document.querySelector('#library-title'),
  libraryCopy: document.querySelector('#library-copy'),
  installApp: document.querySelector('#install-app'),
  addStream: document.querySelector('#add-stream'),
  streamDialog: document.querySelector('#stream-dialog'),
  streamForm: document.querySelector('#stream-form'),
  streamName: document.querySelector('#stream-name'),
  streamUrl: document.querySelector('#stream-url'),
  studio: document.querySelector('#studio-dialog'),
  openStudio: document.querySelector('#open-studio'),
  topFilter: document.querySelector('#show-top')
};

const visualizerContext = elements.visualizer.getContext('2d');

function resizeVisualizer() {
  const bounds = elements.visualizer.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(bounds.width * ratio));
  const height = Math.max(1, Math.round(bounds.height * ratio));
  if (elements.visualizer.width !== width || elements.visualizer.height !== height) {
    elements.visualizer.width = width;
    elements.visualizer.height = height;
  }
}

function drawIdleVisualizer() {
  resizeVisualizer();
  const { width, height } = elements.visualizer;
  visualizerContext.clearRect(0, 0, width, height);
  visualizerContext.fillStyle = 'rgba(255,255,255,.12)';
  visualizerContext.fillRect(0, Math.round(height * .78), width, 1);
}

function ensureAudioGraph() {
  if (analyser) return true;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    setMessage('Audio visualization is not supported by this browser.');
    return false;
  }

  try {
    audioContext = new AudioContextClass();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = .82;
    mediaSource = audioContext.createMediaElementSource(audio);
    mediaSource.connect(analyser);
    analyser.connect(audioContext.destination);
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    document.documentElement.classList.add('web-audio-ready');
    drawIdleVisualizer();
    return true;
  } catch {
    setMessage('The spectrum could not start, but music playback is still available.');
    return false;
  }
}

function renderVisualizer() {
  if (!analyser || audio.paused) return;
  resizeVisualizer();
  analyser.getByteFrequencyData(frequencyData);

  let bassTotal = 0;
  let energyTotal = 0;
  for (let index = 0; index < frequencyData.length; index += 1) {
    energyTotal += frequencyData[index];
    if (index < 10) bassTotal += frequencyData[index];
  }
  const bass = bassTotal / (10 * 255);
  const energy = energyTotal / (frequencyData.length * 255);
  smoothedBass += (bass - smoothedBass) * .18;
  smoothedEnergy += (energy - smoothedEnergy) * .16;
  document.documentElement.style.setProperty('--bass', smoothedBass.toFixed(3));
  document.documentElement.style.setProperty('--energy', smoothedEnergy.toFixed(3));

  const { width, height } = elements.visualizer;
  visualizerContext.clearRect(0, 0, width, height);
  const barCount = 36;
  const gap = Math.max(2, width * .006);
  const barWidth = (width - gap * (barCount - 1)) / barCount;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff6738';
  const gradient = visualizerContext.createLinearGradient(0, height, 0, 0);
  gradient.addColorStop(0, accent);
  gradient.addColorStop(1, 'rgba(255,255,255,.88)');
  visualizerContext.fillStyle = gradient;

  for (let index = 0; index < barCount; index += 1) {
    const dataIndex = Math.floor((index / barCount) * frequencyData.length);
    const level = frequencyData[dataIndex] / 255;
    const barHeight = Math.max(2, level * height * .92);
    const x = index * (barWidth + gap);
    visualizerContext.fillRect(x, height - barHeight, barWidth, barHeight);
  }

  visualizerFrame = requestAnimationFrame(renderVisualizer);
}

function startVisualizer() {
  cancelAnimationFrame(visualizerFrame);
  renderVisualizer();
}

function stopVisualizer() {
  cancelAnimationFrame(visualizerFrame);
  smoothedEnergy = 0;
  smoothedBass = 0;
  document.documentElement.style.setProperty('--bass', '0');
  document.documentElement.style.setProperty('--energy', '0');
  drawIdleVisualizer();
}

async function startPlayback() {
  ensureAudioGraph();
  if (audioContext?.state === 'suspended') await audioContext.resume();
  return audio.play();
}

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

function addStream(name, url) {
  const streamUrl = url.trim();
  if (!/^https?:\/\//i.test(streamUrl)) {
    setMessage('Use a full https:// stream URL.');
    return false;
  }
  const key = 'stream-' + streamUrl;
  if (tracks.some(track => trackKey(track) === key)) {
    setMessage('That station is already in your queue.');
    return false;
  }
  tracks.push({ url: streamUrl, title: name.trim() || 'Live station', artist: 'Live radio', mood: 'neon', stream: true, key });
  renderPlaylist();
  if (current === -1) loadTrack(0, false);
  setMessage((name.trim() || 'Live station') + ' added as a live station.');
  return true;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function cleanTitle(filename) {
  return filename.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function isAudioFile(file) {
  return Boolean(file && (file.type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)));
}

function openLibraryDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LIBRARY_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(LIBRARY_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readSavedDirectory() {
  try {
    const database = await openLibraryDatabase();
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(LIBRARY_STORE, 'readonly');
      const request = transaction.objectStore(LIBRARY_STORE).get(DIRECTORY_HANDLE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
    });
  } catch {
    return null;
  }
}

async function saveDirectory(handle) {
  try {
    const database = await openLibraryDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(LIBRARY_STORE, 'readwrite');
      transaction.objectStore(LIBRARY_STORE).put(handle, DIRECTORY_HANDLE_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  } catch {
    setMessage('Folder connected, but this browser could not remember it.');
  }
}

async function getDirectoryPermission(handle, requestAccess = false) {
  if (!handle?.queryPermission) return 'denied';
  const options = { mode: 'read' };
  try {
    const currentPermission = await handle.queryPermission(options);
    if (currentPermission === 'granted' || !requestAccess) return currentPermission;
    return handle.requestPermission(options);
  } catch {
    return 'denied';
  }
}

function updateLibraryStatus(title, copy, connected = false) {
  elements.libraryTitle.textContent = title;
  elements.libraryCopy.textContent = copy;
  elements.libraryStatus.classList.toggle('connected', connected);
}

async function collectAudioFromDirectory(directoryHandle, prefix = directoryHandle.name) {
  const found = [];
  for await (const [name, entry] of directoryHandle.entries()) {
    const path = `${prefix}/${name}`;
    if (entry.kind === 'directory') {
      found.push(...await collectAudioFromDirectory(entry, path));
    } else if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name)) {
      const file = await entry.getFile();
      found.push({ file, path });
    }
  }
  return found;
}

async function importDirectory(handle, announce = true) {
  elements.scanFolder.disabled = true;
  elements.scanFolderLabel.textContent = 'SCANNING...';
  updateLibraryStatus('SCANNING LIBRARY', `Looking inside ${handle.name}...`, true);
  if (announce) setMessage(`Scanning ${handle.name} for music...`);

  try {
    const entries = await collectAudioFromDirectory(handle);
    entries.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
    const added = addFiles(entries, `${handle.name} folder`);
    savedDirectoryHandle = handle;
    await saveDirectory(handle);
    updateLibraryStatus(handle.name.toUpperCase(), `${entries.length} audio ${entries.length === 1 ? 'file' : 'files'} found on this device.`, true);
    elements.scanFolderLabel.textContent = 'CHOOSE FOLDER';
    if (announce || added) {
      setMessage(added
        ? `${added} ${added === 1 ? 'song' : 'songs'} added from ${handle.name}.`
        : entries.length ? `${handle.name} is already up to date.` : `No supported music was found in ${handle.name}.`);
    }
  } catch (error) {
    console.error('Folder scan failed:', error);
    updateLibraryStatus('SCAN INTERRUPTED', 'Choose the folder again to reconnect.', false);
    elements.scanFolderLabel.textContent = 'SCAN FOLDER';
    setMessage('The folder could not be scanned. Check its permission and try again.');
  } finally {
    elements.scanFolder.disabled = false;
  }
}

async function scanMusicFolder() {
  if (!('showDirectoryPicker' in window)) {
    elements.folderInput.click();
    return;
  }

  try {
    let handle = null;
    if (savedDirectoryHandle && await getDirectoryPermission(savedDirectoryHandle) !== 'granted') {
      if (await getDirectoryPermission(savedDirectoryHandle, true) === 'granted') handle = savedDirectoryHandle;
    }
    if (!handle) handle = await window.showDirectoryPicker({ id: 'nh48-music-library', mode: 'read' });
    await importDirectory(handle);
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.error('Folder selection failed:', error);
      setMessage('Folder access was not granted. You can still add individual songs.');
    }
  }
}

async function restoreMusicFolder() {
  if (!('showDirectoryPicker' in window)) {
    updateLibraryStatus('LOCAL LIBRARY', 'Tap Scan Folder and choose your Music or Downloads folder.');
    return;
  }

  savedDirectoryHandle = await readSavedDirectory();
  if (!savedDirectoryHandle) return;
  const permission = await getDirectoryPermission(savedDirectoryHandle);
  if (permission === 'granted') {
    await importDirectory(savedDirectoryHandle, false);
  } else {
    updateLibraryStatus('FOLDER REMEMBERED', `${savedDirectoryHandle.name} needs permission to reconnect.`);
    elements.scanFolderLabel.textContent = 'RECONNECT';
  }
}

function setMessage(text) {
  elements.message.textContent = text;
}

function shortenArtworkText(text, maximumLength = 28) {
  return text.length > maximumLength ? `${text.slice(0, maximumLength - 1).trimEnd()}…` : text;
}

function createMediaArtwork(track) {
  return new Promise(resolve => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext('2d');
      const neon = track.mood === 'neon';
      const accent = neon ? '#ff3d9f' : '#ff6738';
      const glow = neon ? '#57ddff' : '#f3b35c';
      const background = context.createLinearGradient(0, 0, 512, 512);
      background.addColorStop(0, neon ? '#1d1026' : '#211313');
      background.addColorStop(.52, '#111218');
      background.addColorStop(1, '#07080c');
      context.fillStyle = background;
      context.fillRect(0, 0, 512, 512);

      context.strokeStyle = 'rgba(255,255,255,.08)';
      context.lineWidth = 2;
      for (let offset = -220; offset < 620; offset += 54) {
        context.beginPath();
        context.moveTo(offset, 0);
        context.lineTo(offset - 150, 512);
        context.stroke();
      }

      const radial = context.createRadialGradient(360, 110, 15, 360, 110, 260);
      radial.addColorStop(0, `${accent}66`);
      radial.addColorStop(1, 'transparent');
      context.fillStyle = radial;
      context.fillRect(0, 0, 512, 512);

      context.beginPath();
      context.arc(164, 190, 112, 0, Math.PI * 2);
      context.fillStyle = '#0a0b10';
      context.fill();
      context.lineWidth = 6;
      for (let radius = 26; radius < 112; radius += 16) {
        context.beginPath();
        context.arc(164, 190, radius, 0, Math.PI * 2);
        context.strokeStyle = 'rgba(255,255,255,.08)';
        context.stroke();
      }
      context.beginPath();
      context.arc(164, 190, 32, 0, Math.PI * 2);
      context.fillStyle = accent;
      context.fill();
      context.fillStyle = '#fff8f0';
      context.font = '900 20px Arial, sans-serif';
      context.textAlign = 'center';
      context.fillText('NH 48', 164, 197);

      context.fillStyle = accent;
      context.fillRect(52, 326, 408, 2);
      context.fillStyle = 'rgba(255,255,255,.58)';
      context.font = '800 14px Arial, sans-serif';
      context.letterSpacing = '2px';
      context.fillText('LIVE FROM THE HIGHWAY', 256, 365);
      context.fillStyle = '#fff8f0';
      context.font = '600 38px Georgia, serif';
      context.fillText(shortenArtworkText(track.title), 256, 412);
      context.fillStyle = glow;
      context.font = '500 20px Arial, sans-serif';
      context.fillText(shortenArtworkText(track.artist, 36), 256, 449);
      context.fillStyle = 'rgba(255,255,255,.35)';
      context.font = '700 12px Arial, sans-serif';
      context.fillText('NH 48 RADIO  •  AFTER DARK', 256, 483);

      canvas.toBlob(blob => resolve(blob ? URL.createObjectURL(blob) : null), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

async function updateMediaSession(track = tracks[current]) {
  if (!('mediaSession' in navigator) || !track || !window.MediaMetadata) return;
  const request = ++mediaArtworkRequest;
  const fallbackArtwork = new URL('icons/icon.svg', window.location.href).href;
  let artwork = fallbackArtwork;

  try {
    const generatedArtwork = await createMediaArtwork(track);
    if (request !== mediaArtworkRequest) {
      if (generatedArtwork) URL.revokeObjectURL(generatedArtwork);
      return;
    }
    if (mediaArtworkUrl?.startsWith('blob:')) URL.revokeObjectURL(mediaArtworkUrl);
    mediaArtworkUrl = generatedArtwork || fallbackArtwork;
    artwork = mediaArtworkUrl;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: 'NH 48 Radio',
      artwork: [{
        src: artwork,
        sizes: '512x512',
        type: generatedArtwork ? 'image/png' : 'image/svg+xml'
      }]
    });
    navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
    document.documentElement.dataset.mediaArtwork = generatedArtwork ? 'ready' : 'fallback';
  } catch {
    // Media controls are an enhancement; regular playback continues if unavailable.
  }
}

function updateMediaPosition() {
  if (!('mediaSession' in navigator) || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
  const now = Date.now();
  if (now - lastMediaPositionUpdate < 800) return;
  lastMediaPositionUpdate = now;
  try {
    navigator.mediaSession.setPositionState({
      duration: audio.duration,
      playbackRate: audio.playbackRate || 1,
      position: Math.min(Math.max(audio.currentTime, 0), audio.duration)
    });
  } catch {
    // Some browsers expose Media Session without position-state support.
  }
}

function clearMediaSession() {
  if (!('mediaSession' in navigator)) return;
  try {
    mediaArtworkRequest += 1;
    if (mediaArtworkUrl?.startsWith('blob:')) URL.revokeObjectURL(mediaArtworkUrl);
    mediaArtworkUrl = null;
    delete document.documentElement.dataset.mediaArtwork;
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  } catch {
    // Nothing else is required when the API is not fully implemented.
  }
}

function configureMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const handlers = {
    play: () => startPlayback().catch(() => setMessage('Press play in NH 48 to continue.')),
    pause: () => audio.pause(),
    previoustrack: playPrevious,
    nexttrack: playNext,
    seekbackward: details => { audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset || 10)); },
    seekforward: details => { audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + (details.seekOffset || 10)); },
    seekto: details => {
      if (Number.isFinite(details.seekTime)) audio.currentTime = Math.min(Math.max(details.seekTime, 0), audio.duration || details.seekTime);
    }
  };

  Object.entries(handlers).forEach(([action, handler]) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // Unsupported actions are skipped individually.
    }
  });
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

function createQueueIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  [5, 12, 19].forEach(y => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', String(y));
    circle.setAttribute('r', '1.5');
    svg.append(circle);
  });
  return svg;
}

function moveTrack(fromIndex, toIndex, message) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= tracks.length || toIndex >= tracks.length) return;
  const activeTrack = tracks[current];
  const [track] = tracks.splice(fromIndex, 1);
  tracks.splice(toIndex, 0, track);
  current = tracks.indexOf(activeTrack);
  openQueueMenuIndex = null;
  renderPlaylist();
  setMessage(message || `${track.title} moved in the queue.`);
}

function moveTrackBy(index, direction) {
  const destination = index + direction;
  if (destination < 0 || destination >= tracks.length) return;
  const track = tracks[index];
  moveTrack(index, destination, `${track.title} moved ${direction < 0 ? 'up' : 'down'} in the queue.`);
}

function queueTrackNext(index) {
  const track = tracks[index];
  if (!track) return;
  if (index === current) {
    setMessage(`${track.title} is already playing.`);
    return;
  }
  priorityNextKey = trackKey(track);
  openQueueMenuIndex = null;
  renderPlaylist();
  setMessage(`${track.title} will play next.`);
}

function removeTrack(index) {
  const track = tracks[index];
  if (!track) return;
  const wasCurrent = index === current;
  const wasPlaying = !audio.paused;
  const activeTrack = tracks[current];
  if (priorityNextKey === trackKey(track)) priorityNextKey = null;

  tracks.splice(index, 1);
  if (track.local) URL.revokeObjectURL(track.url);
  openQueueMenuIndex = null;

  if (!tracks.length) {
    clearPlaylist();
    return;
  }

  if (wasCurrent) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    const replacement = Math.min(index, tracks.length - 1);
    current = -1;
    loadTrack(replacement, wasPlaying);
    setMessage(`${track.title} removed. ${tracks[current].title} is now playing.`);
    return;
  }

  current = tracks.indexOf(activeTrack);
  renderPlaylist();
  setMessage(`${track.title} removed from the queue.`);
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
    const moreButton = document.createElement('button');
    const menu = document.createElement('div');
    const dragHandle = document.createElement('span');
    const favorite = isFavorite(track);

    item.className = 'playlist-row';
    item.dataset.index = String(index);
    item.draggable = true;
    item.classList.toggle('queued-next', trackKey(track) === priorityNextKey && index !== current);
    item.setAttribute('aria-label', `Drag ${track.title} to reorder`);
    dragHandle.className = 'drag-handle';
    dragHandle.setAttribute('aria-hidden', 'true');
    dragHandle.textContent = '⋮⋮';
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

    moreButton.type = 'button';
    moreButton.className = 'queue-more';
    moreButton.dataset.queueAction = 'menu';
    moreButton.dataset.index = String(index);
    moreButton.setAttribute('aria-label', `Queue options for ${track.title}`);
    moreButton.setAttribute('aria-expanded', String(openQueueMenuIndex === index));
    moreButton.append(createQueueIcon());

    menu.className = 'queue-menu';
    menu.hidden = openQueueMenuIndex !== index;
    menu.setAttribute('role', 'menu');
    [
      ['next', 'PLAY NEXT'],
      ['up', 'MOVE UP'],
      ['down', 'MOVE DOWN'],
      ['remove', 'REMOVE']
    ].forEach(([action, label]) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.textContent = label;
      option.dataset.queueAction = action;
      option.dataset.index = String(index);
      option.setAttribute('role', 'menuitem');
      if ((action === 'up' && index === 0) || (action === 'down' && index === tracks.length - 1) || (action === 'next' && index === current)) option.disabled = true;
      menu.append(option);
    });

    item.append(dragHandle, playButton, favoriteButton, moreButton, menu);
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
  if (priorityNextKey === trackKey(track)) priorityNextKey = null;
  audio.src = track.url;
  elements.title.textContent = track.title;
  elements.artist.textContent = track.artist;
  elements.coverInitial.textContent = track.title.slice(0, 2).toUpperCase();
  elements.elapsed.textContent = '0:00';
  elements.duration.textContent = '0:00';
  elements.progress.value = 0;
  setTheme(track.mood === 'neon' ? 'neon' : 'night');
  updateMediaSession(track);
  setMessage(`Track ${current + 1} of ${tracks.length}`);
  renderPlaylist();

  if (shouldPlay) startPlayback().catch(() => setMessage('Press play to continue.'));
}

function getNextIndex() {
  if (!tracks.length) return -1;
  if (priorityNextKey) {
    const priorityIndex = tracks.findIndex(track => trackKey(track) === priorityNextKey);
    priorityNextKey = null;
    if (priorityIndex >= 0 && priorityIndex !== current) return priorityIndex;
  }
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
  if (audio.paused) startPlayback().catch(() => setMessage('Playback was blocked. Press play again.'));
  else audio.pause();
}

function addFiles(files, source = 'Local collection') {
  const selected = [...files]
    .map(item => item?.file ? item : ({ file: item, path: item.webkitRelativePath || item.name }))
    .filter(({ file }) => isAudioFile(file));
  if (!selected.length) {
    setMessage('No supported audio files were selected.');
    return 0;
  }

  const existingKeys = new Set(tracks.map(trackKey));
  const additions = selected
    .filter(({ file, path }) => !existingKeys.has(`${path}-${file.size}-${file.lastModified}`))
    .map(({ file, path }, index) => ({
      url: URL.createObjectURL(file),
      title: cleanTitle(file.name) || `Track ${tracks.length + index + 1}`,
      artist: path.includes('/') ? path.split('/').slice(-2, -1)[0] : source,
      mood: (tracks.length + index) % 2 ? 'neon' : 'night',
      local: true,
      key: `${path}-${file.size}-${file.lastModified}`
    }));

  if (!additions.length) {
    setMessage('Those songs are already in your queue.');
    return 0;
  }

  tracks.push(...additions);
  renderPlaylist();
  setMessage(`${additions.length} ${additions.length === 1 ? 'song' : 'songs'} added to the queue.`);
  if (current === -1) loadTrack(0, false);
  return additions.length;
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
  priorityNextKey = null;
  openQueueMenuIndex = null;
  elements.title.textContent = 'Your road. Your soundtrack.';
  elements.artist.textContent = 'Add songs to begin the journey';
  elements.coverInitial.textContent = '48';
  elements.elapsed.textContent = '0:00';
  elements.duration.textContent = '0:00';
  elements.progress.value = 0;
  document.body.classList.remove('is-playing');
  elements.play.dataset.playing = 'false';
  clearMediaSession();
  renderPlaylist();
  setMessage('Playlist cleared. Select songs to start again.');
  if (tracks.length) loadTrack(0, false);
}

audio.volume = Number(elements.volume.value) / 100;

audio.addEventListener('loadedmetadata', () => {
  elements.duration.textContent = formatTime(audio.duration);
  updateMediaPosition();
});

audio.addEventListener('timeupdate', () => {
  elements.progress.value = audio.duration ? Math.round((audio.currentTime / audio.duration) * 1000) : 0;
  elements.elapsed.textContent = formatTime(audio.currentTime);
  updateMediaPosition();
});

audio.addEventListener('play', () => {
  elements.play.dataset.playing = 'true';
  elements.play.setAttribute('aria-label', 'Pause track');
  document.body.classList.add('is-playing');
  updateMediaSession();
  startVisualizer();
  renderPlaylist();
});

audio.addEventListener('pause', () => {
  elements.play.dataset.playing = 'false';
  elements.play.setAttribute('aria-label', 'Play track');
  document.body.classList.remove('is-playing');
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  stopVisualizer();
  renderPlaylist();
});

audio.addEventListener('ended', playNext);

audio.addEventListener('error', () => {
  if (audio.src) setMessage('This file could not be played. Try another audio format.');
});

document.querySelector('#add-songs').addEventListener('click', () => elements.fileInput.click());
elements.addStream.addEventListener('click', () => elements.streamDialog.showModal());
elements.streamForm.addEventListener('submit', event => {
  event.preventDefault();
  if (addStream(elements.streamName.value, elements.streamUrl.value)) {
    elements.streamForm.reset();
    elements.streamDialog.close();
  }
});
elements.openStudio.addEventListener('click', () => elements.studio.showModal());
elements.topFilter.addEventListener('click', () => setMessage('Top tracks will appear here after you play music.'));
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => {
  const dialog = document.querySelector('#' + button.dataset.closeDialog);
  if (dialog) dialog.close();
}));
elements.scanFolder.addEventListener('click', scanMusicFolder);
elements.fileInput.addEventListener('change', () => {
  addFiles(elements.fileInput.files);
  elements.fileInput.value = '';
});
elements.folderInput.addEventListener('change', () => {
  const files = [...elements.folderInput.files];
  const folderName = files[0]?.webkitRelativePath?.split('/')[0] || 'Selected folder';
  const added = addFiles(files, `${folderName} folder`);
  const audioCount = files.filter(isAudioFile).length;
  updateLibraryStatus(folderName.toUpperCase(), `${audioCount} audio ${audioCount === 1 ? 'file' : 'files'} selected from this device.`, true);
  elements.scanFolderLabel.textContent = 'SCAN AGAIN';
  if (added) setMessage(`${added} ${added === 1 ? 'song' : 'songs'} added from ${folderName}.`);
  elements.folderInput.value = '';
});
elements.playlist.addEventListener('click', event => {
  const queueAction = event.target.closest('[data-queue-action]');
  if (queueAction) {
    const index = Number(queueAction.dataset.index);
    const action = queueAction.dataset.queueAction;
    if (action === 'menu') {
      openQueueMenuIndex = openQueueMenuIndex === index ? null : index;
      renderPlaylist();
    } else if (action === 'next') queueTrackNext(index);
    else if (action === 'up') moveTrackBy(index, -1);
    else if (action === 'down') moveTrackBy(index, 1);
    else if (action === 'remove') removeTrack(index);
    return;
  }
  const favoriteButton = event.target.closest('.favorite-track');
  if (favoriteButton) {
    toggleFavorite(Number(favoriteButton.dataset.favoriteIndex));
    return;
  }
  const playButton = event.target.closest('.playlist-item');
  if (playButton) loadTrack(Number(playButton.dataset.index), true);
});
elements.playlist.addEventListener('dragstart', event => {
  const row = event.target.closest('.playlist-row');
  if (!row) return;
  draggedTrackIndex = Number(row.dataset.index);
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', String(draggedTrackIndex));
    event.dataTransfer.effectAllowed = 'move';
  }
  row.classList.add('dragging');
});
elements.playlist.addEventListener('dragover', event => {
  const row = event.target.closest('.playlist-row');
  if (!row || draggedTrackIndex === null) return;
  event.preventDefault();
  if (Number(row.dataset.index) !== draggedTrackIndex) row.classList.add('drag-over');
});
elements.playlist.addEventListener('dragleave', event => {
  event.target.closest('.playlist-row')?.classList.remove('drag-over');
});
elements.playlist.addEventListener('drop', event => {
  const row = event.target.closest('.playlist-row');
  if (!row || draggedTrackIndex === null) return;
  event.preventDefault();
  const targetIndex = Number(row.dataset.index);
  const sourceIndex = draggedTrackIndex;
  draggedTrackIndex = null;
  elements.playlist.querySelectorAll('.playlist-row').forEach(item => item.classList.remove('dragging', 'drag-over'));
  moveTrack(sourceIndex, targetIndex);
});
elements.playlist.addEventListener('dragend', () => {
  draggedTrackIndex = null;
  elements.playlist.querySelectorAll('.playlist-row').forEach(item => item.classList.remove('dragging', 'drag-over'));
});
document.addEventListener('click', event => {
  if (openQueueMenuIndex !== null && !event.target.closest('.playlist-row')) {
    openQueueMenuIndex = null;
    renderPlaylist();
  }
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

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  elements.installApp.hidden = false;
});

elements.installApp.addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  elements.installApp.hidden = true;
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  elements.installApp.hidden = true;
  setMessage('NH 48 Radio is installed and ready for the road.');
});

window.addEventListener('resize', drawIdleVisualizer);

setTheme('night');
configureMediaSession();
renderPlaylist();
drawIdleVisualizer();
if (tracks.length) loadTrack(0, false);
restoreMusicFolder();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=10').catch(error => console.error('Offline setup failed:', error));
  });
}
