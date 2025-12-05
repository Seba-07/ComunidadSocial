import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/comunidad_social';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin exists
    const existingAdmin = await User.findOne({ role: 'ADMIN' });
    if (existingAdmin) {
      console.log('Admin already exists:', existingAdmin.email);
    } else {
      // Create admin user
      const admin = new User({
        rut: '11111111-1',
        firstName: 'Administrador',
        lastName: 'Sistema',
        email: 'admin@renca.cl',
        password: 'admin123', // Change this in production!
        phone: '+56 9 0000 0000',
        address: 'Municipalidad de Renca',
        role: 'ADMIN',
        active: true
      });
      await admin.save();
      console.log('Admin created:', admin.email);
      console.log('Password: admin123');
    }

    // Check if ministros exist
    const existingMinistros = await User.countDocuments({ role: 'MINISTRO' });
    if (existingMinistros === 0) {
      // Create sample ministros
      const ministros = [
        {
          rut: '12345678-9',
          firstName: 'María',
          lastName: 'González López',
          email: 'maria.gonzalez@renca.cl',
          password: 'maria123',
          phone: '+56 9 1234 5678',
          address: 'Av. Principal 123, Renca',
          role: 'MINISTRO',
          specialty: 'Juntas de Vecinos',
          active: true,
          mustChangePassword: true
        },
        {
          rut: '98765432-1',
          firstName: 'Carlos',
          lastName: 'Martínez Silva',
          email: 'carlos.martinez@renca.cl',
          password: 'carlos123',
          phone: '+56 9 8765 4321',
          address: 'Calle Los Aromos 456, Renca',
          role: 'MINISTRO',
          specialty: 'Organizaciones Funcionales',
          active: true,
          mustChangePassword: true
        }
      ];

      for (const m of ministros) {
        const ministro = new User(m);
        await ministro.save();
        console.log('Ministro created:', ministro.email, '- Password:', m.password);
      }
    } else {
      console.log('Ministros already exist:', existingMinistros);
    }

    console.log('\nSeed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
