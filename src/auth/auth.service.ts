import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { randomUUID } from 'crypto';

import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from '../refresh-tokens/entities/refresh-token.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,

    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async register(createUserDto: CreateUserDto) {
    const existingUser = await this.usersService.findByEmail(
      createUserDto.email,
    );

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const user = await this.usersService.create(createUserDto);

    return this.generateTokens(user);
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string) {
    let payload: {
      sub: string;
      email: string;
      role: string;
      jti: string;
    };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.refreshTokenRepository.manager.transaction(
      async (manager) => {
        const repository = manager.getRepository(RefreshToken);

        const storedToken = await repository.findOne({
          where: {
            tokenId: payload.jti,
            userId: payload.sub,
            revokedAt: IsNull(),
          },
          lock: {
            mode: 'pessimistic_write',
          },
        });

        if (
          !storedToken ||
          storedToken.expiresAt <= new Date()
        ) {
          throw new UnauthorizedException('Invalid refresh token');
        }

        const user = await this.usersService.findOne(payload.sub);

        if (!user.isActive) {
          throw new UnauthorizedException('User account is inactive');
        }

        storedToken.revokedAt = new Date();

        await repository.save(storedToken);

        return this.generateTokens(user, repository);
      },
    );
  }

  private async generateTokens(
    user: User,
    repository: Repository<RefreshToken> = this.refreshTokenRepository,
  ) {
    const tokenId = randomUUID();

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    const refreshToken = await this.jwtService.signAsync(
      {
        ...payload,
        jti: tokenId,
      },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );

    const tokenHash = await bcrypt.hash(refreshToken, 12);

    const refreshTokenEntity = repository.create({
      tokenHash,
      tokenId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
    });

    await repository.save(refreshTokenEntity);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async logout(refreshToken: string) {
    let payload: {
      sub: string;
      jti: string;
    };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.refreshTokenRepository.manager.transaction(
      async (manager) => {
        const repository = manager.getRepository(RefreshToken);

        const storedToken = await repository.findOne({
          where: {
            tokenId: payload.jti,
            userId: payload.sub,
            revokedAt: IsNull(),
          },
          lock: {
            mode: 'pessimistic_write',
          },
        });

        if (
          !storedToken ||
          storedToken.expiresAt <= new Date()
        ) {
          throw new UnauthorizedException('Invalid refresh token');
        }

        storedToken.revokedAt = new Date();

        await repository.save(storedToken);

        return {
          message: 'Logged out successfully',
        };
      },
    );
  }
}