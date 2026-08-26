export const FRIENDS = [
  { id: 'abha', name: 'Abha', color: '#e91e8c', online: false },
  { id: 'meera', name: 'Meera', color: '#6b6b6b', online: false },
  { id: 'shreya', name: 'Shreya', color: '#2458b5', online: true },
  { id: 'devashree', name: 'Devashree', color: '#8c47b3', online: false },
  { id: 'kartiki', name: 'Kartiki', color: '#e50914', online: false },
  { id: 'rohit', name: 'Rohit', color: '#1e8c52', online: true },
  { id: 'lakshya', name: 'Lakshya', color: '#c47a12', online: true },
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
    id: 'emily',
    title: 'Emily in Paris',
    runtime: 'Clip · 3m',
    genre: 'Comedy',
    maturity: 'TV-MA',
    year: 2020,
    vibes: ['Comfort', 'Comedy', 'Feel-good', 'New this week'],
    art: 'art-emily',
    poster: '/media/posters/emily.webp',
    video: '/media/clips/emily.mp4',
  },
  {
    id: 'bridgerton',
    title: 'Bridgerton',
    runtime: 'Clip · 3m',
    genre: 'Romance',
    maturity: 'TV-MA',
    year: 2020,
    vibes: ['Comfort', 'Romance', 'Drama', 'Feel-good'],
    art: 'art-bridgerton',
    poster: '/media/posters/bridgerton.jpg',
    video: '/media/clips/bridgerton.mp4',
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

export const SAMPLE_VIDEO = '/media/clips/emily.mp4';

export const SAMPLE_CHAT = [
  { name: 'Abha', text: 'wait did he just—', memberId: 'sample-abha' },
  { name: 'Meera', text: 'shh this is the scene', memberId: 'sample-meera' },
  { name: 'Rohit', text: 'rewind energy', memberId: 'sample-rohit' },
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
