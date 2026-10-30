import { randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import { BancoService } from '../banco.service';
import { CONFIG, type ConfigApi } from '../config';
import { assinarToken, hashRefresh, novoRefreshToken, type Papel } from './jwt';
import { conferirSenha } from './senha';

export interface UsuarioAutenticado {
  idUsuario: string;
  idEmpresa: string;
  papel: Papel;
  nome: string;
}

interface LinhaUsuario {
  id_usuario: string;
  id_empresa: string;
  nome: string;
  email: string;
  senha_hash: string;
  papel: Papel;
  telefone: string | null;
  ativo: number;
}

export interface RespostaLogin {
  tokenAcesso: string;
  refreshToken: string;
  expiraEmS: number;
  usuario: {
    id: string;
    nome: string;
    email: string;
    papel: Papel;
    telefone: string | null;
    idEmpresa: string;
    nomeEmpresa: string;
  };
}

/** RF01 / RNF06: login por e-mail e senha, JWT com papel e refresh token. */
@Injectable()
export class AuthService {
  constructor(
    @Inject(BancoService) private readonly bd: BancoService,
    @Inject(CONFIG) private readonly config: ConfigApi,
  ) {}

  login(email: unknown, senha: unknown): RespostaLogin {
    if (typeof email !== 'string' || typeof senha !== 'string' || !email.trim() || !senha) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }
    const u = this.bd.banco.um<LinhaUsuario>('SELECT * FROM usuario WHERE email = ?', email.trim());
    if (!u || !u.ativo || !conferirSenha(senha, u.senha_hash)) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }
    this.bd.banco.executar('UPDATE usuario SET ultimo_acesso_em = ? WHERE id_usuario = ?', new Date().toISOString(), u.id_usuario);
    return this.emitir(u);
  }

  /** Troca um refresh token válido por um par novo (o antigo é revogado). */
  renovar(refreshToken: unknown): RespostaLogin {
    if (typeof refreshToken !== 'string' || !refreshToken) throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    const sessao = this.bd.banco.um<{ id_sessao: string; id_usuario: string; expira_em: string; revogada: number }>(
      'SELECT * FROM sessao_refresh WHERE token_hash = ?', hashRefresh(refreshToken),
    );
    if (!sessao || sessao.revogada || Date.parse(sessao.expira_em) <= Date.now()) {
      throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    }
    const u = this.bd.banco.um<LinhaUsuario>('SELECT * FROM usuario WHERE id_usuario = ?', sessao.id_usuario);
    if (!u || !u.ativo) throw new UnauthorizedException('Usuário desativado.');
    this.bd.banco.executar('UPDATE sessao_refresh SET revogada = TRUE WHERE id_sessao = ?', sessao.id_sessao);
    return this.emitir(u);
  }

  sair(refreshToken: unknown): void {
    if (typeof refreshToken === 'string') {
      this.bd.banco.executar('UPDATE sessao_refresh SET revogada = TRUE WHERE token_hash = ?', hashRefresh(refreshToken));
    }
  }

  perfil(usuario: UsuarioAutenticado): RespostaLogin['usuario'] {
    const u = this.bd.banco.um<LinhaUsuario>('SELECT * FROM usuario WHERE id_usuario = ?', usuario.idUsuario);
    if (!u) throw new UnauthorizedException('Usuário não encontrado.');
    return this.publico(u);
  }

  private emitir(u: LinhaUsuario): RespostaLogin {
    const tokenAcesso = assinarToken({ sub: u.id_usuario, emp: u.id_empresa, papel: u.papel, nome: u.nome }, this.config.segredoJwt, this.config.validadeAcessoS);
    const refresh = novoRefreshToken();
    this.bd.banco.executar(
      'INSERT INTO sessao_refresh (id_sessao, id_usuario, token_hash, expira_em) VALUES (?, ?, ?, ?)',
      randomUUID(), u.id_usuario, refresh.hash, new Date(Date.now() + this.config.validadeRefreshS * 1000).toISOString(),
    );
    return { tokenAcesso, refreshToken: refresh.token, expiraEmS: this.config.validadeAcessoS, usuario: this.publico(u) };
  }

  private publico(u: LinhaUsuario): RespostaLogin['usuario'] {
    const empresa = this.bd.banco.um<{ nome_fantasia: string }>('SELECT nome_fantasia FROM empresa WHERE id_empresa = ?', u.id_empresa);
    return { id: u.id_usuario, nome: u.nome, email: u.email, papel: u.papel, telefone: u.telefone, idEmpresa: u.id_empresa, nomeEmpresa: empresa?.nome_fantasia ?? '' };
  }
}
