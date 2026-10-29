import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import type { Equipamento } from '@lumini/domain';

import { AuthGuard, Papeis, Usuario } from '../auth/auth.guard';
import type { UsuarioAutenticado } from '../auth/auth.service';
import { AdminService } from './admin.service';

/** Rotas do painel web — só para o papel Gestor (RNF06). */
@Controller('admin')
@UseGuards(AuthGuard)
@Papeis('Gestor')
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Get('resumo')
  resumo(@Usuario() u: UsuarioAutenticado) {
    return this.admin.resumo(u);
  }

  @Get('propostas')
  propostas(@Usuario() u: UsuarioAutenticado, @Query('status') status?: string, @Query('tecnico') tecnico?: string, @Query('busca') busca?: string) {
    return this.admin.listarPropostas(u, { status, tecnico, busca });
  }

  @Get('propostas/:id')
  proposta(@Usuario() u: UsuarioAutenticado, @Param('id') id: string) {
    return this.admin.detalheProposta(u, id);
  }

  @Post('propostas/:id/status')
  mudarStatus(@Usuario() u: UsuarioAutenticado, @Param('id') id: string, @Body() corpo: { status?: unknown }) {
    return this.admin.mudarStatus(u, id, corpo?.status);
  }

  @Get('equipamentos')
  equipamentos(@Usuario() u: UsuarioAutenticado) {
    return this.admin.listarEquipamentos(u);
  }

  @Post('equipamentos')
  criarEquipamento(@Usuario() u: UsuarioAutenticado, @Body() corpo: Partial<Equipamento>) {
    return this.admin.salvarEquipamento(u, corpo ?? {});
  }

  @Put('equipamentos/:id')
  editarEquipamento(@Usuario() u: UsuarioAutenticado, @Param('id') id: string, @Body() corpo: Partial<Equipamento>) {
    return this.admin.salvarEquipamento(u, corpo ?? {}, id);
  }

  @Get('usuarios')
  usuarios(@Usuario() u: UsuarioAutenticado) {
    return this.admin.listarUsuarios(u);
  }

  @Post('usuarios')
  criarUsuario(@Usuario() u: UsuarioAutenticado, @Body() corpo: Record<string, unknown>) {
    return this.admin.criarUsuario(u, corpo ?? {});
  }

  @Patch('usuarios/:id')
  ativarUsuario(@Usuario() u: UsuarioAutenticado, @Param('id') id: string, @Body() corpo: { ativo?: unknown }) {
    return this.admin.definirAtivo(u, id, corpo?.ativo);
  }

  @Get('plano')
  plano(@Usuario() u: UsuarioAutenticado) {
    return this.admin.plano(u);
  }

  @Get('sincronizacoes')
  sincronizacoes(@Usuario() u: UsuarioAutenticado) {
    return this.admin.sincronizacoes(u);
  }
}
