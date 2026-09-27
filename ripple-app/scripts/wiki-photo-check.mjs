import {
  cleanPlaceQuery,
  getWikipediaQueryForBooking,
  resolveWikipediaImage,
} from '../src/lib/useWikipediaImage.ts';

const samples = [
  {
    type: 'activity',
    title: 'Pangong Tso Full-Day Private Drive',
    provider: 'Leh Adventure Tours',
    location: { type: 'named', name: 'Pangong Lake' },
    destination: 'Leh, Ladakh',
  },
  {
    type: 'activity',
    title: 'Sunset Yacht Cruise',
    provider: 'Konkan Coastal Adventures',
    location: { type: 'coordinates', lat: 15.6, lng: 73.74, label: 'Chapora River Jetty, Vagator' },
    destination: 'Goa, India',
  },
  {
    type: 'hotel',
    title: 'W Goa Resort & Spa',
    provider: 'Marriott',
    location: { type: 'coordinates', lat: 15.6, lng: 73.74, label: 'Vagator Beach, Goa' },
    destination: 'Goa, India',
  },
  {
    type: 'hotel',
    title: 'The Grand Dragon Ladakh',
    provider: 'GDL',
    location: { type: 'named', name: 'Old Road, Karzoo, Leh' },
    destination: 'Leh, Ladakh',
  },
  {
    type: 'activity',
    title: 'Thiksey Monastery & Shey Palace Private Tour',
    provider: 'Ladakh Heritage Walks',
    location: { type: 'named', name: 'Hotel Lobby' },
    destination: 'Leh, Ladakh',
  },
  {
    type: 'flight',
    title: 'Flight to Goa',
    provider: 'IndiGo 6E-5124 · DEL ➔ GOI',
    location: { type: 'named', name: 'DEL' },
    destination: 'Goa, India',
  },
];

const stub = {
  id: 'x',
  startTime: '',
  endTime: '',
  dependsOn: [],
  bufferMinutes: 0,
  cost: 0,
  cancellationPolicy: { policy: 'free' },
  status: 'confirmed',
};

for (const sample of samples) {
  const booking = { ...stub, ...sample };
  const { query, fallback } = getWikipediaQueryForBooking(booking, sample.destination);
  const src = await resolveWikipediaImage(query, fallback);
  const looksYacht = /yacht/i.test(src);
  const looksIss = /iss\d|view_of_earth/i.test(src);
  console.log(
    JSON.stringify(
      {
        title: sample.title,
        cleaned: cleanPlaceQuery(sample.title),
        query,
        fallback,
        src: src.slice(0, 140),
        looksYacht,
        looksIss,
      },
      null,
      0
    )
  );
}
