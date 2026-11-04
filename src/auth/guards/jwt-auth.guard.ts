import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Access token is required');
    }

    const token = authHeader.split(' ')[1];

    try {
      // Verify access token
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });

      // Find user in database
      const user = await this.usersService.findOne(payload.sub);

      // Check whether user is active
      if (!user.isActive) {
        throw new UnauthorizedException('Your account is inactive');
      }

      // Attach authenticated user to request
      request.user = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}