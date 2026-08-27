export const FRIENDS = [
  { id: 'abha', name: 'Abha', color: '#e91e8c', status: 'offline' },
  { id: 'meera', name: 'Meera', color: '#4a5568', status: 'watching' },
  { id: 'shreya', name: 'Shreya', color: '#2458b5', status: 'active' },
  { id: 'devashree', name: 'Devashree', color: '#8c47b3', status: 'offline' },
  { id: 'kartiki', name: 'Kartiki', color: '#e50914', status: 'watching' },
  { id: 'rohit', name: 'Rohit', color: '#1e8c52', status: 'active' },
  { id: 'lakshya', name: 'Lakshya', color: '#c47a12', status: 'offline' },
];

export const VIBES = [
  'Comfort',
  'Thrills',
  'Romance',
  'Comedy',
  'Drama',
  'Action',
  'Feel-good',
  'New this week',
];

export const PROFILES = [
  { id: 'sarah', name: 'Sarah', kind: 'user', art: 'profile-sarah' },
  { id: 'caleb', name: 'Caleb', kind: 'user', art: 'profile-caleb' },
  { id: 'children', name: 'Children', kind: 'kids', art: 'profile-kids' },
  { id: 'watchparty', name: 'Watch Party', kind: 'party', art: 'profile-party' },
];

/** Client-side catalog mirror; server is source of truth after /api/titles */
export const FALLBACK_TITLES = [
  {
    id: 'enola',
    title: 'Enola Holmes',
    runtime: 'Clip · 2m',
    genre: 'Mystery',
    maturity: 'PG-13',
    year: 2020,
    vibes: ['Comfort', 'Thrills', 'Drama', 'Feel-good'],
    art: 'art-enola',
    poster: '',
    video: '/media/previews/enola.mp4',
  },
  {
    id: 'maybe',
    title: 'Always Be My Maybe',
    runtime: 'Clip · 2m',
    genre: 'Romance',
    maturity: 'PG-13',
    year: 2019,
    vibes: ['Comfort', 'Romance', 'Comedy', 'Feel-good'],
    art: 'art-maybe',
    poster: '',
    video: '/media/previews/maybe.mp4',
  },
  {
    id: 'raazi',
    title: 'Raazi',
    runtime: 'Clip · 2m',
    genre: 'Spy',
    maturity: 'U/A 13+',
    year: 2018,
    vibes: ['Thrills', 'Action', 'Drama'],
    art: 'art-raazi',
    poster: '/media/posters/raazi.jpg',
    video: '/media/clips/raazi.mp4',
  },
  {
    id: 'adam',
    title: 'The Adam Project',
    runtime: 'Clip · 2m',
    genre: 'Sci-fi',
    maturity: 'PG-13',
    year: 2022,
    vibes: ['Comedy', 'Action', 'Feel-good', 'New this week'],
    art: 'art-adam',
    poster: '',
    video: '/media/previews/adam.mp4',
  },
  {
    id: 'rednotice',
    title: 'Red Notice',
    runtime: 'Clip · 2m',
    genre: 'Action',
    maturity: 'PG-13',
    year: 2021,
    vibes: ['Thrills', 'Action', 'Comedy'],
    art: 'art-rednotice',
    poster: '',
    video: '/media/previews/rednotice.mp4',
  },
  {
    id: 'voicemails',
    title: 'Voicemails for Isabelle',
    runtime: 'Clip · ending',
    genre: 'Drama',
    maturity: 'U/A 16+',
    year: 2024,
    vibes: ['Comfort', 'Drama', 'Romance', 'New this week'],
    art: 'art-voicemails',
    poster: '/media/posters/voicemails.png',
    video: '/media/clips/voicemails.mp4',
  },
];

export const SAMPLE_VIDEO = '/media/clips/raazi.mp4';

export const NIGHT_NAMES = {
  Comfort: 'Friday Comfort Night',
  Thrills: 'Friday Spy Night',
  Romance: 'Friday Romance Night',
  Comedy: 'Friday Comedy Night',
  Drama: 'Friday Drama Night',
  Action: 'Friday Action Night',
  'Feel-good': 'Feel-good Friday',
  'New this week': 'New This Week',
};

export function nightNameFor(vibe) {
  return NIGHT_NAMES[vibe] || 'Friday Night';
}

export const SAMPLE_CHAT = [
  { name: 'Shreya', text: 'this is the scene', memberId: 'sample-shreya' },
  { name: 'Rohit', text: 'wait — rewind that', memberId: 'sample-rohit' },
  { name: 'Lakshya', text: 'Quiet on for this bit', memberId: 'sample-lakshya' },
];

export function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function memberInitial(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

export function videoForTitle(title) {
  return title?.video || SAMPLE_VIDEO;
}
