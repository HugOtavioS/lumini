import { Body, Controller, Get, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';

import { AuthGuard, Usuario } from './auth.guard';
import { AuthService, type UsuarioAutenticado } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  /** POST /auth/login { email, senha } */
  @Post('login')
  @HttpCode(200)
  login(@Body() corpo: { email?: unknown; senha?: unknown }) {
    return this.auth.login(corpo?.email, corpo?.senha);
  }

  /** POST /auth/refresh { refreshToken } */
  @Post('refresh')
  @HttpCode(200)
  renovar(@Body() corpo: { refreshToken?: unknown }) {
    return this.auth.renovar(corpo?.refreshToken);
  }

  /** POST /auth/logout { refreshToken } */
  @Post('logout')
  @HttpCode(204)
  sair(@Body() corpo: { refreshToken?: unknown }) {
    this.auth.sair(corpo?.refreshToken);
  }

  /** GET /auth/me */
  @Get('me')
  @UseGuards(AuthGuard)
  perfil(@Usuario() usuario: UsuarioAutenticado) {
    return this.auth.perfil(usuario);
  }
}
