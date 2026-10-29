import { ForbiddenException, Inject, Injectable, SetMetadata, UnauthorizedException, createParamDecorator, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { CONFIG, type ConfigApi } from '../config';
import type { UsuarioAutenticado } from './auth.service';
import { verificarToken, type Papel } from './jwt';

const CHAVE_PAPEIS = 'lumini:papeis';

/** Restringe a rota a um ou mais papéis (RBAC, RNF06). */
export const Papeis = (...papeis: Papel[]) => SetMetadata(CHAVE_PAPEIS, papeis);

type RequisicaoComUsuario = Request & { usuario?: UsuarioAutenticado };

/** Exige `Authorization: Bearer <token>` válido (401) e o papel certo (403). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(CONFIG) private readonly config: ConfigApi,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  canActivate(contexto: ExecutionContext): boolean {
    const req = contexto.switchToHttp().getRequest<RequisicaoComUsuario>();
    const cabecalho = req.headers.authorization ?? '';
    const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : '';
    const conteudo = token ? verificarToken(token, this.config.segredoJwt) : null;
    if (!conteudo) throw new UnauthorizedException('Sessão expirada ou ausente. Entre novamente.');
    req.usuario = { idUsuario: conteudo.sub, idEmpresa: conteudo.emp, papel: conteudo.papel, nome: conteudo.nome };

    const papeis = this.reflector.getAllAndOverride<Papel[] | undefined>(CHAVE_PAPEIS, [contexto.getHandler(), contexto.getClass()]);
    if (papeis && !papeis.includes(conteudo.papel)) throw new ForbiddenException('Seu perfil não tem acesso a esta função.');
    return true;
  }
}

/** Usuário do token, já verificado pelo AuthGuard. */
export const Usuario = createParamDecorator((_: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
  const req = contexto.switchToHttp().getRequest<RequisicaoComUsuario>();
  if (!req.usuario) throw new UnauthorizedException();
  return req.usuario;
});
