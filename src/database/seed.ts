import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';

import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';

config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [User],
  synchronize: false,
});

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_FULL_NAME;

  if (!email || !password || !fullName) {
    throw new Error('ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_FULL_NAME are required');
  }

  await dataSource.initialize();

  const userRepository = dataSource.getRepository(User);

  const existingUser = await userRepository.findOne({
    where: { email },
  });

  if (existingUser) {
    if (existingUser.role !== UserRole.ADMIN) {
      existingUser.role = UserRole.ADMIN;
      await userRepository.save(existingUser);
      console.log('Existing user promoted to admin.');
    } else {
      console.log('Admin already exists. No changes made.');
    }

    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = userRepository.create({
    email,
    passwordHash,
    fullName,
    role: UserRole.ADMIN,
    isActive: true,
  });

  await userRepository.save(admin);

  console.log('Initial admin created successfully.');
}

seedAdmin()
  .catch((error) => {
    console.error('Admin seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });