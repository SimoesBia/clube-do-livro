import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NotificacoesService } from '../../core/notificacoes.service';
import { ResumoMembroService } from '../../core/resumo-membro.service';

const ICONES: Record<string, string> = {
  convite: '💌',
  sorteio: '🎡',
  livro_do_mes: '📖',
  desafio_encerrado: '🏆',
  comentario: '💬',
  curtida: '♥',
};

// A janelinha do sininho: aniversários de hoje e os avisos do clube
@Component({
  selector: 'app-notificacoes-painel',
  template: `
    @if (notificacoes.aberto()) {
      <div class="sobreposicao">
        <div class="sobreposicao-fundo" (click)="notificacoes.fechar()"></div>
        <div class="cartao-flutuante painel" role="dialog" aria-modal="true" aria-label="Notificações">
          <button type="button" class="x" (click)="notificacoes.fechar()" aria-label="Fechar">✕</button>
          <h2 class="titulo-serif">Notificações 🔔</h2>

          @if (notificacoes.naoLidas() > 0) {
            <button type="button" class="pilula marcar" (click)="notificacoes.marcarTodasComoLidas()">Marcar tudo como lido</button>
          }

          @for (a of notificacoes.aniversarios(); track a.id) {
            <button type="button" class="aviso-item aniversario" (click)="abrirPerfil(a.id)">
              <span class="icone" aria-hidden="true">🎂</span>
              <span class="texto">{{ a.texto }}</span>
            </button>
          }

          @for (n of notificacoes.itens(); track n.id) {
            <button type="button" class="aviso-item" [class.nova]="!n.lida" (click)="abrir(n.id, n.rota)">
              <span class="icone" aria-hidden="true">{{ icone(n.tipo) }}</span>
              <span class="texto">
                {{ n.texto }}
                <small>{{ quando(n.criado_em) }}</small>
              </span>
              @if (!n.lida) {
                <span class="ponto" aria-label="Não lida"></span>
              }
            </button>
          } @empty {
            @if (notificacoes.aniversarios().length === 0) {
              <p class="suave vazio">Nenhum aviso por enquanto. Quando alguém convidar você, comentar numa resenha ou a roleta girar, aparece aqui!</p>
            }
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .painel {
        max-width: 420px;
      }
      .x {
        position: absolute;
        top: 10px;
        right: 12px;
        width: 34px;
        height: 34px;
        border: none;
        border-radius: 50%;
        background: #fde3e7;
        color: var(--cob-vinho);
        font-weight: 700;
        cursor: pointer;
      }
      h2 {
        margin: 0 0 8px;
        font-size: 1.6rem;
        padding-right: 36px;
      }
      .marcar {
        margin-bottom: 8px;
      }
      .aviso-item {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        margin-bottom: 8px;
        padding: 10px 12px;
        border: 1.5px solid #f7dde2;
        border-radius: 16px;
        background: #fff;
        font-family: inherit;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }
      .aviso-item.nova {
        border-color: var(--cob-framboesa);
        background: #fff6f8;
      }
      .aviso-item.aniversario {
        border-color: #d9a441;
        background: linear-gradient(120deg, #fff1cf, #fde3e7);
      }
      .icone {
        font-size: 1.5rem;
        flex-shrink: 0;
      }
      .texto {
        flex: 1;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }
      .texto small {
        display: block;
        margin-top: 2px;
        color: #8c5a68;
        font-size: 0.75rem;
      }
      .ponto {
        width: 10px;
        height: 10px;
        flex-shrink: 0;
        border-radius: 50%;
        background: var(--cob-framboesa);
      }
      .vazio {
        text-align: center;
        padding: 12px 6px;
      }
    `,
  ],
})
export class NotificacoesPainelComponent {
  protected readonly notificacoes = inject(NotificacoesService);
  private readonly router = inject(Router);
  private readonly resumo = inject(ResumoMembroService);

  protected icone(tipo: string): string {
    return ICONES[tipo] ?? '🔔';
  }

  protected async abrir(id: string, rota: string | null) {
    void this.notificacoes.marcarComoLida(id);
    this.notificacoes.fechar();
    if (rota) await this.router.navigateByUrl(rota);
  }

  protected abrirPerfil(id: string) {
    this.notificacoes.fechar();
    this.resumo.abrir(id);
  }

  protected quando(iso: string): string {
    const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutos < 1) return 'agora';
    if (minutos < 60) return `há ${minutos} min`;
    const horas = Math.round(minutos / 60);
    if (horas < 24) return `há ${horas} h`;
    const dias = Math.round(horas / 24);
    return dias === 1 ? 'ontem' : new Date(iso).toLocaleDateString('pt-BR');
  }
}
