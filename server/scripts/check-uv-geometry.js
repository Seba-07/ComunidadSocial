import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
console.log('Connecting to:', uri ? uri.substring(0, 30) + '...' : 'NO URI');

await mongoose.connect(uri);

const collections = await mongoose.connection.db.listCollections().toArray();
const uvCollections = collections.filter(c => c.name.toLowerCase().includes('unidad') || c.name.toLowerCase().includes('vecinal'));
console.log('UV collections:', uvCollections.map(c => c.name));

const colName = uvCollections[0]?.name;
if (!colName) { console.log('No UV collection found'); process.exit(1); }

const col = mongoose.connection.db.collection(colName);
const docs = await col.find({}).toArray();
console.log(`\n${colName}: ${docs.length} documents`);

// Fix corrupted geometry (object coords -> array coords)
let fixed = 0;
for (const d of docs) {
  if (d.geometry && d.geometry.coordinates) {
    const coords = d.geometry.coordinates;
    // Check if coordinates[0] is an object instead of array
    const ring = coords[0] || coords;
    if (ring && !Array.isArray(ring)) {
      console.log(`  Fixing UV ${d.numero}: coordinates stored as object, converting to array`);
      const cleanCoords = Object.values(coords).map(r => {
        const points = Object.values(r);
        return points.map(p => Array.isArray(p) ? p.map(Number) : Object.values(p).map(Number));
      });
      await col.updateOne({ _id: d._id }, { $set: { geometry: { type: 'Polygon', coordinates: cleanCoords } } });
      fixed++;
    } else {
      console.log(`  UV ${d.numero}: geometry OK, ${Array.isArray(coords[0]) ? coords[0].length : '?'} points`);
    }
  }
}
console.log(`\nFixed: ${fixed} documents`);

// Verify
const withGeo = await col.find({ 'geometry.type': 'Polygon' }).toArray();
console.log(`Total with geometry: ${withGeo.length}`);
for (const d of withGeo) {
  const ring = d.geometry.coordinates[0];
  console.log(`  UV ${d.numero}: ${Array.isArray(ring) ? ring.length + ' points' : 'STILL BAD'}, first: ${JSON.stringify(ring?.[0])}`);
}

await mongoose.disconnect();
console.log('\nDone.');
