/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from 'src/users/users.service';
import { RefreshToken } from 'src/users/entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  /**
   * Registers a new user and initializes their free plan
   */
  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    try {
      // PRD Requirement: Hash with bcrypt rounds 12
      const hashedPassword = await bcrypt.hash(dto.password, 12);

      // Create the user record
      const user = await this.usersService.create({
        ...dto,
        password: hashedPassword,
      });

      // NOTE: In Phase 7 (Payments), we will add logic here
      // to create the default 'free' plan record in the plans table.

      return this.generateTokens(user.id, user.email);
    } catch (error) {
      throw new InternalServerErrorException('Error creating user');
    }
  }

  /**
   * Validates user credentials and issues new tokens
   */
  async login(dto: LoginDto) {
    // We use a custom find method that includes the password field
    // since password is { select: false } in the Entity
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    return this.generateTokens(user.id, user.email);
  }

  /**
   * Handles the Refresh Token rotation logic
   */
  async refreshToken(token: string) {
    // 1. Find the token in DB
    // In a real app, you'd hash the incoming token and compare it to the DB hash
    // For this simple implementation, we'll find by userId or provide the raw token
    // PRD: "The refresh token is stored in the database and can be revoked"
    // Logic for rotation will be implemented once we test the basic flow
    // For now, let's focus on the initial generation
  }

  /**
   * Generates both Access and Refresh tokens
   * PRD: Access (15m), Refresh (7d)
   */
  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    // Sign the short-lived access token
    const accessToken = await this.jwtService.signAsync(payload);

    // Create a secure random refresh token
    const refreshToken = crypto.randomBytes(40).toString('hex');

    // PRD: Hash the refresh token before storage
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    // Set expiry (7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Save to database
    await this.refreshTokenRepository.save({
      token: hashedRefreshToken,
      userId,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email: email,
      },
    };
  }
}
